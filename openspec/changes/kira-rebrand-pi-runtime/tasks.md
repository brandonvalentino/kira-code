## 1. Rebrand — String & Metadata Replacement

- [ ] 1.1 Run automated replace of all "Vibe Kanban" / "vibe-kanban" / "vibekanban" / "VibeKanban" / "VK_" occurrences across Rust sources, TypeScript sources, JSON, TOML, Markdown, and Dockerfiles
- [ ] 1.2 Update `name`, `description`, and `repository` in all `Cargo.toml` crate manifests to use `kira-` prefix
- [ ] 1.3 Update `name`, `description`, and `repository` in all `package.json` files (local-web, remote-web, web-core, npx-cli)
- [ ] 1.4 Update Docker image tags and CI workflow names to `kira-code`
- [ ] 1.5 Add `VK_` → `KIRA_` env-var fallback shim with deprecation warning in `crates/server` and `crates/remote` config parsing
- [ ] 1.6 Verify: `grep -r "vibe.kanban\|VibeKanban\|vibekanban" --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.toml" --include="*.json"` returns zero matches

## 2. Bundle Pi as a Managed Binary

- [ ] 2.1 Update the R2 build workflow (CI) to download `@mariozechner/pi-coding-agent` at build time, extract the `pi` binary, and include it in each platform zip alongside `kira-code` and `kira-code-mcp`
- [ ] 2.2 Pin the Pi version in the build workflow (e.g., `PI_VERSION=0.57.1` env var); document the update process
- [ ] 2.3 Extend `npx-cli/bin/download.js` / `ensureBinary` to extract `pi` (or `pi.exe` on Windows) from the zip into `~/.kira/bin/`
- [ ] 2.4 Add a startup version check in the Rust backend: run `~/.kira/bin/pi --version`, compare against `KIRA_EXPECTED_PI_VERSION` (compiled-in constant), log a warning and surface a user message on mismatch
- [ ] 2.5 Add `KIRA_PI_BIN` env var override to `ExecutionEnv` so the managed path can be overridden for development/testing
- [ ] 2.6 Verify on macOS arm64, macOS x64, Linux x64, Linux arm64, Windows x64: `ensureBinary` correctly extracts and runs `pi`

## 3. PiExecutor — Rust Backend

- [ ] 3.1 Create `crates/executors/src/executors/pi.rs` with `PiExecutor` struct; implement `spawn()` using `tokio::process::Command` resolving `pi` from `KIRA_PI_BIN` or `~/.kira/bin/pi`, with `--mode rpc` and optional `--extension` args
- [ ] 3.2 Define `PiEvent` enum (`Thinking`, `ToolCall`, `ToolResult`, `Edit`, `Progress`, `Complete`, `Error`, `Unknown`) with `serde` derive
- [ ] 3.3 Implement the stdout reader loop: read lines → deserialize `PiEvent` → send on `tokio::sync::mpsc` channel
- [ ] 3.4 Implement `PiExecutor::steer(message)`: write `{"type":"steer","message":"..."}` JSONL line to stdin; return `ProcessNotRunning` error if process has exited
- [ ] 3.5 Implement process termination: `stop()` sends SIGTERM, waits 10 s, sends SIGKILL; capture stderr on unexpected exit
- [ ] 3.6 Add `PiExecutor` as a new variant to `CodingAgent` enum in `mod.rs`; update `ExecutorFactory` to route `CodingAgent::Pi` to `PiExecutor`
- [ ] 3.7 Write unit tests for `PiEvent` deserialization covering all event types including malformed input
- [ ] 3.8 Write integration test: spawn a mock `pi` script that emits a sequence of JSONL events; assert `PiExecutor` emits matching typed events

## 4. PiExecutor — Frontend Streaming

- [ ] 4.1 Add SSE/WebSocket message variants for Pi events in `crates/server/src/` and `crates/remote/src/routes/` (mirroring `PiEvent` types)
- [ ] 4.2 Wire `PiExecutor` event stream into the existing task execution SSE/WebSocket handler in `crates/server`
- [ ] 4.3 Add `PiEventStream` React component to `packages/web-core/src/` that renders a list of Pi events
- [ ] 4.4 Add child display components: `ThinkingBlock`, `ToolCallCard`, `DiffViewer`, `ProgressBar` in `packages/web-core/src/`
- [ ] 4.5 Integrate `PiEventStream` into the task detail view in `packages/remote-web/src/`
- [ ] 4.6 Add "Steer" input UI (text field + send button) to the task detail view that POSTs a steering message to the backend
- [ ] 4.7 Add backend route `POST /tasks/:id/steer` that calls `PiExecutor::steer()` on the running executor for that task

## 5. Remove Legacy Executors

- [ ] 5.1 Delete executor files: `amp.rs`, `claude.rs`, `codex.rs`, `copilot.rs`, `cursor.rs`, `droid.rs`, `gemini.rs`, `opencode.rs`, `qwen.rs` and their sub-directories
- [ ] 5.2 Remove corresponding `mod` declarations and `use` imports from `mod.rs`
- [ ] 5.3 Remove deleted variants from `CodingAgent` enum; update `#[enum_dispatch]` impls
- [ ] 5.4 Add a DB migration that maps legacy `CodingAgent` values to `PI` for existing rows (with a log warning)
- [ ] 5.5 Confirm `cargo build --workspace` and `cargo test --workspace` pass after deletion

## 6. Kira Pi Extension (TypeScript Package)

- [ ] 6.1 Scaffold `packages/pi-extension/` as a new TypeScript package with `package.json` name `@kira-code/pi-extension`
- [ ] 6.2 Implement extension entry point that registers the three tools with the Pi extension API
- [ ] 6.3 Implement `update_task_status` tool: validate status enum, call `PATCH /api/tasks/:id`, return result
- [ ] 6.4 Implement `request_human_review` tool: POST review request, poll or await resolution with 30-minute timeout
- [ ] 6.5 Implement `log_to_kanban` tool: validate log level enum, POST log entry to Kira API
- [ ] 6.6 Add backend routes for extension tools: `PATCH /api/tasks/:id`, `POST /api/tasks/:id/reviews`, `POST /api/tasks/:id/logs`
- [ ] 6.7 Add unit tests for each tool's input validation (invalid status, invalid log level) using Vitest
- [ ] 6.8 Add `--extension @kira-code/pi-extension` to the `pi` invocation in `PiExecutor::spawn()` and inject `KIRA_API_URL` + `KIRA_EXTENSION_TOKEN` into the child process environment

## 7. Pi Fleet Config — Backend

- [ ] 7.1 Add `skill_repos` and `fleet_configs` tables to `crates/db`: `skill_repos(org_id, repo_path, created_at)` and `fleet_configs(org_id, default_model, default_provider, default_thinking_level, extra_packages jsonb, project_id nullable)`
- [ ] 7.2 Implement `provision_skill_repo(org_id)` in `crates/git`: initialise a bare git repo at `<data-dir>/skill-repos/<org-id>.git` with an initial empty commit on `main`; store the path in `skill_repos`
- [ ] 7.3 Call `provision_skill_repo` automatically when a new org is created (hook into org creation flow in `crates/remote`)
- [ ] 7.4 Implement `GET /api/orgs/:id/fleet/skills` — list skills by reading top-level directories from the skill repo's `main` branch; parse `SKILL.md` frontmatter for name + description
- [ ] 7.5 Implement `POST /api/orgs/:id/fleet/skills` — write files to a new skill directory and commit to `main`; body: `{ name, files: [{ path, content }] }`
- [ ] 7.6 Implement `GET /api/orgs/:id/fleet/skills/:name/files` — list all files in the skill directory with their contents
- [ ] 7.7 Implement `PUT /api/orgs/:id/fleet/skills/:name/files/:filepath` — update a single file in the skill directory and commit
- [ ] 7.8 Implement `DELETE /api/orgs/:id/fleet/skills/:name` — remove the skill directory and commit
- [ ] 7.9 Implement `GET/PUT /api/orgs/:id/fleet/config` — read/write org-level Pi settings in `fleet_configs`
- [ ] 7.10 Implement `GET/PUT /api/projects/:id/fleet/config` — read/write project-level overrides in `fleet_configs`
- [ ] 7.11 Implement `GET /api/orgs/:id/fleet/config/resolved` and `GET /api/projects/:id/fleet/config/resolved` — merge project overrides over org defaults; include skill repo git URL in response
- [ ] 7.12 Gate all fleet config routes with admin-role check; return `403` for non-admins

## 7b. Pi Fleet Config — PiExecutor Integration

- [ ] 7b.1 In `PiExecutor::spawn()`, fetch resolved fleet config from Kira API before starting the process (use a short timeout, e.g., 5 s)
- [ ] 7b.2 Serialize the resolved config into a valid Pi `settings.json` structure: `packages` (with `git:<repo-url>@main`), `defaultModel`, `defaultProvider`, `defaultThinkingLevel`, `extensions`
- [ ] 7b.3 Write the serialized `settings.json` to `worktree/.pi/settings.json`; create `.pi/` directory if it doesn't exist
- [ ] 7b.4 Implement fallback: if the fleet config fetch fails, write a minimal `settings.json` with only `@kira-code/pi-extension` and log a warning
- [ ] 7b.5 On process exit (any outcome), delete `worktree/.pi/settings.json`; do not delete `.pi/` if it contained pre-existing files
- [ ] 7b.6 Write integration test: mock fleet config API returns a config with one skill repo; assert `settings.json` is written correctly and cleaned up after process exit

## 7c. Pi Fleet Config — Frontend

- [ ] 7c.1 Add "Fleet Config" route and nav item to `packages/remote-web` (admin-only, hidden for non-admins)
- [ ] 7c.2 Build skill list view: fetch `GET /api/orgs/:id/fleet/skills`, display cards with skill name + description
- [ ] 7c.3 Build skill detail / editor view: list all files in the skill, render each in a code editor (Monaco or CodeMirror); save triggers `PUT` per changed file
- [ ] 7c.4 Build "New Skill" flow: name input + initial `SKILL.md` template; submit calls `POST /api/orgs/:id/fleet/skills`
- [ ] 7c.5 Add "Add file" button in skill editor: enter a relative path (e.g., `scripts/run.sh`) and paste/upload content; commits via `PUT`
- [ ] 7c.6 Add delete skill button with confirmation dialog; calls `DELETE /api/orgs/:id/fleet/skills/:name`
- [ ] 7c.7 Build Pi Settings panel: dropdowns for default model/provider/thinking level; additional npm/git packages list; save calls `PUT /api/orgs/:id/fleet/config`

## 8. Cloud Auth

- [ ] 8.1 Apply `trusted-key-auth` middleware to all `/v1/*` router branches in `crates/remote/src/routes/mod.rs`
- [ ] 8.2 Ensure `GET /health` route is excluded from auth middleware
- [ ] 8.3 Verify existing GitHub OAuth routes in `crates/remote/src/auth/` work end-to-end: login → callback → JWT issue
- [ ] 8.4 Implement extension token issuance: add `POST /api/tasks/:id/extension-token` route that returns a task-scoped JWT (2-hour expiry)
- [ ] 8.5 Add middleware to extension-facing routes that validates the task-scoped JWT and enforces task-ID scope
- [ ] 8.6 Write integration tests: valid API key → 200; missing key → 401; invalid key → 401; `/health` → 200 unauthenticated

## 9. Final Verification & Cleanup

- [ ] 9.1 Run `pnpm run format` (cargo fmt + Prettier) and fix any formatting issues
- [ ] 9.2 Run `pnpm run lint` (ESLint + cargo clippy) and resolve all warnings
- [ ] 9.3 Run `pnpm run check` and `pnpm run backend:check` and confirm zero errors
- [ ] 9.4 Run `cargo test --workspace` and confirm all tests pass
- [ ] 9.5 Run `pnpm run generate-types` and commit any updated `shared/types.ts`
- [ ] 9.6 Update `README.md` and `docs/` to reflect new "Kira Code" name, Pi runtime, and removed legacy agents
