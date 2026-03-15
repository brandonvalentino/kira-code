import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { issueCommentReactions, issueComments } from '../db/schema.js';
import { assertIssueMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const CreateSchema = z.object({
  id: z.string().uuid().optional(),
  comment_id: z.string().uuid(),
  emoji: z.string(),
});

export function issueCommentReactionsRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const data = CreateSchema.parse(await c.req.json());
    // Verify comment exists and user can access its issue
    const comment = await state.db.select().from(issueComments).where(eq(issueComments.id, data.comment_id)).limit(1).then(r => r[0]);
    if (!comment) return c.json({ error: 'Not found' }, 404);
    if (!(await assertIssueMember(state, user.id, comment.issue_id))) return c.json({ error: 'Forbidden' }, 403);
    const [row] = await state.db.insert(issueCommentReactions).values({ id: data.id ?? uuidv4(), comment_id: data.comment_id, user_id: user.id, emoji: data.emoji }).returning();
    return c.json({ data: row, txid: uuidv4() }, 201);
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(issueCommentReactions).where(eq(issueCommentReactions.id, id)).limit(1).then(r => r[0]);
    if (!row || row.user_id !== user.id) return c.json({ error: 'Not found' }, 404);
    await state.db.delete(issueCommentReactions).where(eq(issueCommentReactions.id, id));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
