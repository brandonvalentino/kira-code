/**
 * Model profiles routes - CRUD endpoints for managing named model presets.
 */
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { success, error, SuccessResponseSchema, ErrorResponseSchema } from '../utils/response.js';
import * as profileStore from '../stores/model-profiles.js';
import { ModelProfileSchema, ThinkingLevelSchema } from '../stores/model-profiles.js';

// OpenAPI-annotated schema re-exports
const ProfileSchema = z.object({
  name: z.string().openapi({ description: 'Profile name (e.g. quick, normal, pro)' }),
  provider: z.string().openapi({ description: 'LLM provider (e.g. anthropic, google, openai)' }),
  modelId: z.string().openapi({ description: 'Model ID within the provider' }),
  thinkingLevel: ThinkingLevelSchema.optional(),
  description: z.string().optional().openapi({ description: 'Human-readable description' }),
});

const ProfilesListSchema = z.object({
  profiles: z.array(ProfileSchema),
  defaultProfile: z.string().nullable().openapi({ description: 'Name of the default profile' }),
});

// Routes

const listProfilesRoute = createRoute({
  method: 'get',
  path: '/api/model-profiles',
  tags: ['Model Profiles'],
  summary: 'List model profiles',
  description: 'Get all named model profiles and the current default.',
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(ProfilesListSchema) } },
      description: 'Model profiles list',
    },
  },
});

const getProfileRoute = createRoute({
  method: 'get',
  path: '/api/model-profiles/{name}',
  tags: ['Model Profiles'],
  summary: 'Get model profile',
  description: 'Get a single model profile by name.',
  request: {
    params: z.object({ name: z.string() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(ProfileSchema) } },
      description: 'Model profile',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Profile not found',
    },
  },
});

const createProfileRoute = createRoute({
  method: 'post',
  path: '/api/model-profiles',
  tags: ['Model Profiles'],
  summary: 'Create model profile',
  description: 'Create a new named model profile.',
  request: {
    body: {
      content: {
        'application/json': { schema: ModelProfileSchema },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(ProfileSchema) } },
      description: 'Created profile',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Profile name already exists or validation error',
    },
  },
});

const updateProfileRoute = createRoute({
  method: 'patch',
  path: '/api/model-profiles/{name}',
  tags: ['Model Profiles'],
  summary: 'Update model profile',
  description: 'Update an existing model profile.',
  request: {
    params: z.object({ name: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            provider: z.string().optional(),
            modelId: z.string().optional(),
            thinkingLevel: ThinkingLevelSchema.optional(),
            description: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(ProfileSchema) } },
      description: 'Updated profile',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Profile not found',
    },
  },
});

const deleteProfileRoute = createRoute({
  method: 'delete',
  path: '/api/model-profiles/{name}',
  tags: ['Model Profiles'],
  summary: 'Delete model profile',
  description: 'Delete a model profile by name.',
  request: {
    params: z.object({ name: z.string() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(z.object({ deleted: z.boolean() })) } },
      description: 'Profile deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Profile not found',
    },
  },
});

const setDefaultProfileRoute = createRoute({
  method: 'post',
  path: '/api/model-profiles/{name}/set-default',
  tags: ['Model Profiles'],
  summary: 'Set default profile',
  description: 'Set a model profile as the default for new agent sessions.',
  request: {
    params: z.object({ name: z.string() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuccessResponseSchema(z.object({ defaultProfile: z.string() })) } },
      description: 'Default profile updated',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Profile not found',
    },
  },
});

export function registerModelProfileRoutes(app: OpenAPIHono): void {
  app.openapi(listProfilesRoute, async (c) => {
    const profiles = await profileStore.listProfiles();
    const defaultProfile = await profileStore.getDefaultProfileName();
    return c.json(success({ profiles, defaultProfile }), 200);
  });

  app.openapi(getProfileRoute, async (c) => {
    const { name } = c.req.valid('param');
    const profile = await profileStore.getProfile(name);
    if (!profile) return c.json(error(`Profile '${name}' not found`), 404);
    return c.json(success(profile), 200);
  });

  app.openapi(createProfileRoute, async (c) => {
    const body = c.req.valid('json');
    try {
      const profile = await profileStore.createProfile(body);
      return c.json(success(profile), 200);
    } catch (err: unknown) {
      return c.json(error(err instanceof Error ? err.message : String(err)), 400);
    }
  });

  app.openapi(updateProfileRoute, async (c) => {
    const { name } = c.req.valid('param');
    const body = c.req.valid('json');
    try {
      const profile = await profileStore.updateProfile(name, body);
      return c.json(success(profile), 200);
    } catch (err: unknown) {
      return c.json(error(err instanceof Error ? err.message : String(err)), 404);
    }
  });

  app.openapi(deleteProfileRoute, async (c) => {
    const { name } = c.req.valid('param');
    try {
      await profileStore.deleteProfile(name);
      return c.json(success({ deleted: true }), 200);
    } catch (err: unknown) {
      return c.json(error(err instanceof Error ? err.message : String(err)), 404);
    }
  });

  app.openapi(setDefaultProfileRoute, async (c) => {
    const { name } = c.req.valid('param');
    try {
      await profileStore.setDefaultProfile(name);
      return c.json(success({ defaultProfile: name }), 200);
    } catch (err: unknown) {
      return c.json(error(err instanceof Error ? err.message : String(err)), 404);
    }
  });
}
