/**
 * Virtual key store - CRUD operations for LiteLLM proxy virtual keys.
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { virtualKeys, type VirtualKey } from '../db/schema.js';

/**
 * Create a new virtual key.
 * @param budgetTokens Optional token budget limit. null means unlimited.
 */
export async function createVirtualKey(budgetTokens?: number): Promise<VirtualKey> {
  const db = getDb();
  const id = Buffer.from(randomUUID().replace(/-/g, ''), 'hex');
  const key = `vk-${randomUUID().replace(/-/g, '')}`;
  const now = new Date().toISOString();

  const results = await db
    .insert(virtualKeys)
    .values({
      id,
      key,
      budgetTokens: budgetTokens ?? null,
      usedTokens: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return results[0];
}

/**
 * Get the first available virtual key (most recently created).
 * Returns null if no keys exist.
 */
export async function getVirtualKey(): Promise<VirtualKey | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(virtualKeys)
    .orderBy(virtualKeys.createdAt)
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get a virtual key by its key string.
 */
export async function findByKey(key: string): Promise<VirtualKey | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(virtualKeys)
    .where(eq(virtualKeys.key, key))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Track token usage for a virtual key.
 * @param key The virtual key string
 * @param tokens Number of tokens used
 */
export async function trackUsage(key: string, tokens: number): Promise<void> {
  const db = getDb();
  const existing = await findByKey(key);
  if (!existing) return;

  await db
    .update(virtualKeys)
    .set({
      usedTokens: existing.usedTokens + tokens,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(virtualKeys.key, key));
}

/**
 * Check if a virtual key is within its budget.
 * Returns true if no budget set or usage is within budget.
 */
export async function isWithinBudget(key: string): Promise<boolean> {
  const vk = await findByKey(key);
  if (!vk) return false;
  if (vk.budgetTokens === null || vk.budgetTokens === undefined) return true;
  return vk.usedTokens < vk.budgetTokens;
}

/**
 * Delete a virtual key.
 */
export async function deleteVirtualKey(key: string): Promise<void> {
  const db = getDb();
  await db.delete(virtualKeys).where(eq(virtualKeys.key, key));
}
