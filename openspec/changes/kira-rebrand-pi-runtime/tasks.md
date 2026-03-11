## 1. Rebrand — String & Metadata Replacement

- [x] 1.1 Run automated replace of all "Vibe Kanban" / "vibe-kanban" / "vibekanban" / "VibeKanban" / "VK_" occurrences across Rust sources, TypeScript sources, JSON, TOML, Markdown, and Dockerfiles
- [x] 1.2 Update `name`, `description`, and `repository` in all `Cargo.toml` crate manifests
- [x] 1.3 Update `name`, `description`, and `repository` in all `package.json` files
- [x] 1.4 Update Docker image tags and CI workflow names to `kira-code`
- [x] 1.5 Add `VK_` → `KIRA_` env-var fallback shim with deprecation warning in `crates/remote` config parsing
- [x] 1.6 Verify: `grep -r "vibe.kanban\|VibeKanban\|vibekanban" --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.toml" --include="*.json"` returns zero matches

## 2. Delete the Local Stack

- [ ] 2.1 Delete `crates/server/` entirely; remove from `Cargo.toml` workspace members
- [ ] 2.2 Delete `crates/deployment/`; remove from workspace
- [ ] 2.3 Delete `crates/local-deployment/`; remove from workspace
- [ ] 2.4 Delete `crates/db/` (local SQLite); remove from workspace
- [ ] 2.5 Delete `crates/relay-tunnel/` (entire crate — both client and server-bin); remove from workspace
- [ ] 2.6 Delete `crates/relay-control/`; remove from workspace
- [ ] 2.7 Delete `packages/local-web/`; remove from `pnpm-workspace.yaml`
- [ ] 2.8 Delete `npx-cli/`; remove from `pnpm-workspace.yaml`
- [ ] 2.9 Remove all `use relay_tunnel`, `use relay_control`, `use server`, `use db` references from remaining crates
- [ ] 2.10 Verify `cargo build --workspace` and `pnpm run check` pass after deletions

## 3. `packages/pi-base` — Bundled Skills & Kira Extension

- [ ] 3.1 Scaffold `packages/pi-base/` as a new TypeScript workspace package with `package.json`; add `@mariozechner/pi-coding-agent` as a dependency
- [ ] 3.2 Write base skills as markdown files in `packages/pi-base/skills/` — start with: `coding-best-practices`, `git-workflow`, `testing`, `code-review`
- [ ] 3.3 Implement `packages/pi-base/src/extension/index.ts` — Pi extension entry point that registers the three Kira tools using the Pi extension API
- [ ] 3.4 Implement `update_task_status` tool: validate status enum, `PATCH /api/tasks/:id` on the Kira cloud backend
- [ ] 3.5 Implement `request_human_review` tool: `POST /api/tasks/:id/reviews`, return structured response
- [ ] 3.6 Implement `log_to_kanban` tool: validate log level, `POST /api/tasks/:id/logs`
- [ ] 3.7 Implement `packages/pi-base/src/index.ts` — exports `createKiraResourceLoader(opts: { apiUrl: string, taskToken: string, cwd: string })` that returns a configured `DefaultResourceLoader` with bundled skills and the Kira extension registered
- [ ] 3.8 Write unit tests for each tool's input validation using Vitest
- [ ] 3.9 Verify `createKiraResourceLoader()` loads all skills and extension without errors in a test

## 4. `packages/agent-runtime` — Local Node.js Entrypoint

- [ ] 4.1 Scaffold `packages/agent-runtime/` as a new TypeScript workspace package; set `"bin": { "kira-code": "./dist/index.js" }` in `package.json`; add `@mariozechner/pi-coding-agent` and `packages/pi-base` as dependencies
- [ ] 4.2 Implement `src/cloud-client.ts` — authenticated outbound WebSocket to `wss://<cloud>/v1/agent/connect`; exponential backoff reconnect loop (initial 1 s, max 30 s); sends `{ type: "hello", version }` on connect
- [ ] 4.3 Implement `src/worktree-manager.ts` — `create(repoPath, taskId)` shells out to `git worktree add ~/.kira/worktrees/<taskId> -b kira/<taskId>`; `remove(taskId)` calls `git worktree remove --force`
- [ ] 4.4 Implement `src/session-manager.ts` — handles `start_agent` message: creates worktree, calls `createAgentSession()` with `createKiraResourceLoader()`, subscribes to events and forwards them over the cloud WebSocket as `{ type: "agent_event", taskId, event }`
- [ ] 4.5 Handle `steer` message from cloud: call `session.steer(message)` on the running session for the given `taskId`
- [ ] 4.6 Handle `abort` message from cloud: call `session.abort()` and clean up worktree
- [ ] 4.7 Implement `src/auth.ts` — on startup, read auth token from `~/.kira/auth.json`; if missing, print login URL and poll until authenticated
- [ ] 4.8 Implement `src/index.ts` — entrypoint: parse args, load auth, connect to cloud, log "Connected to Kira. Waiting for tasks..."
- [ ] 4.9 Add `tsconfig.json`, build script (`tsc`), and `pnpm run build` to `package.json`
- [ ] 4.10 Verify `node dist/index.js` starts and connects to a local mock WebSocket server

## 5. `crates/remote` — Agent WebSocket Endpoint

- [ ] 5.1 Add `WS /v1/agent/connect` route to `crates/remote/src/routes/`; require bearer token auth on upgrade
- [ ] 5.2 Implement in-memory agent registry: `AgentRegistry` mapping `machine_id → WebSocket sender`; stored in `AppState`
- [ ] 5.3 On `hello` message from runtime: upsert machine record in DB, register in `AgentRegistry`, mark online
- [ ] 5.4 On disconnect: mark machine offline in DB, remove from registry
- [ ] 5.5 Add `POST /v1/tasks/:id/run` route: looks up assigned machine in registry, sends `{ type: "start_agent", taskId, taskContext, worktreePath, taskToken }` to local runtime WebSocket
- [ ] 5.6 Add `POST /v1/tasks/:id/steer` route: looks up machine, sends `{ type: "steer", taskId, message }` to local runtime
- [ ] 5.7 Add `POST /v1/tasks/:id/abort` route: sends `{ type: "abort", taskId }` to local runtime
- [ ] 5.8 Implement event persistence: on `agent_event` message received from runtime, insert into `task_events(task_id, event_type, payload, created_at)` table; add DB migration
- [ ] 5.9 Implement UI fan-out: on `agent_event`, broadcast to all WebSocket subscribers watching that `task_id` (UI connections via `GET /v1/tasks/:id/events` WS route)
- [ ] 5.10 Add `GET /v1/tasks/:id/events` WebSocket route for UI — streams persisted events on connect (replay), then live events
- [ ] 5.11 Add `POST /v1/tasks/:id/extension-token` route — issues a task-scoped JWT (2-hour expiry) for use by the Kira extension tools; include `task_id` claim
- [ ] 5.12 Add middleware to extension-facing routes (`/api/tasks/:id/*`) that validates task-scoped JWT and enforces `task_id` scope
- [ ] 5.13 Write integration tests: runtime connects → machine marked online; `start_agent` routed to correct runtime; `agent_event` persisted and fanned out; machine marked offline on disconnect

## 6. `packages/remote-web` — Agent Run UI

- [ ] 6.1 Add `AgentEventStream` component to `packages/web-core/src/` — connects to `WS /v1/tasks/:id/events`, replays history on mount, renders live events
- [ ] 6.2 Add `ThinkingBlock` component — collapsible, renders `thinking_delta` text with a distinct visual treatment
- [ ] 6.3 Add `ToolCallCard` component — shows tool name, input params, status (running / success / error), and output
- [ ] 6.4 Add `DiffViewer` component — renders unified diff for file edits produced by the agent
- [ ] 6.5 Integrate `AgentEventStream` into the task detail view in `packages/remote-web/src/`
- [ ] 6.6 Add steering UI to task detail view — text input + send button; `POST /v1/tasks/:id/steer` on submit; disable when no active run
- [ ] 6.7 Add "Run" button to task detail view — `POST /v1/tasks/:id/run`; show connected machine name

## 7. Auth Hardening

- [ ] 7.1 Verify `trusted-key-auth` middleware is applied to all `/v1/*` routes in `crates/remote` including the new agent WebSocket endpoint
- [ ] 7.2 Ensure `GET /health` is excluded from auth middleware
- [ ] 7.3 Verify existing GitHub OAuth flow (login → callback → JWT issue) works end-to-end
- [ ] 7.4 Write integration tests: valid token → 200/101; missing token → 401; invalid token → 401; `/health` → 200 unauthenticated

## 8. Final Verification & Cleanup

- [ ] 8.1 Run `pnpm run generate-types` and commit any updated `shared/types.ts`
- [ ] 8.2 Run `pnpm run format` (cargo fmt + Prettier) and fix any issues
- [ ] 8.3 Run `pnpm run lint` (ESLint + cargo clippy) and resolve all warnings
- [ ] 8.4 Run `pnpm run check` and `pnpm run backend:check` — zero errors
- [ ] 8.5 Run `cargo test --workspace` — all tests pass
- [ ] 8.6 Manual end-to-end smoke test: `npx kira-code` → connects to cloud → receive `start_agent` → agent runs → events appear in UI → steer message reaches agent
- [ ] 8.7 Update `README.md` — remove local install instructions, add cloud onboarding flow, document `npx kira-code` as the local agent runner
