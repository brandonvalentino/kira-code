/**
 * Shared response helpers and utilities.
 * Used by both packages/cloud-api and packages/local-server.
 */
import { z } from 'zod';

// ─── Response types ───────────────────────────────────────────────────────────

export type SuccessResponse<T> = {
  success: true;
  data: T;
  message: null;
};

export type ErrorResponse = {
  success: false;
  data: null;
  message: string;
};

/**
 * Mutation response with ElectricSQL transaction ID.
 * All write operations return this so the frontend can sync.
 */
export type MutationResponse<T> = {
  data: T;
  txid: string;
};

// ─── Response helpers ─────────────────────────────────────────────────────────

export function success<T>(data: T): SuccessResponse<T> {
  return { success: true, data, message: null };
}

export function error(message: string): ErrorResponse {
  return { success: false, data: null, message };
}

export function mutation<T>(data: T, txid: string): MutationResponse<T> {
  return { data, txid };
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const UuidSchema = z
  .string()
  .uuid()
  .describe('UUID identifier');

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.literal(null),
  });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  data: z.literal(null),
  message: z.string(),
});

export const MutationResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    txid: z.string(),
  });

// ─── UUID helpers ─────────────────────────────────────────────────────────────

/** Generate a random UUID v4 without external deps. */
export function randomUuid(): string {
  return crypto.randomUUID();
}
