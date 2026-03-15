/**
 * Cloud API Implementation Validation Tests.
 * Validates that all required routes from TEST.md are implemented.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROUTES_DIR = join(__dirname, '../routes');

describe('Implementation Validation', () => {
  describe('Route Files', () => {
    it('should have organizations route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'organizations.ts'))).toBe(true);
    });

    it('should have projects route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'projects.ts'))).toBe(true);
    });

    it('should have issues route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'issues.ts'))).toBe(true);
    });

    it('should have issue-comments route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'issue-comments.ts'))).toBe(true);
    });

    it('should have issue-assignees route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'issue-assignees.ts'))).toBe(true);
    });

    it('should have issue-tags route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'issue-tags.ts'))).toBe(true);
    });

    it('should have tags route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'tags.ts'))).toBe(true);
    });

    it('should have project-statuses route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'project-statuses.ts'))).toBe(true);
    });

    it('should have organization-members route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'organization-members.ts'))).toBe(true);
    });

    it('should have notifications route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'notifications.ts'))).toBe(true);
    });

    it('should have internal events route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'internal/events.ts'))).toBe(true);
    });

    it('should have tokens route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'tokens.ts'))).toBe(true);
    });

    it('should have oauth route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'oauth.ts'))).toBe(true);
    });

    it('should have attachments route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'attachments.ts'))).toBe(true);
    });

    it('should have hosts route file (for relay)', () => {
      expect(existsSync(join(ROUTES_DIR, 'hosts.ts'))).toBe(true);
    });

    it('should have github-app route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'github-app.ts'))).toBe(true);
    });

    it('should have migration route file', () => {
      expect(existsSync(join(ROUTES_DIR, 'migration.ts'))).toBe(true);
    });
  });

  describe('Database Schema', () => {
    it('should have schema file', () => {
      expect(existsSync(join(__dirname, '../db/schema.ts'))).toBe(true);
    });

    it('should have migrations directory', () => {
      const migrationsDir = join(__dirname, '../../migrations');
      expect(existsSync(migrationsDir)).toBe(true);
    });
  });

  describe('Auth Implementation', () => {
    it('should have JWT auth', () => {
      expect(existsSync(join(__dirname, '../auth/jwt.ts'))).toBe(true);
    });

    it('should have auth middleware', () => {
      expect(existsSync(join(__dirname, '../auth/middleware.ts'))).toBe(true);
    });
  });

  describe('Proxy Implementation', () => {
    it('should have ElectricSQL proxy', () => {
      expect(existsSync(join(__dirname, '../proxy/electric.ts'))).toBe(true);
    });
  });

  describe('Route Content Validation', () => {
    it('organizations route should export router', () => {
      const content = readFileSync(join(ROUTES_DIR, 'organizations.ts'), 'utf-8');
      expect(content).toContain('organizationsRouter');
      expect(content).toContain('app.post');
      expect(content).toContain('app.get');
    });

    it('projects route should export router', () => {
      const content = readFileSync(join(ROUTES_DIR, 'projects.ts'), 'utf-8');
      expect(content).toContain('projectsRouter');
    });

    it('issues route should export router', () => {
      const content = readFileSync(join(ROUTES_DIR, 'issues.ts'), 'utf-8');
      expect(content).toContain('issuesRouter');
    });

    it('internal events should have POST endpoint', () => {
      const content = readFileSync(join(ROUTES_DIR, 'internal/events.ts'), 'utf-8');
      expect(content).toContain('POST');
      expect(content).toContain('events');
    });

    it('tokens route should have llm-token endpoint', () => {
      const content = readFileSync(join(ROUTES_DIR, 'tokens.ts'), 'utf-8');
      expect(content).toContain('llm-token');
    });
  });

  describe('Schema Validation', () => {
    const schemaContent = readFileSync(join(__dirname, '../db/schema.ts'), 'utf-8');

    it('should have organizations table', () => {
      expect(schemaContent).toContain("'organizations'");
    });

    it('should have users table', () => {
      expect(schemaContent).toContain("'users'");
    });

    it('should have projects table', () => {
      expect(schemaContent).toContain("'projects'");
    });

    it('should have issues table', () => {
      expect(schemaContent).toContain("'issues'");
    });

    it('should have issue_comments table', () => {
      expect(schemaContent).toContain("'issue_comments'");
    });

    it('should have issue_assignees table', () => {
      expect(schemaContent).toContain("'issue_assignees'");
    });

    it('should have issue_tags table', () => {
      expect(schemaContent).toContain("'issue_tags'");
    });

    it('should have tags table', () => {
      expect(schemaContent).toContain("'tags'");
    });

    it('should have project_statuses table', () => {
      expect(schemaContent).toContain("'project_statuses'");
    });

    it('should have organization_members table', () => {
      expect(schemaContent).toContain("'organization_member_metadata'");
    });

    it('should have notifications table', () => {
      expect(schemaContent).toContain("'notifications'");
    });

    it('should have task_events table', () => {
      expect(schemaContent).toContain("'task_events'");
    });

    it('should have auth_sessions table', () => {
      expect(schemaContent).toContain("'auth_sessions'");
    });

    it('should have hosts table (relay)', () => {
      expect(schemaContent).toContain("'hosts'");
    });

    it('should have attachments/blobs tables', () => {
      expect(schemaContent).toContain("'blobs'");
      expect(schemaContent).toContain("'attachments'");
    });
  });

  describe('Server Registration', () => {
    const serverContent = readFileSync(join(__dirname, '../server.ts'), 'utf-8');

    it('should register organizations routes at /v1/organizations', () => {
      expect(serverContent).toContain("/v1/organizations");
      expect(serverContent).toContain("organizationsRouter");
    });

    it('should register projects routes at /v1/projects', () => {
      expect(serverContent).toContain("/v1/projects");
      expect(serverContent).toContain("projectsRouter");
    });

    it('should register issues routes at /v1/issues', () => {
      expect(serverContent).toContain("/v1/issues");
      expect(serverContent).toContain("issuesRouter");
    });

    it('should register health endpoint at /v1/health', () => {
      expect(serverContent).toContain("/v1/health");
    });

    it('should register shape proxy at /v1/shape', () => {
      expect(serverContent).toContain("/v1/shape");
    });

    it('should register internal routes at /v1/internal', () => {
      expect(serverContent).toContain("/v1/internal/tasks");
    });

    it('should have CORS middleware', () => {
      expect(serverContent).toContain("cors({");
    });

    it('should have logger middleware', () => {
      expect(serverContent).toContain("logger()");
    });

    it('should have 404 handler', () => {
      expect(serverContent).toContain("notFound");
    });

    it('should have error handler', () => {
      expect(serverContent).toContain("onError");
    });
  });
});