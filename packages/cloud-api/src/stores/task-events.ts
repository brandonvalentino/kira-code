import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '../db/index.js';
import { taskEvents } from '../db/schema.js';
import type { JsonValue } from '@kira/shared';

export type TaskEventKind =
  | 'agent_started'
  | 'agent_stopped'
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'error';

export interface CreateTaskEventInput {
  task_id: string;
  kind: TaskEventKind | string;
  payload: JsonValue;
}

export async function insertTaskEvent(db: Db, input: CreateTaskEventInput) {
  const [event] = await db
    .insert(taskEvents)
    .values({
      id: uuidv4(),
      task_id: input.task_id,
      kind: input.kind,
      payload: input.payload ?? {},
    })
    .returning();
  return event;
}

export async function getTaskEvents(db: Db, taskId: string) {
  return db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.task_id, taskId))
    .orderBy(desc(taskEvents.created_at));
}
