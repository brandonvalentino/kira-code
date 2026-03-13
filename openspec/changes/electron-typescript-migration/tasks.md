## Implementation Tasks

Priority legend:
- 🔴 **P0** - Critical path, blocks other work
- 🟠 **P1** - Core functionality, needed for MVP
- 🟡 **P2** - Important, enhances experience
- 🟢 **P3** - Nice-to-have, polish

---

## Phase 1: Foundation (🔴 P0)

### 1.1 Project Setup
- [ ] Create `packages/local-server/` directory structure
- [ ] Add `package.json` with dependencies (Hono, Drizzle, better-sqlite3, Pi SDK)
- [ ] Add `tsconfig.json` for TypeScript
- [ ] Create basic `src/index.ts` entry point
- [ ] Verify `pnpm install` succeeds
- [ ] Verify `pnpm run build` produces `dist/index.js`

### 1.2 Database Layer
- [ ] Create `src/db/schema.ts` with Drizzle schema (match Rust exactly)
- [ ] Create `src/db/index.ts` with database connection
- [ ] Create `migrations/` directory with SQL migrations
- [ ] Implement database path resolution (dev vs production)
- [ ] Verify database file created on first run
- [ ] Verify all tables created via migrations
- [ ] Test insert and query for workspace
- [ ] Test insert and query for repo
- [ ] Verify foreign key constraints work

### 1.3 HTTP Server
- [ ] Create `src/server.ts` with Hono server
- [ ] Add CORS middleware (allow localhost:3000, localhost:5173)
- [ ] Add logger middleware
- [ ] Create `src/routes/health.ts` with `/health` endpoint
- [ ] Create `src/utils/response.ts` with API response helpers
- [ ] Verify server starts on configurable port
- [ ] Verify `/health` returns `{ "status": "ok" }`

---

## Phase 2: Core API Routes (🟠 P1)

### 2.1 Workspace Routes
- [ ] Create `src/stores/workspaces.ts` with CRUD operations
- [ ] Create `src/routes/workspaces.ts` with routes
- [ ] Implement `GET /api/workspaces` (list with status)
- [ ] Implement `GET /api/workspaces/:id` (get by ID)
- [ ] Implement `POST /api/workspaces` (create)
- [ ] Implement `PATCH /api/workspaces/:id` (update)
- [ ] Implement `DELETE /api/workspaces/:id` (delete)
- [ ] Verify workspaces sorted by `updated_at DESC`
- [ ] Verify `is_running` and `is_errored` calculated correctly

### 2.2 Repo Routes
- [ ] Create `src/stores/repos.ts` with CRUD operations
- [ ] Create `src/routes/repos.ts` with routes
- [ ] Implement `GET /api/repos` (list all)
- [ ] Implement `GET /api/repos/recent` (by recent usage)
- [ ] Implement `POST /api/repos` (add repo)
- [ ] Implement `PATCH /api/repos/:id` (update)
- [ ] Implement `DELETE /api/repos/:id` (remove)
- [ ] Verify path validation (must be git repo)
- [ ] Verify repo name extracted from path

### 2.3 Session Routes
- [ ] Create `src/stores/sessions.ts` with CRUD operations
- [ ] Create `src/routes/sessions.ts` with routes
- [ ] Implement `GET /api/workspaces/:id/sessions` (list)
- [ ] Implement `POST /api/workspaces/:id/sessions` (create)
- [ ] Implement `GET /api/sessions/:id` (get details)
- [ ] Implement `POST /api/sessions/:id/start` (start agent)
- [ ] Implement `POST /api/sessions/:id/steer` (steering message)
- [ ] Implement `POST /api/sessions/:id/abort` (abort agent)
- [ ] Verify sessions ordered by last used
- [ ] Verify Pi session file created

### 2.4 Config Routes
- [ ] Create `src/stores/settings.ts` with CRUD operations
- [ ] Create `src/routes/config.ts` with routes
- [ ] Implement `GET /api/config` (get config)
- [ ] Implement `PATCH /api/config` (update config)
- [ ] Implement `GET /api/info` (user system info)
- [ ] Verify config persisted to `config.json`
- [ ] Verify defaults returned for missing fields
- [ ] Verify config version migration

### 2.5 Events Route (SSE)
- [ ] Create `src/utils/event-bus.ts` with EventEmitter
- [ ] Create `src/routes/events.ts` with SSE endpoint
- [ ] Implement `GET /api/events` SSE stream
- [ ] Verify SSE connection established
- [ ] Verify keep-alive every 30 seconds
- [ ] Verify reconnection handled gracefully

---

## Phase 3: Pi SDK Integration (🟠 P1)

### 3.1 Pi Session Manager
- [ ] Create `src/agent/pi-session.ts` wrapper
- [ ] Integrate `createAgentSession()` from Pi SDK
- [ ] Implement session initialization with workspace cwd
- [ ] Implement `prompt()`, `steer()`, `followUp()`, `abort()` methods
- [ ] Forward Pi events to event bus
- [ ] Verify Pi session file created in data directory
- [ ] Verify events forwarded to SSE stream

### 3.2 LiteLLM Integration
- [ ] Create `src/auth/virtual-keys.ts` with virtual key management
- [ ] Create `src/auth/litellm.ts` with LiteLLM configuration
- [ ] Implement virtual key generation
- [ ] Implement usage tracking per request
- [ ] Implement budget enforcement
- [ ] Implement rate limiting
- [ ] Generate `models.json` for Pi SDK
- [ ] Verify Pi SDK uses LiteLLM proxy
- [ ] Verify virtual key stored in SQLite

### 3.3 Custom Kira Tools
- [ ] Create `src/agent/tools.ts` with custom tools
- [ ] Implement `updateTaskStatus` tool
- [ ] Implement `requestHumanReview` tool
- [ ] Implement `logToKanban` tool
- [ ] Register tools with Pi session
- [ ] Verify tools callable by agent
- [ ] Verify tool results returned to agent

---

## Phase 4: Git Operations (🟡 P2)

### 4.1 Worktree Manager
- [ ] Create `src/git/worktree.ts` with worktree operations
- [ ] Implement `createWorktree()` function
- [ ] Implement `deleteWorktree()` function
- [ ] Integrate with simple-git
- [ ] Verify worktree created from existing branch
- [ ] Verify worktree created with new branch
- [ ] Verify worktree deleted and cleanup
- [ ] Handle worktree conflicts gracefully

### 4.2 Workspace from PR
- [ ] Implement `POST /api/workspaces/from-pr` endpoint
- [ ] Parse PR URL and extract repo/branch
- [ ] Create worktree from PR branch
- [ ] Link to cloud issue (if applicable)
- [ ] Verify workspace created successfully

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

## Phase 7: Cleanup (🟢 P3)

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
                      ↓              ↓
                Phase 4 (P2)   Phase 6 (P3)
                      ↓              ↓
                Phase 7 (P3) ←────────┘
```

**Minimum viable**: Phases 1-3 + 5 (can run agent via NPX)
**Full feature**: All phases (Git operations, Pi package, Rust cleanup)
