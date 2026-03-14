/**
 * Repo routes - API endpoints for repository management.
 */
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { success, error, SuccessResponseSchema, ErrorResponseSchema, UuidSchema } from '../utils/response.js';
import * as repoStore from '../stores/repos.js';

// Helper functions
function uuidToBuffer(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bufferToUuid(buffer: Buffer): string {
  const hex = buffer.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

function formatRepo(repo: any) {
  return {
    id: bufferToUuid(repo.id),
    path: repo.path,
    name: repo.name,
    displayName: repo.displayName,
    setupScript: repo.setupScript,
    cleanupScript: repo.cleanupScript,
    archiveScript: repo.archiveScript,
    copyFiles: repo.copyFiles,
    parallelSetupScript: repo.parallelSetupScript,
    devServerScript: repo.devServerScript,
    defaultTargetBranch: repo.defaultTargetBranch,
    defaultWorkingDir: repo.defaultWorkingDir,
    createdAt: repo.createdAt,
    updatedAt: repo.updatedAt,
  };
}

// Repo schema
const RepoSchema = z.object({
  id: z.string().uuid().openapi({ description: 'Repository ID' }),
  path: z.string().openapi({ description: 'File system path to repository' }),
  name: z.string().openapi({ description: 'Repository name' }),
  displayName: z.string().nullable().openapi({ description: 'Display name' }),
  setupScript: z.string().nullable().openapi({ description: 'Setup script path' }),
  cleanupScript: z.string().nullable().openapi({ description: 'Cleanup script path' }),
  archiveScript: z.string().nullable().openapi({ description: 'Archive script path' }),
  copyFiles: z.string().nullable().openapi({ description: 'Files to copy on setup' }),
  parallelSetupScript: z.boolean().nullable().openapi({ description: 'Run setup script in parallel' }),
  devServerScript: z.string().nullable().openapi({ description: 'Dev server script path' }),
  defaultTargetBranch: z.string().nullable().openapi({ description: 'Default target branch for PRs' }),
  defaultWorkingDir: z.string().nullable().openapi({ description: 'Default working directory' }),
  createdAt: z.string().openapi({ description: 'Creation timestamp' }),
  updatedAt: z.string().openapi({ description: 'Last update timestamp' }),
});

// Routes
const listReposRoute = createRoute({
  method: 'get',
  path: '/api/repos',
  tags: ['Repositories'],
  summary: 'List repositories',
  description: 'Get all repositories',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.array(RepoSchema)),
        },
      },
      description: 'List of repositories',
    },
  },
});

const listRecentReposRoute = createRoute({
  method: 'get',
  path: '/api/repos/recent',
  tags: ['Repositories'],
  summary: 'List recent repositories',
  description: 'Get repositories sorted by recent usage',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.array(RepoSchema)),
        },
      },
      description: 'List of recent repositories',
    },
  },
});

const getRepoRoute = createRoute({
  method: 'get',
  path: '/api/repos/{id}',
  tags: ['Repositories'],
  summary: 'Get repository',
  description: 'Get a single repository by ID',
  request: {
    params: z.object({
      id: UuidSchema,
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(RepoSchema),
        },
      },
      description: 'Repository details',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid repository ID',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Repository not found',
    },
  },
});

const createRepoRoute = createRoute({
  method: 'post',
  path: '/api/repos',
  tags: ['Repositories'],
  summary: 'Create repository',
  description: 'Register a new repository',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            path: z.string().min(1).openapi({ description: 'File system path to repository' }),
            displayName: z.string().optional().openapi({ description: 'Display name' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(RepoSchema),
        },
      },
      description: 'Created repository',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Validation error or invalid git repository',
    },
  },
});

const updateRepoRoute = createRoute({
  method: 'patch',
  path: '/api/repos/{id}',
  tags: ['Repositories'],
  summary: 'Update repository',
  description: 'Update repository properties',
  request: {
    params: z.object({
      id: UuidSchema,
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            displayName: z.string().nullable().optional().openapi({ description: 'Display name' }),
            setupScript: z.string().nullable().optional().openapi({ description: 'Setup script path' }),
            cleanupScript: z.string().nullable().optional().openapi({ description: 'Cleanup script path' }),
            archiveScript: z.string().nullable().optional().openapi({ description: 'Archive script path' }),
            copyFiles: z.string().nullable().optional().openapi({ description: 'Files to copy on setup' }),
            parallelSetupScript: z.boolean().nullable().optional().openapi({ description: 'Run setup script in parallel' }),
            devServerScript: z.string().nullable().optional().openapi({ description: 'Dev server script path' }),
            defaultTargetBranch: z.string().nullable().optional().openapi({ description: 'Default target branch' }),
            defaultWorkingDir: z.string().nullable().optional().openapi({ description: 'Default working directory' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(RepoSchema),
        },
      },
      description: 'Updated repository',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Validation error',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Repository not found',
    },
  },
});

const deleteRepoRoute = createRoute({
  method: 'delete',
  path: '/api/repos/{id}',
  tags: ['Repositories'],
  summary: 'Delete repository',
  description: 'Delete a repository registration',
  request: {
    params: z.object({
      id: UuidSchema,
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema(z.object({ deleted: z.literal(true) })),
        },
      },
      description: 'Repository deleted',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid repository ID',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Repository not found',
    },
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Repository has active workspaces',
    },
  },
});

export function registerRepoRoutes(app: OpenAPIHono): void {
  app.openapi(listReposRoute, async (c) => {
    const repos = await repoStore.listAll();
    return c.json(success(repos.map(formatRepo)), 200);
  });

  app.openapi(listRecentReposRoute, async (c) => {
    const repos = await repoStore.listByRecentUsage();
    return c.json(success(repos.map(formatRepo)), 200);
  });

  app.openapi(getRepoRoute, async (c) => {
    const { id } = c.req.valid('param');
    const repo = await repoStore.findById(uuidToBuffer(id));
    if (!repo) {
      return c.json(error('Repo not found'), 404);
    }
    return c.json(success(formatRepo(repo)), 200);
  });

  app.openapi(createRepoRoute, async (c) => {
    const body = c.req.valid('json');
    if (!repoStore.isValidGitRepo(body.path)) {
      return c.json(error('Path is not a valid git repository'), 400);
    }
    const repo = await repoStore.findOrCreate(body.path, body.displayName);
    return c.json(success(formatRepo(repo)), 200);
  });

  app.openapi(updateRepoRoute, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const repo = await repoStore.update(uuidToBuffer(id), body);
    if (!repo) {
      return c.json(error('Repo not found'), 404);
    }
    return c.json(success(formatRepo(repo)), 200);
  });

  app.openapi(deleteRepoRoute, async (c) => {
    const { id } = c.req.valid('param');
    const idBuffer = uuidToBuffer(id);
    const activeWorkspaces = await repoStore.activeWorkspaceNames(idBuffer);
    if (activeWorkspaces.length > 0) {
      return c.json(error(`Repository is used by ${activeWorkspaces.length} active workspace(s)`), 409);
    }
    const count = await repoStore.remove(idBuffer);
    if (count === 0) {
      return c.json(error('Repo not found'), 404);
    }
    return c.json(success({ deleted: true } as const), 200);
  });
}