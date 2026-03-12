## Why

Kira Code's current architecture runs a Rust HTTP server (`crates/server`) alongside a planned Node.js agent-runner process, orchestrated by `npx-cli`. This dual-process design introduces unnecessary complexity: two build pipelines, two binaries to distribute, WebSocket bridge communication, shared secret management, and restart logic. The Rust server provides no CPU-intensive functionality that justifies its complexity—it's an I/O-bound HTTP API with SQLite persistence.

Meanwhile, the cloud backend (`crates/remote`) is written in Rust, requiring ts-rs type generation and maintaining two separate ecosystems (Rust + TypeScript). This creates friction: type sync issues, no code sharing between local and cloud, and a smaller hiring pool.

**The opportunity**: Consolidate to a single TypeScript ecosystem. Electron for the desktop app (Pi SDK in-process, native OS integration), Node.js for the cloud API, shared types and validation throughout.

## What Changes

- **BREAKING** — Delete the entire Rust codebase (`crates/server`, `crates/executors`, `crates/db`, `crates/remote`, etc.)
- **BREAKING** — Delete `npx-cli` as a distribution mechanism (replaced by native Electron app)
- **BREAKING** — Delete all per-agent executor modules (replaced by Pi SDK in-process)
- **BREAKING** — Delete relay tunnel infrastructure (no longer needed)
- Add `packages/electron-app/` — Electron main process with HTTP server, SQLite, Pi SDK, system tray, notifications, auto-update
- Add `packages/cloud-api/` — Node.js cloud API (Hono) replacing `crates/remote`
- Add `packages/shared/` — TypeScript types, Zod validators, shared utilities used by both Electron and cloud
- Migrate `packages/local-web/` to Electron renderer (same React codebase, served locally)
- Keep `packages/remote-web/` — Cloud SPA for kanban, team management, agent run history (read-only)
- Keep `packages/web-core/` — Shared React components
- Replace ts-rs type generation with native TypeScript types in `packages/shared/`

## Capabilities

### New Capabilities

- `electron-desktop-app`: Native desktop application with system tray, notifications, background operation, auto-update, deep links, file associations. Single binary distribution (.dmg, .exe, .AppImage, .deb). Pi SDK runs in-process with zero IPC bridge.
- `node-cloud-api`: Node.js HTTP API (Hono) for cloud backend. PostgreSQL + ElectricSQL + Keycloak OAuth. Event persistence, LiteLLM proxy token management, team management. Replaces `crates/remote`.
- `shared-typescript-ecosystem`: Unified TypeScript codebase with native type sharing. `packages/shared/` contains types, Zod validators, and utilities used by both Electron app and cloud API. No type generation scripts, no ts-rs, no sync issues.

### Modified Capabilities

- `agent-execution`: Agent runs via Pi SDK in-process within Electron main process. No subprocess spawning, no JSONL parsing, no WebSocket bridge. Typed `AgentSessionEvent` objects flow directly to renderer. Steering and abort via direct method calls.
- `local-data-persistence`: SQLite persistence via better-sqlite3 or bun:sqlite in Electron main process. Sessions, worktrees, settings, scratch stored locally. No Rust database layer.
- `cloud-sync`: Electron app syncs kanban data (issues, projects, tags) via ElectricSQL shapes to cloud. Agent events pushed to cloud via HTTP POST for persistence and team visibility. Works offline, syncs when connected.
- `remote-web-ui`: Cloud SPA shows kanban (full CRUD), team management, and agent run history (read-only). No live agent execution, no workspace view, no terminal. Target users: managers, mobile users, non-developers.

### Removed Capabilities

- `rust-local-server`: `crates/server` deleted entirely. HTTP API, SQLite, worktree management all move to Electron main process.
- `rust-executors`: All per-agent executor modules (`claude.rs`, `cursor.rs`, `codex.rs`, etc.) deleted. Replaced by Pi SDK in-process.
- `npx-cli-distribution`: Deleted. Replaced by native Electron app distribution with auto-update.
- `relay-tunnel`: `crates/relay-tunnel`, `crates/relay-control` deleted. Cloud communication is direct HTTP + ElectricSQL.
- `ts-rs-type-generation`: No more generate-types scripts. Types are native TypeScript.