## Why

Kira Code's current Rust backend (`crates/server`) provides HTTP API + SQLite but requires maintaining two ecosystems (Rust + TypeScript). The Rust server is I/O-bound (HTTP API + SQLite), not CPU-intensive, making TypeScript a better fit for a unified codebase.

**The opportunity**: Replace the Rust backend with TypeScript while keeping `npx kira-code` as the delivery mechanism. Users get the same experience with a simpler engineering surface area.

**Key decision**: Use Pi SDK (`@mariozechner/pi-coding-agent`) as the unified agent runtime, replacing all Rust executors (Claude, Codex, Gemini, etc.) with a single TypeScript-native agent.

**Note**: This is v1 - NPX-based local web app. Electron desktop app is deferred to a future change.

## What Changes

- **BREAKING** — Delete Rust backend crates (`crates/server`, `crates/executors`, `crates/db`, `crates/worktree-manager`, `crates/workspace-manager`, `crates/git`)
- **BREAKING** — Delete ts-rs type generation scripts
- Add `packages/local-server/` — TypeScript HTTP server (Hono) with SQLite (Drizzle ORM)
- Add `packages/kira-pi-package/` — Pi package with Kira tools, skills, and model configuration
- Update `npx-cli/` — Download and run TypeScript server instead of Rust binary
- Keep `packages/local-web/` — Frontend unchanged, now talks to TypeScript server
- Keep `packages/web-core/` — Shared React components unchanged
- Keep `packages/remote-web/` — Cloud kanban SPA (separate product)
- Keep `packages/cloud-api/` — Cloud backend (separate product)

## Capabilities

### New Capabilities

- `typescript-local-server`: Node.js HTTP server (Hono) with SQLite (Drizzle ORM). Runs via `npx kira-code`. Same API as Rust server, TypeScript implementation.
- `pi-sdk-integration`: Pi SDK (`@mariozechner/pi-coding-agent`) as unified agent runtime. Replaces all Rust executors. Single agent with configurable models.
- `litellm-auth`: LiteLLM proxy with virtual API keys. Users subscribe to Kira Code, receive virtual keys with usage limits and budget tracking.

### Modified Capabilities

- `agent-execution`: Agent runs via Pi SDK as child process spawned by TypeScript server. Events streamed via SSE to frontend. Steering/abort via HTTP endpoints.
- `local-data-persistence`: SQLite via better-sqlite3 + Drizzle ORM. Same schema as Rust version. Migrations on startup.
- `npx-distribution`: `npx kira-code` downloads TypeScript server package instead of Rust binary. Same UX, different implementation.

### Removed Capabilities

- `rust-local-server`: `crates/server` deleted. HTTP API moves to TypeScript.
- `rust-executors`: All per-agent executor modules deleted. Replaced by Pi SDK.
- `rust-database`: `crates/db` deleted. SQLite via Drizzle ORM.
- `rust-worktree-manager`: Git worktree operations via simple-git in TypeScript.
- `ts-rs-type-generation`: No more type generation. Native TypeScript types.

## Migration Path

**For existing users:**
1. Install new version: `npx kira-code@latest`
2. TypeScript server auto-migrates SQLite schema on first run
3. Existing workspaces, repos, sessions preserved
4. Config migrated from Rust format to TypeScript format

**For developers:**
1. Delete Rust crates from monorepo
2. Add `packages/local-server/` with TypeScript implementation
3. Update CI/CD to build TypeScript instead of Rust
4. Update npx-cli download logic

## Success Criteria

- [ ] `npx kira-code` runs TypeScript server
- [ ] Can create workspace and run agent
- [ ] All existing API endpoints work
- [ ] Events stream to frontend via SSE
- [ ] Existing user data migrates automatically
- [ ] Rust code deleted
- [ ] Tests pass
