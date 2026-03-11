## Why

Kira Code (formerly Vibe Kanban) is pivoting hard to a **cloud-first platform**. The old architecture ran everything locally — a Rust HTTP server, a local web UI, SQLite, and a binary bootstrapper (`npx-cli`) that downloaded platform-specific Rust binaries from R2. That model made sense when the product was `npx vibe-kanban`. It makes no sense for a cloud product.

The current executor system also maintains bespoke wrappers for ~10 AI coding agents (`claude-code`, `amp`, `codex`, `gemini-cli`, etc.), each parsing a different CLI's stdout in an ad-hoc way. High maintenance cost, inconsistent UX.

This change does two things:

1. **Rebrand** from "Vibe Kanban" → "Kira Code" across all code, metadata, and docs.
2. **Hard pivot to cloud-first** — eliminate the entire local stack (Rust daemon, local web UI, binary bootstrapper, relay tunnel client) and replace it with a minimal **Node.js agent runtime** that runs on the developer's machine, connects to the cloud over a plain WebSocket, and executes agents locally against the user's filesystem using the Pi SDK.

## What Changes

- **BREAKING** — Remove all legacy executor modules (`claude_code.rs`, `amp.rs`, `codex.rs`, `gemini_cli.rs`, etc.).
- **BREAKING** — Delete `crates/server` (local Rust HTTP server), `crates/deployment`, `crates/local-deployment`, `crates/db` (local SQLite), `packages/local-web` (local React UI), and `npx-cli/` (binary bootstrapper). These are replaced entirely.
- **BREAKING** — Delete the relay tunnel client (`crates/relay-tunnel` client.rs, `crates/relay-control`). The relay infrastructure was built to expose a local HTTP server to the cloud. There is no local HTTP server anymore.
- Implement **`packages/agent-runtime`** — a pure Node.js package (TypeScript) that becomes the new `npx kira-code` entrypoint. It opens a persistent outbound WebSocket to the Kira cloud backend, waits for agent run commands, and executes them using `@mariozechner/pi-coding-agent` SDK.
- Implement **`packages/pi-base`** — an npm package bundling all base skills, the Kira extension (with tools that call back to the cloud API), and prompt templates. `agent-runtime` depends on it. This is the v1 "fleet config" — versioned and distributed via npm, no git hosting required.
- **Agent execution remains local** — the Pi SDK runs on the developer's machine, accesses their filesystem directly, and streams all events back to the cloud UI through the WebSocket connection.
- Add a **WebSocket agent endpoint** to `crates/remote`: `WS /v1/agent/connect` — authenticated, persistent, bidirectional. The cloud backend routes `start_agent`, `steer`, and `abort` messages to the connected local runtime, and receives Pi SDK events back for storage and fan-out to the UI.
- Shift all UI/auth/data to `packages/remote-web` + `crates/remote` as the sole production stack.
- Rebrand all user-facing strings, package names, and documentation.

## Capabilities

### New Capabilities

- `agent-runtime`: Node.js local agent runtime — Pi SDK integration, outbound WebSocket to cloud, session lifecycle management, worktree management.
- `pi-base`: Bundled npm package containing base skills, Kira extension tools (`update_task_status`, `request_human_review`, `log_to_kanban`), and prompt templates. Versioned with Kira releases.
- `cloud-agent-ws`: WebSocket endpoint in `crates/remote` for agent runtime ↔ cloud communication. Handles authentication, message routing, and event persistence.
- `rebrand`: Rename "Vibe Kanban" → "Kira Code" across all code, assets, docs, and metadata.

### Removed Capabilities

- `local-stack`: `crates/server`, `crates/deployment`, `crates/local-deployment`, `crates/db`, `packages/local-web`, `npx-cli/` — all deleted.
- `relay-tunnel-client`: `relay_tunnel::client`, `crates/relay-control` — deleted. The relay server binary (`crates/relay-tunnel` server-bin) is also removed as it has no remaining purpose.
- `legacy-executors`: All per-agent executor modules — deleted.

### Modified Capabilities

- `cloud-auth`: Auth layer already present in `crates/remote`; extended to cover the new agent WebSocket endpoint.

## Impact

- **`npx kira-code`** — now runs `packages/agent-runtime` directly (Node.js, no binary download). No platform detection, no R2 downloads, no zip extraction.
- **`crates/remote/`** — new `WS /v1/agent/connect` endpoint; new agent session state management; event persistence and fan-out to UI WebSocket subscribers.
- **`packages/remote-web/`** — new agent run UI: thinking blocks, tool call cards, diff viewer, steering input. Primary frontend going forward.
- **`packages/web-core/`** — shared agent event rendering components.
- **`packages/agent-runtime/`** — new package. Pi SDK wrapper, WebSocket client, worktree management, session lifecycle.
- **`packages/pi-base/`** — new package. Skills, Kira extension, prompts.
- **Deletions** — `crates/server`, `crates/deployment`, `crates/local-deployment`, `crates/db`, `crates/relay-control`, `crates/relay-tunnel` (entire crate), `packages/local-web`, `npx-cli/`.
- **Docs & Assets** — all "Vibe Kanban" references replaced with "Kira Code".
