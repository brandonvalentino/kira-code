## Why

Kira Code (formerly Vibe Kanban) is pivoting from a local-first multi-agent CLI wrapper to a centralized, Cloud-first platform. The current architecture maintains bespoke wrappers for half a dozen AI coding agents (`claude-code`, `amp`, `codex`, `gemini-cli`, etc.), creating high maintenance overhead while delivering an inconsistent user experience. By adopting Pi as the single execution runtime and shifting infrastructure focus to the remote/cloud stack, Kira can deliver a more reliable, scalable, and maintainable product to teams.

## What Changes

- **BREAKING** — Remove all legacy executor modules (`crates/executors/src/executors/claude_code.rs`, `amp.rs`, `codex.rs`, `gemini_cli.rs`, etc.) and replace with a single `PiExecutor` that communicates via Pi's `--mode rpc` JSONL protocol.
- **BREAKING** — Rebrand from "Vibe Kanban" to "Kira Code" across all user-facing strings, metadata, package names, and documentation.
- Implement the **Kira-Pi Bridge**: a Rust struct (`PiExecutor`) that manages `pi` process lifecycle, reads JSONL events from stdout, and maps them to Kira's frontend state (thinking blocks, tool calls, diff views, progress).
- Add **steering support**: relay interruption/guidance messages from the Kira UI back into the running `pi` process via stdin.
- **Silent Pi install**: bundle the `pi` binary inside the existing Kira npx-cli download artifact (same mechanism as `kira-code-mcp`). Users never install or manage `pi` manually — Kira treats it as an internal managed service.
- Agent execution remains **local** (runs on the developer's machine via `crates/server`), connected to the cloud UI through the existing `relay-tunnel` infrastructure.
- Shift primary UI/auth focus from `packages/local-web` + `crates/server` to `packages/remote-web` + `crates/remote`.
- Introduce an **Auth layer** (trusted API key / OIDC) to replace the current no-auth local model.
- Plan migration path from SQLite to PostgreSQL for multi-tenant scalability.
- Design a **Kira Pi Extension** (TypeScript): a custom Pi extension that exposes Kira-specific tools to the agent (`update_task_status`, `request_human_review`, `log_to_kanban`).
- Introduce **Pi Fleet Config**: a centralized store in Kira where org admins manage the Pi skills, extensions, and model settings used by every agent run. Skills live in a Kira-managed private git repo per org; `PiExecutor` materializes a `settings.json` pointing at that repo before spawning `pi`, so Pi clones/pulls the skills natively. Every developer on the team gets identical agent capabilities without any local configuration.

## Capabilities

### New Capabilities

- `pi-executor`: Rust backend integration with the Pi RPC runtime — silent binary management, process lifecycle, JSONL event parsing, stdin/stdout bridge, and steering support.
- `kira-pi-extension`: TypeScript Pi extension exposing Kira-specific agent tools (`update_task_status`, `request_human_review`, `log_to_kanban`).
- `pi-fleet-config`: Centralized org-level Pi configuration store — git-backed skill repo per org, model/extension settings, materialized into each worktree before agent spawn so all team members use identical Pi capabilities.
- `cloud-auth`: Auth layer for multi-tenant remote deployments (API key + OIDC support).
- `rebrand`: Rename from "Vibe Kanban" → "Kira Code" across all code, assets, docs, and metadata.

### Modified Capabilities

<!-- No existing spec-level capabilities are being changed; all prior specs are greenfield. -->

## Impact

- **`npx-cli/`** — `pi` npm package bundled alongside `kira-code` and `kira-code-mcp` in the R2 download artifact; `ensureBinary` extended to extract and version-check `pi` at startup.
- **`crates/executors/`** — Major refactor: legacy executor files deleted, `PiExecutor` added, `ExecutorFactory` simplified to single backend. `PiExecutor` resolves `pi` from the managed cache path (`~/.kira/bin/pi`), not `PATH`.
- **`crates/server/` & `crates/remote/`** — New process-management routes and WebSocket/SSE streaming for Pi JSONL events; auth middleware added to remote stack; fleet config API (CRUD for org Pi settings + skill repo management).
- **`crates/git` / `crates/git-host`** — Extended to provision and manage per-org skill git repos; Kira acts as a lightweight git host for skill content.
- **`packages/web-core/`** — New UI state for Pi event types (thinking blocks, tool call cards, diff viewer); steering/interrupt UX.
- **`packages/remote-web/`** — Primary focus of frontend work going forward; updated branding.
- **`packages/local-web/`** — Deprioritized; kept functional but receives no new features.
- **Dependencies** — Pi bundled as a versioned npm artifact (no runtime npm install); PostgreSQL driver (`sqlx` feature flag) added; OIDC library TBD.
- **Docs & Assets** — All "Vibe Kanban" references replaced with "Kira Code".
