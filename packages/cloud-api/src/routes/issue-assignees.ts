import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AppState } from '../state.js';
import type { AuthVariables } from '../auth/middleware.js';
import { requireSession } from '../auth/middleware.js';
import { issueAssignees } from '../db/schema.js';
import { assertIssueMember } from './_helpers.js';

type Env = { Variables: AuthVariables };

const CreateSchema = z.object({
  id: z.string().uuid().optional(),
  issue_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export function issueAssigneesRouter(state: AppState) {
  const app = new Hono<Env>();
  const auth = requireSession(state.jwt, state.db);

  app.post('/', auth, async (c) => {
    const user = c.var.user;
    const data = CreateSchema.parse(await c.req.json());
    if (!(await assertIssueMember(state, user.id, data.issue_id))) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const [row] = await state.db
      .insert(issueAssignees)
      .values({ id: data.id ?? uuidv4(), issue_id: data.issue_id, user_id: data.user_id })
      .returning();
    return c.json({ data: row, txid: uuidv4() }, 201);
  });

  app.delete('/:id', auth, async (c) => {
    const user = c.var.user;
    const id = c.req.param('id');
    const row = await state.db.select().from(issueAssignees).where(eq(issueAssignees.id, id)).limit(1).then(r => r[0]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (!(await assertIssueMember(state, user.id, row.issue_id))) return c.json({ error: 'Forbidden' }, 403);
    await state.db.delete(issueAssignees).where(eq(issueAssignees.id, id));
    return c.json({ success: true, txid: uuidv4() });
  });

  return app;
}
