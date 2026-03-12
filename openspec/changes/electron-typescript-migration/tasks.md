## 1. Project Structure & Shared Foundation

- [ ] 1.1 Create `packages/shared/` directory with `package.json`, `tsconfig.json`
- [ ] 1.2 Create `packages/shared/types.ts` with core types (Issue, Project, Tag, Session, etc.)
- [ ] 1.3 Create `packages/shared/schemas.ts` with Zod validation schemas
- [ ] 1.4 Create `packages/shared/utils.ts` with shared utility functions
- [ ] 1.5 Update `pnpm-workspace.yaml` to include new packages
- [ ] 1.6 Remove ts-rs dependencies from remaining Rust crates (if any shared)
- [ ] 1.7 Delete `crates/api-types/` (replaced by `packages/shared/`)

## 2. Cloud API (packages/cloud-api/)

- [ ] 2.1 Create `packages/cloud-api/` directory with `package.json`, `tsconfig.json`
- [ ] 2.2 Setup Hono server with basic middleware (CORS, logging, error handling)
- [ ] 2.3 Create database connection module with PostgreSQL pool (using `pg` or `postgres.js`)
- [ ] 2.4 Port ElectricSQL proxy routes from `crates/remote/src/routes/electric_proxy.rs`
- [ ] 2.5 Port shape definitions from `crates/remote/src/shapes.rs` to TypeScript
- [ ] 2.6 Port mutation routes (issues, projects, tags, members, etc.) from `crates/remote/src/routes/`
- [ ] 2.7 Implement Keycloak OAuth integration (port from `crates/remote/src/auth/`)
- [ ] 2.8 Implement JWT validation middleware
- [ ] 2.9 Implement agent event persistence (`POST /v1/internal/tasks/:id/events`)
- [ ] 2.10 Implement WebSocket fan-out for agent events to remote-web
- [ ] 2.11 Implement LiteLLM proxy token endpoint (`GET /v1/user/llm-token`)
- [ ] 2.12 Implement internal server-to-server auth (`KIRA_INTERNAL_SECRET`)
- [ ] 2.13 Port database migrations from `crates/remote/migrations/` to TypeScript migrations
- [ ] 2.14 Create Dockerfile for cloud-api deployment
- [ ] 2.15 Update docker-compose.yml to use cloud-api instead of crates/remote
- [ ] 2.16 Add integration tests for API routes

## 3. Electron App (packages/electron-app/)

- [ ] 3.1 Create `packages/electron-app/` directory with `package.json`, `tsconfig.json`
- [ ] 3.2 Setup Electron main process entry point (`src/main/index.ts`)
- [ ] 3.3 Create Electron renderer entry point (port from `packages/local-web/`)
- [ ] 3.4 Implement HTTP server in main process (Hono on localhost)
- [ ] 3.5 Implement SQLite database with better-sqlite3
- [ ] 3.6 Create database migrations for local tables (sessions, worktrees, settings, scratch)
- [ ] 3.7 Implement session store (CRUD for agent sessions)
- [ ] 3.8 Implement worktree manager (git worktree operations via simple-git)
- [ ] 3.9 Implement settings store (key-value with JSON values)
- [ ] 3.10 Implement scratch notes store
- [ ] 3.11 Integrate Pi SDK (`@mariozechner/pi-coding-agent`)
- [ ] 3.12 Implement Kira tools (`updateTaskStatus`, `requestHumanReview`, `logToKanban`)
- [ ] 3.13 Implement Kira skills loader (markdown files bundled in app)
- [ ] 3.14 Implement agent session manager (start, steer, abort, resume)
- [ ] 3.15 Implement agent event streaming to renderer (IPC or HTTP WebSocket)
- [ ] 3.16 Implement agent event push to cloud (HTTP POST)
- [ ] 3.17 Implement ElectricSQL client for kanban sync
- [ ] 3.18 Implement system tray integration
- [ ] 3.19 Implement notifications (native OS notifications)
- [ ] 3.20 Implement auto-update with electron-updater
- [ ] 3.21 Implement deep links (`kira-code://` URL scheme)
- [ ] 3.22 Implement file associations (optional, platform-specific)
- [ ] 3.23 Implement Keycloak OAuth flow for cloud sync
- [ ] 3.24 Configure electron-builder for platform builds (.dmg, .exe, .AppImage, .deb)
- [ ] 3.25 Implement IPC bridge for renderer ↔ main communication
- [ ] 3.26 Implement terminal integration (port from current terminal routes)
- [ ] 3.27 Implement file tree operations (port from filesystem routes)

## 4. Renderer (packages/electron-app/src/renderer/)

- [ ] 4.1 Port `packages/local-web/` to Electron renderer (minimal changes)
- [ ] 4.2 Update API client to use Electron main process HTTP server
- [ ] 4.3 Update WebSocket connection to use main process bridge
- [ ] 4.4 Remove npx-cli specific code (if any)
- [ ] 4.5 Update agent execution UI to render Pi SDK events
- [ ] 4.6 Add Electron-specific UI (update available banner, system tray status)
- [ ] 4.7 Test all existing UI functionality in Electron context

## 5. Remote Web (packages/remote-web/)

- [ ] 5.1 Update API client to use new cloud-api endpoints
- [ ] 5.2 Remove relay-related code (already done in previous change, verify)
- [ ] 5.3 Implement agent run history viewer
- [ ] 5.4 Implement live agent event streaming via WebSocket
- [ ] 5.5 Remove any local-only UI remnants
- [ ] 5.6 Update OAuth flow for Keycloak
- [ ] 5.7 Test all kanban functionality

## 6. Web Core (packages/web-core/)

- [ ] 6.1 Remove any Rust-specific types or utilities
- [ ] 6.2 Update to use `packages/shared/` types
- [ ] 6.3 Add agent event rendering components (ThinkingBlock, ToolCallCard, DiffViewer)
- [ ] 6.4 Test component library with both local and remote frontends

## 7. Delete Rust Codebase

- [ ] 7.1 Delete `crates/server/`
- [ ] 7.2 Delete `crates/executors/`
- [ ] 7.3 Delete `crates/db/`
- [ ] 7.4 Delete `crates/remote/` (after cloud-api is complete)
- [ ] 7.5 Delete `crates/relay-tunnel/` (if not already deleted)
- [ ] 7.6 Delete `crates/relay-control/` (if not already deleted)
- [ ] 7.7 Delete `crates/deployment/` (if not already deleted)
- [ ] 7.8 Delete `crates/local-deployment/` (if not already deleted)
- [ ] 7.9 Delete `crates/worktree-manager/` (ported to TypeScript)
- [ ] 7.10 Delete `crates/workspace-manager/` (ported to TypeScript)
- [ ] 7.11 Delete `crates/git/` (ported to TypeScript)
- [ ] 7.12 Delete `crates/utils/` (ported to TypeScript)
- [ ] 7.13 Delete `crates/trusted-key-auth/` (no longer needed)
- [ ] 7.14 Delete `crates/mcp/` (evaluate if still needed or port to TypeScript)
- [ ] 7.15 Delete `crates/review/` (evaluate if still needed or port to TypeScript)
- [ ] 7.16 Delete `crates/server-info/` (no longer needed)
- [ ] 7.17 Delete `crates/git-host/` (evaluate if still needed)
- [ ] 7.18 Delete `crates/relay-tunnel/` (if not already deleted)
- [ ] 7.19 Delete `npx-cli/`
- [ ] 7.20 Update root `Cargo.toml` to remove deleted crates
- [ ] 7.21 Delete `shared/types.ts` generation scripts (replaced by `packages/shared/`)
- [ ] 7.22 Delete `shared/remote-types.ts` generation scripts
- [ ] 7.23 Delete `shared/schemas/` (if Rust-specific)

## 8. CI/CD Updates

- [ ] 8.1 Remove Rust build steps from GitHub Actions
- [ ] 8.2 Add TypeScript build steps
- [ ] 8.3 Add Electron packaging steps (macOS, Windows, Linux)
- [ ] 8.4 Add cloud-api Docker build and push steps
- [ ] 8.5 Update release workflow for Electron artifacts
- [ ] 8.6 Remove `pnpm run generate-types` and `pnpm run remote:generate-types`
- [ ] 8.7 Add `pnpm run typecheck` to CI
- [ ] 8.8 Update test workflows for TypeScript tests

## 9. Documentation Updates

- [ ] 9.1 Update root `AGENTS.md` with new architecture
- [ ] 9.2 Update `README.md` with new setup instructions
- [ ] 9.3 Create `packages/electron-app/README.md` with development guide
- [ ] 9.4 Create `packages/cloud-api/README.md` with API documentation
- [ ] 9.5 Create `packages/shared/README.md` with type usage guide
- [ ] 9.6 Update `docs/` with new architecture diagrams
- [ ] 9.7 Update contribution guide for TypeScript-only codebase
- [ ] 9.8 Remove any Rust-specific documentation

## 10. Testing & Verification

- [ ] 10.1 Write unit tests for `packages/shared/` utilities
- [ ] 10.2 Write unit tests for `packages/cloud-api/` routes
- [ ] 10.3 Write unit tests for Electron main process modules
- [ ] 10.4 Write integration tests for agent execution flow
- [ ] 10.5 Write E2E tests for Electron app (Playwright or Spectron)
- [ ] 10.6 Manual testing: Electron app launch and UI
- [ ] 10.7 Manual testing: Agent session start, steer, abort
- [ ] 10.8 Manual testing: Cloud sync (ElectricSQL)
- [ ] 10.9 Manual testing: Remote-web kanban and agent history
- [ ] 10.10 Manual testing: Auto-update flow
- [ ] 10.11 Manual testing: Deep links
- [ ] 10.12 Manual testing: System tray and notifications
- [ ] 10.13 Manual testing: Offline operation and sync resume
- [ ] 10.14 Performance testing: Electron app startup time
- [ ] 10.15 Performance testing: Memory footprint during agent runs