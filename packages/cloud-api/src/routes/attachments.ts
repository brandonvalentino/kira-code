/**
 * Attachment routes.
 * Handles file upload init (S3 presigned URL), confirm, and attachment CRUD.
 * The client uploads directly to S3/R2, then calls confirm to register the blob.
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { attachments, blobs, pendingUploads } from '../db/schema.js';
import { assertProjectMember, assertIssueMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const UPLOAD_EXPIRY_SECONDS = 3600;

const InitUploadSchema = z.object({
  project_id: z.string().uuid(),
  filename: z.string().min(1),
  size_bytes: z.number().int().positive(),
  hash: z.string(),
});

const ConfirmUploadSchema = z.object({
  project_id: z.string().uuid(),
  upload_id: z.string().uuid(),
  filename: z.string(),
  content_type: z.string().optional(),
  size_bytes: z.number().int(),
  hash: z.string(),
  issue_id: z.string().uuid().optional(),
  comment_id: z.string().uuid().optional(),
});

const CommitAttachmentsSchema = z.object({
  attachment_ids: z.array(z.string().uuid()),
});

export function attachmentsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  /**
   * Init upload — returns S3 presigned PUT URL.
   */
  app.post('/init', auth, async (c) => {
    const user = c.var.user;
    const data = InitUploadSchema.parse(await c.req.json());

    if (!(await assertProjectMember(state, user.id, data.project_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!state.s3 || !process.env.R2_BUCKET) {
      return c.json({ error: 'Storage not configured' }, 503);
    }

    // Check for existing blob with same hash
    const existingBlob = await state.db
      .select()
      .from(blobs)
      .where(and(eq(blobs.project_id, data.project_id), eq(blobs.hash, data.hash)))
      .limit(1)
      .then((r) => r[0]);

    if (existingBlob) {
      return c.json({
        upload_url: '',
        upload_id: existingBlob.id,
        expires_at: new Date().toISOString(),
        skip_upload: true,
        existing_blob_id: existingBlob.id,
      });
    }

    const uploadId = uuidv4();
    const ext = data.filename.includes('.') ? data.filename.split('.').pop() : 'bin';
    const blobPath = `projects/${data.project_id}/blobs/${uploadId}.${ext}`;
    const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000);

    await state.db.insert(pendingUploads).values({
      id: uploadId,
      project_id: data.project_id,
      uploader_user_id: user.id,
      filename: data.filename,
      size_bytes: data.size_bytes,
      hash: data.hash,
      blob_path: blobPath,
      expires_at: expiresAt,
    });

    const uploadUrl = await getSignedUrl(
      state.s3,
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: blobPath }),
      { expiresIn: UPLOAD_EXPIRY_SECONDS },
    );

    return c.json({
      upload_url: uploadUrl,
      upload_id: uploadId,
      expires_at: expiresAt.toISOString(),
      skip_upload: false,
      existing_blob_id: null,
    });
  });

  /**
   * Confirm upload — register blob and create attachment record.
   */
  app.post('/confirm', auth, async (c) => {
    const user = c.var.user;
    const data = ConfirmUploadSchema.parse(await c.req.json());

    if (!(await assertProjectMember(state, user.id, data.project_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const pending = await state.db
      .select()
      .from(pendingUploads)
      .where(and(eq(pendingUploads.id, data.upload_id), eq(pendingUploads.project_id, data.project_id)))
      .limit(1)
      .then((r) => r[0]);

    if (!pending) return c.json({ error: 'Upload not found' }, 404);

    // Create blob record
    const [blob] = await state.db.insert(blobs).values({
      id: uuidv4(),
      project_id: data.project_id,
      blob_path: pending.blob_path,
      original_name: data.filename,
      mime_type: data.content_type ?? null,
      size_bytes: data.size_bytes,
      hash: data.hash,
    }).returning();

    // Create attachment record
    const [attachment] = await state.db.insert(attachments).values({
      id: uuidv4(),
      blob_id: blob.id,
      issue_id: data.issue_id ?? null,
      comment_id: data.comment_id ?? null,
    }).returning();

    // Clean up pending upload
    await state.db.delete(pendingUploads).where(eq(pendingUploads.id, pending.id));

    return c.json({ attachment: { ...attachment, blob_path: blob.blob_path, original_name: blob.original_name } }, 201);
  });

  /**
   * Get presigned download URL for an attachment.
   */
  app.get('/:id/file', auth, async (c) => {
    void c.var.user; // auth verified, no further user check needed
    const id = c.req.param('id');

    const row = await state.db
      .select({ attachment: attachments, blob: blobs })
      .from(attachments)
      .innerJoin(blobs, eq(attachments.blob_id, blobs.id))
      .where(eq(attachments.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!row) return c.json({ error: 'Not found' }, 404);
    if (!state.s3 || !process.env.R2_BUCKET) return c.json({ error: 'Storage not configured' }, 503);

    const url = await getSignedUrl(
      state.s3,
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: row.blob.blob_path }),
      { expiresIn: 3600 },
    );

    return c.json({ url });
  });

  /**
   * Commit attachments to an issue (finalize pending attachments).
   */
  app.post('/issues/:issue_id/attachments/commit', auth, async (c) => {
    const _user = c.var.user;
    const issueId = c.req.param('issue_id');
    if (!(await assertIssueMember(state, _user.id, issueId))) return c.json({ error: 'Forbidden' }, 403);
    CommitAttachmentsSchema.parse(await c.req.json()); // validate input

    const rows = await state.db
      .select({ attachment: attachments, blob: blobs })
      .from(attachments)
      .innerJoin(blobs, eq(attachments.blob_id, blobs.id))
      .where(eq(attachments.issue_id, issueId));

    return c.json({ attachments: rows.map(r => ({ ...r.attachment, blob_path: r.blob.blob_path, original_name: r.blob.original_name })) });
  });

  /**
   * Delete an attachment.
   */
  app.delete('/:id', auth, async (c) => {
    const id = c.req.param('id');
    await state.db.delete(attachments).where(eq(attachments.id, id));
    return c.json({ success: true });
  });

  return app;
}
