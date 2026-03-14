/**
 * Config routes - API endpoints for configuration management.
 */
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { success, error, SuccessResponseSchema, ErrorResponseSchema } from '../utils/response.js';
import * as settingsStore from '../stores/settings.js';

// Enums
const EditorSchema = z.enum(['vscode', 'cursor', 'zed', 'windsurf', 'none']).openapi({
  description: 'Editor preference',
  example: 'cursor',
});
const ThemeSchema = z.enum(['light', 'dark', 'system']).openapi({
  description: 'Theme preference',
  example: 'dark',
});

// Config schema
const ConfigSchema = z.object({
  editor: EditorSchema,
  editorCommand: z.string().optional().openapi({ description: 'Custom editor command' }),
  gitBranchPrefix: z.string().openapi({ description: 'Git branch prefix' }),
  executorProfile: z.string().openapi({ description: 'Executor profile' }),
  autoCreateWorktree: z.boolean().openapi({ description: 'Auto-create worktree' }),
  autoCleanupWorktrees: z.boolean().openapi({ description: 'Auto-cleanup worktrees' }),
  autoOpenEditor: z.boolean().openapi({ description: 'Auto-open editor' }),
  theme: ThemeSchema,
  soundEnabled: z.boolean().openapi({ description: 'Sound enabled' }),
  analyticsEnabled: z.boolean().openapi({ description: 'Analytics enabled' }),
  disclaimerAcknowledged: z.boolean().openapi({ description: 'Disclaimer acknowledged' }),
  onboardingAcknowledged: z.boolean().openapi({ description: 'Onboarding acknowledged' }),
  relayEnabled: z.boolean().openapi({ description: 'Relay enabled' }),
  relayHostName: z.string().optional().openapi({ description: 'Relay host name' }),
});

// Info schema (system info)
const SystemInfoSchema = z.object({
  version: z.string().openapi({ description: 'Application version' }),
  config: ConfigSchema.openapi({ description: 'Current configuration' }),
  analyticsUserId: z.string().openapi({ description: 'Analytics user ID' }),
  loginStatus: z.enum(['logged_in', 'logged_out']).openapi({ description: 'Login status' }),
  environment: z.object({
    osType: z.string().openapi({ description: 'Operating system type' }),
    osVersion: z.string().openapi({ description: 'Operating system version' }),
    osArchitecture: z.string().openapi({ description: 'OS architecture' }),
    bitness: z.string().openapi({ description: 'Bitness (32 or 64)' }),
  }).openapi({ description: 'Environment information' }),
});

// Update config schema (all fields optional)
const UpdateConfigSchema = z.object({
  editor: EditorSchema.optional(),
  editorCommand: z.string().optional().openapi({ description: 'Custom editor command' }),
  gitBranchPrefix: z.string().optional().openapi({ description: 'Git branch prefix' }),
  executorProfile: z.string().optional().openapi({ description: 'Executor profile' }),
  autoCreateWorktree: z.boolean().optional().openapi({ description: 'Auto-create worktree' }),
  autoCleanupWorktrees: z.boolean().optional().openapi({ description: 'Auto-cleanup worktrees' }),
  autoOpenEditor: z.boolean().optional().openapi({ description: 'Auto-open editor' }),
  theme: ThemeSchema.optional(),
  soundEnabled: z.boolean().optional().openapi({ description: 'Sound enabled' }),
  analyticsEnabled: z.boolean().optional().openapi({ description: 'Analytics enabled' }),
  disclaimerAcknowledged: z.boolean().optional().openapi({ description: 'Disclaimer acknowledged' }),
  onboardingAcknowledged: z.boolean().optional().openapi({ description: 'Onboarding acknowledged' }),
  relayEnabled: z.boolean().optional().openapi({ description: 'Relay enabled' }),
  relayHostName: z.string().optional().openapi({ description: 'Relay host name' }),
});

// Routes
const getInfoRoute = createRoute({
  method: 'get',
  path: '/api/info',
  tags: ['Configuration'],
  summary: 'Get system info',
  description: 'Get system and application information',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(SystemInfoSchema),
        },
      },
      description: 'System information',
    },
  },
});

const getConfigRoute = createRoute({
  method: 'get',
  path: '/api/config',
  tags: ['Configuration'],
  summary: 'Get configuration',
  description: 'Get the current application configuration',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(ConfigSchema),
        },
      },
      description: 'Current configuration',
    },
  },
});

const updateConfigRoute = createRoute({
  method: 'patch',
  path: '/api/config',
  tags: ['Configuration'],
  summary: 'Update configuration',
  description: 'Update application configuration',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateConfigSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(ConfigSchema),
        },
      },
      description: 'Updated configuration',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Validation error',
    },
  },
});

export function registerConfigRoutes(app: OpenAPIHono): void {
  app.openapi(getInfoRoute, async (c) => {
    const info = await settingsStore.getUserSystemInfo();
    return c.json(success(info), 200);
  });

  app.openapi(getConfigRoute, async (c) => {
    const config = await settingsStore.getConfig();
    return c.json(success(config), 200);
  });

  app.openapi(updateConfigRoute, async (c) => {
    const body = c.req.valid('json');
    if (body.gitBranchPrefix !== undefined && body.gitBranchPrefix.includes('/')) {
      return c.json(error('Invalid git branch prefix'), 400);
    }
    const config = await settingsStore.updateConfig(body);
    return c.json(success(config), 200);
  });
}