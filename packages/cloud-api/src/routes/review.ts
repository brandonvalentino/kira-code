/**
 * PR Review routes.
 * Used by the `kira-code review` CLI and remote-web to upload, start,
 * and track the status of automated PR reviews.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { reviews } from '../db/schema.js';

type Env = { Variables: AuthVariables };

const InitReviewSchema = z.object({
  workspace_id: z.string().uuid().optional(),
  filename: z.string().default('payload.tar.gz'),
  size_bytes: z.number().int(),
});

const ReviewSuccessSchema = z.object({
  summary: z.string().optional(),
});

const ReviewFailedSchema = z.object({
  error_message: z.string(),
});

export function reviewRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  /**
   * Initialize a review upload — returns a presigned S3 URL.
   */
  app.post('/init', auth, async (c) => {
    const user = c.var.user;
    const data = InitReviewSchema.parse(await c.req.json());

    if (!state.reviewS3) {
      return c.json({ error: 'Review storage not configured' }, 503);
    }

    const reviewId = uuidv4();
    const folderPath = `reviews/${reviewId}`;
    const objectKey = `${folderPath}/${data.filename}`;

    const uploadUrl = await getSignedUrl(
      state.reviewS3,
      new PutObjectCommand({
        Bucket: process.env.R2_REVIEW_BUCKET,
        Key: objectKey,
        ContentLength: data.size_bytes,
      }),
      { expiresIn: 3600 },
    );

    const [review] = await state.db
      .insert(reviews)
      .values({
        id: reviewId,
        owner_user_id: user.id,
        workspace_id: data.workspace_id ?? null,
        status: 'uploading',
        folder_path: folderPath,
      })
      .returning();

    return c.json({ review_id: review.id, upload_url: uploadUrl, folder_path: folderPath });
  });

  /**
   * Start the review worker after upload is complete.
   */
  app.post('/start', auth, async (c) => {
    const body = await c.req.json() as { review_id: string };
    if (!body.review_id) return c.json({ error: 'review_id required' }, 400);

    const review = await state.db
      .select()
      .from(reviews)
      .where(eq(reviews.id, body.review_id))
      .limit(1)
      .then((r) => r[0]);

    if (!review || review.owner_user_id !== c.var.user?.id) {
      return c.json({ error: 'Not found' }, 404);
    }

    const workerUrl = process.env.REVIEW_WORKER_BASE_URL;
    if (!workerUrl) {
      return c.json({ error: 'Review worker not configured' }, 503);
    }

    // Call the review worker
    const workerRes = await fetch(`${workerUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_id: review.id, folder_path: review.folder_path }),
    });

    if (!workerRes.ok) {
      await state.db.update(reviews).set({ status: 'failed', error_message: 'Worker dispatch failed' }).where(eq(reviews.id, review.id));
      return c.json({ error: 'Failed to start review' }, 500);
    }

    const workerData = await workerRes.json() as { job_id?: string };
    await state.db.update(reviews).set({ status: 'running', worker_job_id: workerData.job_id ?? null }).where(eq(reviews.id, review.id));

    return c.json({ review_id: review.id, status: 'running' });
  });

  /**
   * Get review status.
   */
  app.get('/:id/status', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const review = await state.db.select().from(reviews).where(eq(reviews.id, id)).limit(1).then(r => r[0]);
    if (!review || review.owner_user_id !== user.id) return c.json({ error: 'Not found' }, 404);
    return c.json({ review_id: review.id, status: review.status, error_message: review.error_message });
  });

  /**
   * Get review result.
   */
  app.get('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const review = await state.db.select().from(reviews).where(eq(reviews.id, id)).limit(1).then(r => r[0]);
    if (!review || review.owner_user_id !== user.id) return c.json({ error: 'Not found' }, 404);
    return c.json(review);
  });

  /**
   * Internal: mark review succeeded (called by worker).
   */
  app.post('/:id/success', async (c) => {
    const id = c.req.param('id');
    ReviewSuccessSchema.parse(await c.req.json()); // validate
    await state.db.update(reviews).set({ status: 'done', updated_at: new Date() }).where(eq(reviews.id, id));
    return c.json({ success: true });
  });

  /**
   * Internal: mark review failed (called by worker).
   */
  app.post('/:id/failed', async (c) => {
    const id = c.req.param('id');
    const { error_message } = ReviewFailedSchema.parse(await c.req.json());
    await state.db.update(reviews).set({ status: 'failed', error_message, updated_at: new Date() }).where(eq(reviews.id, id));
    return c.json({ success: true });
  });

  return app;
}
