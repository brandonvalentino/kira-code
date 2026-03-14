/**
 * API Response format matching the Rust backend.
 * All API endpoints should use this format for consistency.
 */
import { z } from '@hono/zod-openapi';

/**
 * Success response schema for OpenAPI.
 * data is T (non-nullable), message is null.
 */
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true).openapi({ description: 'Success flag', example: true }),
    data: dataSchema.openapi({ description: 'Response data' }),
    message: z.literal(null).openapi({ description: 'Error message (null on success)' }),
  });

/**
 * Error response schema for OpenAPI.
 * data is null, message is string (non-nullable).
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false).openapi({ description: 'Success flag', example: false }),
  data: z.literal(null).openapi({ description: 'Response data (null on error)' }),
  message: z.string().openapi({ description: 'Error message', example: 'Resource not found' }),
});

/**
 * Type helper for success response.
 */
export type SuccessResponse<T> = {
  success: true;
  data: T;
  message: null;
};

/**
 * Type helper for error response.
 */
export type ErrorResponse = {
  success: false;
  data: null;
  message: string;
};

/**
 * Success response helper.
 */
export function success<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    message: null,
  };
}

/**
 * Error response helper.
 */
export function error(message: string): ErrorResponse {
  return {
    success: false,
    data: null,
    message,
  };
}

/**
 * Common parameter schemas.
 */
export const UuidSchema = z.string().uuid().openapi({
  description: 'UUID identifier',
  example: '123e4567-e89b-12d3-a456-426614174000',
});