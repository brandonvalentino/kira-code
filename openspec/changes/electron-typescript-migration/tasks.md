## Implementation Tasks

Priority legend:
- 🔴 **P0** - Critical path, blocks other work
- 🟠 **P1** - Core functionality, needed for MVP
- 🟡 **P2** - Important, enhances experience
- 🟢 **P3** - Nice-to-have, polish

---

## Phase 1: Foundation (🔴 P0)

### 1.1 Project Setup ✅
- [x] Create `packages/local-server/` directory structure
- [x] Add `package.json` with dependencies:
  - `hono@^4.12.7` - Web framework
  - `drizzle-orm@^0.43.1` - ORM
  - `@libsql/client@^0.15.0` - libSQL driver (replaced better-sqlite3 for more features)
  - `@hono/zod-openapi@^0.19.10` - OpenAPI integration with Zod v3
  - `@scalar/hono-api-reference@^0.10.3` - Beautiful API docs UI
  - `@hono/node-server@^1.14.0` - Node.js server adapter
  - `zod@^3.25.76` - Schema validation
  - DevDependencies: `@oxc-node/core@^0.0.35` (fast TS runner), `typescript@^5.9.2`, `drizzle-kit@^0.30.0`
- [x] Add `tsconfig.json` for TypeScript (Node.js ESM, target ES2022)
- [x] Create `drizzle.config.ts` for SQLite migrations
- [x] Create `src/utils/assets.ts` with asset directory resolution (`~/.local/share/kira-code`)
- [x] Create basic `src/index.ts` entry point with configurable port via `BACKEND_PORT`
- [x] Verify `pnpm install` succeeds
- [x] Verify `pnpm run build` produces `dist/index.js`

### 1.2 Database Layer ✅
- [x] Create `src/db/schema.ts` with Drizzle schema (match Rust exactly)
- [x] Create `src/db/index.ts` with database connection
- [x] Create `migrations/` directory with SQL migrations
- [x] Implement database path resolution (dev vs production)
- [x] Verify database file created on first run
- [x] Verify all tables created via migrations
- [x] Test insert and query for workspace
- [x] Test insert and query for repo
- [x] Verify foreign key constraints work

### 1.3 HTTP Server ✅
- [x] Create `src/server.ts` with Hono server using `OpenAPIHono`
- [x] Add CORS middleware (allow localhost:3000, localhost:5173, 127.0.0.1 variants)
- [x] Add logger middleware
- [x] Create `src/routes/health.ts` with `/health` endpoint (OpenAPI documented)
- [x] Add Scalar API reference UI at `/scalar` endpoint
- [x] Add OpenAPI 3.1.0 spec at `/doc` endpoint
- [x] Verify server starts on configurable port (`BACKEND_PORT` env var, default 3000)
- [x] Verify `/health` returns `{ "status": "ok" }`
- [x] Verify `/scalar` shows interactive API documentation
- [x] Create `src/utils/response.ts` with API response helpers

---

## Phase 2: Core API Routes (🟠 P1) ✅

### 2.1 Workspace Routes ✅
- [x] Create `src/stores/workspaces.ts` with CRUD operations
- [x] Create `src/routes/workspaces.ts` with routes
- [x] Implement `GET /api/workspaces` (list with status)
- [x] Implement `GET /api/workspaces/:id` (get by ID)
- [x] Implement `POST /api/workspaces` (create)
- [x] Implement `PATCH /api/workspaces/:id` (update)
- [x] Implement `DELETE /api/workspaces/:id` (delete)
- [x] Verify workspaces sorted by `updated_at DESC`
- [x] Verify `is_running` and `is_errored` calculated correctly

### 2.2 Repo Routes ✅
- [x] Create `src/stores/repos.ts` with CRUD operations
- [x] Create `src/routes/repos.ts` with routes
- [x] Implement `GET /api/repos` (list all)
- [x] Implement `GET /api/repos/recent` (by recent usage)
- [x] Implement `POST /api/repos` (add repo)
- [x] Implement `PATCH /api/repos/:id` (update)
- [x] Implement `DELETE /api/repos/:id` (remove)
- [x] Verify path validation (must be git repo)
- [x] Verify repo name extracted from path

### 2.3 Session Routes ✅
- [x] Create `src/stores/sessions.ts` with CRUD operations
- [x] Create `src/routes/sessions.ts` with routes
- [x] Implement `GET /api/sessions?workspaceId=` (list)
- [x] Implement `POST /api/sessions` (create)
- [x] Implement `GET /api/sessions/:id` (get details)
- [x] Note: Agent start/steer/abort deferred to Phase 3 (Pi SDK Integration)
- [x] Verify sessions ordered by last used

### 2.4 Config Routes ✅
- [x] Create `src/stores/settings.ts` with CRUD operations
- [x] Create `src/routes/config.ts` with routes
- [x] Implement `GET /api/config` (get config)
- [x] Implement `PATCH /api/config` (update config)
- [x] Implement `GET /api/info` (user system info)
- [x] Verify config persisted to `config.json`
- [x] Verify defaults returned for missing fields

### 2.5 Events Route (SSE) ✅
- [x] Create `src/utils/event-bus.ts` with EventEmitter
- [x] Create `src/routes/events.ts` with SSE endpoint
- [x] Implement `GET /api/events` SSE stream
- [x] Verify SSE connection established
- [x] Verify keep-alive every 30 seconds

---

## Phase 3: Pi SDK Integration (🟠 P1) ✅

### 3.1 Pi Session Manager ✅
- [x] Create `src/agent/pi-session.ts` wrapper
- [x] Integrate `createAgentSession()` from Pi SDK
- [x] Implement session initialization with workspace cwd
- [x] Implement `prompt()`, `steer()`, `followUp()`, `abort()` methods
- [x] Forward Pi events to event bus
- [x] Verify Pi session file created in data directory
- [x] Verify events forwarded to SSE stream
- [x] Support model profiles (quick/normal/pro) for easy model selection
- [x] Support Anthropic OAuth authentication (reads from `~/.pi/agent/auth.json`)

### 3.2 LiteLLM Integration ✅
- [x] Create `src/auth/virtual-keys.ts` with virtual key management
- [x] Create `src/auth/litellm.ts` with LiteLLM configuration
- [x] Implement virtual key generation
- [x] Implement usage tracking per request
- [x] Implement budget enforcement
- [x] Implement rate limiting
- [x] Generate `models.json` for Pi SDK
- [x] Verify Pi SDK uses LiteLLM proxy
- [x] Verify virtual key stored in SQLite

### 3.3 Custom Kira Tools ✅
- [x] Create `src/agent/tools.ts` with custom tools
- [x] Implement `updateTaskStatus` tool
- [x] Implement `requestHumanReview` tool
- [x] Implement `logToKanban` tool
- [x] Register tools with Pi session
- [x] Verify tools callable by agent
- [x] Verify tool results returned to agent

### 3.4 Model Profiles (Bonus) ✅
- [x] Create `src/stores/model-profiles.ts` with profile storage
- [x] Create `src/routes/model-profiles.ts` with CRUD API
- [x] Default profiles: quick (haiku), normal (sonnet), pro (opus)
- [x] Support custom profile creation via API
- [x] Integrate profile selection into session start endpoint

---

## Phase 4: Git Operations (🟡 P2) ✅

### 4.1 Worktree Manager ✅
- [x] Create `src/git/worktree.ts` with worktree operations
- [x] Implement `createWorktree()` function (with optional branch creation)
- [x] Implement `deleteWorktree()` function (force remove + prune)
- [x] Integrate with simple-git
- [x] Implement `listWorktrees()` for status checks
- [x] Configurable worktree base dir (KIRA_WORKTREE_DIR env var or programmatic override)
- [x] Handle worktree conflicts gracefully (force remove fallback)
- [x] `DELETE /api/workspaces/:id/worktree` route to remove a workspace worktree

### 4.2 Workspace from PR ✅
- [x] Implement `POST /api/workspaces/from-pr` endpoint
- [x] Parse PR URL and extract owner/repo/PR number
- [x] Fetch PR branch using `gh` CLI (with helpful error if not installed/authenticated)
- [x] Create worktree on fetched branch (no branch creation needed)
- [x] Auto-create session and start agent (matching Rust from-pr behavior)
- [x] Verify workspace created with branch name `pr/<N>`
- [x] Add `findReposForWorkspace()` to workspace store for worktree path resolution

---

## Phase 5: NPX Distribution (🟠 P1)

### 5.1 Update npx-cli
- [ ] Update `npx-cli/bin/cli.js` download logic
- [ ] Point to TypeScript server package instead of Rust binary
- [ ] Update spawn logic for Node.js execution
- [ ] Verify `npx kira-code` downloads TypeScript server
- [ ] Verify server starts on correct port
- [ ] Verify frontend opens in browser
- [ ] Test on macOS
- [ ] Test on Windows
- [ ] Test on Linux

### 5.2 CI/CD Updates
- [ ] Create GitHub Action for TypeScript server build
- [ ] Add `pnpm run build` step
- [ ] Package `dist/` for distribution
- [ ] Upload artifact to R2 storage
- [ ] Verify artifact accessible by npx-cli
- [ ] Update release workflow

---

## Phase 6: Kira Pi Package (🟢 P3)

### 6.1 Create Pi Package
- [ ] Create `packages/kira-pi-package/` directory
- [ ] Add `package.json` with pi manifest
- [ ] Create `extensions/kira-tools.ts` with tool registration
- [ ] Create `skills/kira-coding.md` with default skill
- [ ] Create `prompts/workspace.md` with prompt template
- [ ] Create `models.json` with LiteLLM configuration
- [ ] Publish to npm as `@kira/pi-package`
- [ ] Verify package installable via `pi install`

---

## Phase 7: Cloud API Server (🟠 P1)

### 7.1 Project Setup
- [ ] Create `packages/cloud-api/` directory structure
- [ ] Add `package.json` with dependencies:
  - `hono@^4.12.7` - Web framework
  - `@hono/node-server@^1.14.0` - Node.js server adapter
  - `drizzle-orm@^0.43.1` - PostgreSQL ORM
  - `postgres` - PostgreSQL driver for Drizzle
  - `@hono/zod-openapi@^0.19.10` - OpenAPI + Zod
  - `zod@^3.25.76` - Schema validation
  - `jsonwebtoken` - JWT handling
  - `jwks-rsa` - Keycloak JWKS fetching
  - `@electric-sql/client` - ElectricSQL client
  - DevDependencies: `typescript@^5.9.2`, `drizzle-kit@^0.30.0`
- [ ] Add `tsconfig.json` for TypeScript (Node.js ESM, target ES2022)
- [ ] Create `drizzle.config.ts` for PostgreSQL migrations
- [ ] Verify `pnpm install` succeeds
- [ ] Verify `pnpm run build` produces `dist/index.js`

### 7.2 Database Schema
- [ ] Create `src/db/schema.ts` with Drizzle schema for kanban tables:
  - `organizations`
  - `projects`
  - `issues`
  - `issue_comments`
  - `issue_assignees`
  - `issue_tags`
  - `tags`
  - `project_statuses`
  - `users`
  - `organization_members`
  - `notifications`
  - `task_events` (agent event history)
- [ ] Copy PostgreSQL migrations from `crates/remote/migrations/`
- [ ] Verify `pnpm run db:push` creates all tables
- [ ] Configure ElectricSQL sync for all tables (REPLICA IDENTITY FULL)

### 7.3 Authentication
- [ ] Create `src/auth/jwt.ts` with JWT verification using Keycloak JWKS
- [ ] Create `src/auth/middleware.ts` with session middleware
- [ ] Implement `requireSession` middleware for protected routes
- [ ] Implement JWT validation against Keycloak public keys
- [ ] Extract user identity from JWT for request context
- [ ] Verify JWT validation with test tokens
- [ ] Verify unauthorized requests receive 401

### 7.4 ElectricSQL Proxy
- [ ] Create `src/proxy/electric.ts` with ElectricSQL proxy
- [ ] Implement shape request authentication
- [ ] Implement organization/project membership verification
- [ ] Forward shape requests to internal ElectricSQL service
- [ ] Define all 16 shapes matching Rust implementation:
  - Organizations shape
  - Projects shape
  - Issues shape
  - Issue comments shape
  - Issue assignees shape
  - Issue tags shape
  - Tags shape
  - Project statuses shape
  - Organization members shape
  - Notifications shape
  - Pull requests shape
  - Issue relationships shape
  - Issue followers shape
  - Issue comment reactions shape
  - Attachments shape
  - Workspaces shape
- [ ] Verify shape requests are authenticated
- [ ] Verify unauthorized shape requests are rejected

### 7.5 Kanban CRUD Routes
- [ ] Create `src/routes/organizations.ts` with CRUD
- [ ] Create `src/routes/projects.ts` with CRUD
- [ ] Create `src/routes/issues.ts` with CRUD
- [ ] Create `src/routes/issue-comments.ts` with CRUD
- [ ] Create `src/routes/issue-assignees.ts` with CRUD
- [ ] Create `src/routes/issue-tags.ts` with CRUD
- [ ] Create `src/routes/tags.ts` with CRUD
- [ ] Create `src/routes/project-statuses.ts` with CRUD
- [ ] Create `src/routes/organization-members.ts` with CRUD
- [ ] Implement membership checks on all routes
- [ ] Return `MutationResponse<T>` with `txid` for all mutations
- [ ] Verify CRUD operations work with authentication
- [ ] Verify `txid` is returned for ElectricSQL sync

### 7.6 Agent Event Persistence
- [ ] Create `src/routes/internal/events.ts` with event ingestion
- [ ] Implement internal secret authentication (`KIRA_INTERNAL_SECRET`)
- [ ] Create `src/stores/task-events.ts` with event storage
- [ ] Implement `POST /v1/internal/tasks/:id/events` endpoint
- [ ] Store events in `task_events` table
- [ ] Implement WebSocket fan-out to remote-web clients
- [ ] Verify events are persisted correctly
- [ ] Verify unauthorized internal requests receive 401

### 7.7 LiteLLM Token Management
- [ ] Create `src/routes/tokens.ts` with token routes
- [ ] Implement `GET /v1/user/llm-token` endpoint
- [ ] Integrate with LiteLLM admin API
- [ ] Issue short-lived proxy keys to authenticated users
- [ ] Return proxy key and URL to client
- [ ] Verify token generation works
- [ ] Verify tokens expire correctly

### 7.8 OAuth Integration (Optional - if not using Keycloak only)
- [ ] Create `src/auth/oauth.ts` with OAuth handlers
- [ ] Implement GitHub OAuth provider
- [ ] Implement Google OAuth provider (optional)
- [ ] Create callback routes for OAuth redirects
- [ ] Implement PKCE flow for frontend OAuth
- [ ] Verify OAuth login works end-to-end

### 7.9 File Attachments (Optional)
- [ ] Create `src/storage/r2.ts` with R2 storage integration
- [ ] Create `src/routes/attachments.ts` with upload/download
- [ ] Implement file upload to R2
- [ ] Implement signed URL generation for downloads
- [ ] Implement attachment metadata in database
- [ ] Verify file uploads work
- [ ] Verify downloads are authenticated

### 7.10 Server Bootstrap
- [ ] Create `src/index.ts` with server entry point
- [ ] Configure environment variables (DATABASE_URL, JWT_SECRET, etc.)
- [ ] Initialize database pool
- [ ] Run migrations on startup
- [ ] Register all routes
- [ ] Start HTTP server on configurable port
- [ ] Add health check endpoint
- [ ] Verify server starts successfully
- [ ] Verify all endpoints are accessible

### 7.11 Type Generation
- [ ] Create `src/bin/generate-types.ts` for TypeScript type generation
- [ ] Generate `shared/remote-types.ts` from Drizzle schema
- [ ] Include shape definitions in generated types
- [ ] Include mutation definitions in generated types
- [ ] Verify types are generated correctly
- [ ] Verify remote-web can consume generated types

---

## Phase 8: Cleanup (🟢 P3)

### 7.1 Remove Rust Code
- [ ] Delete `crates/server/`
- [ ] Delete `crates/executors/`
- [ ] Delete `crates/db/`
- [ ] Delete `crates/worktree-manager/`
- [ ] Delete `crates/workspace-manager/`
- [ ] Delete `crates/git/`
- [ ] Delete `crates/utils/`
- [ ] Update root `Cargo.toml`
- [ ] Delete `pnpm run generate-types` scripts
- [ ] Update CI/CD workflows (remove Rust build steps)
- [ ] Verify all tests pass

### 7.2 Documentation Updates
- [ ] Update root `README.md` with new setup instructions
- [ ] Update `AGENTS.md` with new architecture
- [ ] Create `packages/local-server/README.md` with development guide
- [ ] Update contribution guide
- [ ] Remove Rust-specific documentation

---

## Testing Tasks

### Manual Testing
- [ ] Fresh install: `npx kira-code` on new machine
- [ ] Workspace creation from git repo
- [ ] Workspace creation from PR
- [ ] Agent session start
- [ ] Agent steering during execution
- [ ] Agent abort
- [ ] Config changes persist
- [ ] Events stream in real-time
- [ ] Migration from Rust version (if applicable)

### Performance Testing
- [ ] Server startup time < 2 seconds
- [ ] API response time < 100ms for CRUD operations
- [ ] SSE event latency < 500ms
- [ ] Memory footprint during agent runs

---

## Critical Path

```
Phase 1 (P0) → Phase 2 (P1) → Phase 3 (P1) → Phase 5 (P1) → Done
                      ↓              ↓              ↓
                Phase 4 (P2)   Phase 6 (P3)   Phase 7 (P1)
                      ↓              ↓              ↓
                Phase 8 (P3) ←───────────────┘
```

**Minimum viable**: Phases 1-3 + 5 (can run agent via NPX)
**Full feature**: All phases including cloud API (Phase 7) for team collaboration

---

## Implementation Notes

### Section 1.1 Decisions

**Dependency choices:**
- **libsql over better-sqlite3**: Chose `@libsql/client` for additional features (encryption at rest, Turso remote DB support, more ALTER statements)
- **@oxc-node/core for dev**: Fast TypeScript runner using Oxc's Rust-based transformer instead of esbuild/tsx
- **@hono/zod-openapi v0.19.x**: Using v0.19.x series for Zod v3 compatibility (v1.x requires Zod v4)
- **Scalar for API docs**: Integrated `@scalar/hono-api-reference` for beautiful, interactive API documentation at `/scalar`

**Build strategy:**
- **Dev**: `node --import @oxc-node/core/register src/index.ts` - Direct TypeScript execution
- **Build**: `tsc` - Standard TypeScript compilation (no bundling needed for Node.js)
- **Type-check**: `tsc --noEmit` - Verify types without emitting

**Scripts added to package.json:**
- `dev` - Run with oxc-node transformer
- `build` - Compile TypeScript
- `start` - Run compiled JS
- `check` - Type-check only
- `db:generate`, `db:migrate`, `db:push`, `db:studio` - Drizzle Kit commands
