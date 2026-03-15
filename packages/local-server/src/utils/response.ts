/**
 * Re-exports shared response helpers from @kira/shared.
 * Local-server-specific OpenAPI schemas are added here.
 */
import { z } from '@hono/zod-openapi';

export {
  type SuccessResponse,
  type ErrorResponse,
  type MutationResponse,
  success,
  error,
  mutation,
} from '@kira/shared';

/**
 * Success response schema for OpenAPI.
 */
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true).openapi({ description: 'Success flag', example: true }),
    data: dataSchema.openapi({ description: 'Response data' }),
    message: z.literal(null).openapi({ description: 'Error message (null on success)' }),
  });

/**
 * Error response schema for OpenAPI.
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false).openapi({ description: 'Success flag', example: false }),
  data: z.literal(null).openapi({ description: 'Response data (null on error)' }),
  message: z.string().openapi({ description: 'Error message', example: 'Resource not found' }),
});

/**
 * Common parameter schemas.
 */
export const UuidSchema = z.string().uuid().openapi({
  description: 'UUID identifier',
  example: '123e4567-e89b-12d3-a456-426614174000',
});
