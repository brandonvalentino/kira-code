## Context

Kira Code is currently a Rust (Axum/Tokio) + React (TypeScript/Vite) monorepo. The local stack (`crates/server`, `packages/local-web`, `npx-cli/`) serves the developer's primary interface. The cloud stack (`crates/remote`, `packages/remote-web`) handles team sync, auth, and collaboration.

The current architecture has evolved into an unnecessary dual-process design:
- Rust HTTP server for local API + SQLite
- Planned Node.js agent-runner for Pi SDK integration
- npx-cli orchestrating both processes
- Rust cloud API with ts-rs type generation

This creates complexity without benefit. The Rust server is I/O-bound (HTTP API + SQLite), not CPU-intensive. There's no reason for two ecosystems.

**The shift**: Consolidate to a single TypeScript ecosystem. Electron for desktop (Pi SDK in-process), Node.js (Hono) for cloud API, shared types throughout.

## Goals / Non-Goals

**Goals:**
- Single TypeScript ecosystem (no Rust, no type generation)
- Electron desktop app as the primary developer interface
- Pi SDK runs in-process (no subprocess, no JSONL parsing, no WebSocket bridge)
- Native OS integration (system tray, notifications, background operation, auto-update, deep links)
- Node.js cloud API with PostgreSQL + ElectricSQL + Keycloak
- Shared types, validators, and utilities between Electron and cloud
- Smaller engineering surface area (one language, one mental model)

**Non-Goals:**
- Cloud-side agent execution (agents always run on developer's machine)
- Mobile app (remote-web serves mobile browsers)
- Multi-machine routing (one Electron app per developer for v1)
- Migrating existing Rust SQLite data (fresh install for v1)
- Per-user LiteLLM virtual keys with independent budgets (v2)
- Serverless deployment (v1 uses containerized Node.js)

## Decisions

### D1: Electron over Tauri for desktop app
**Decision**: Use Electron (not Tauri) for the desktop application.
**Rationale**: 
- Pi SDK is TypeScript — running it in-process requires Node.js
- Tauri's Rust advantage is negated when agent execution needs Node.js anyway
- Electron provides mature APIs for system tray, notifications, auto-update, deep links
- Larger ecosystem, easier hiring, more documentation
- ~150MB binary is acceptable for a daily driver developer tool

**Alternatives considered**:
- *Tauri*: Would require Pi SDK subprocess (JSONL parsing) or a Rust-native LLM client. Either negates Tauri's benefit.
- *All web/npx*: No native OS integration, closes when terminal closes, no background operation.

### D2: Pi SDK in-process, no subprocess
**Decision**: Pi SDK's `createAgentSession()` runs directly in Electron's main process. No `pi --mode rpc` subprocess, no JSONL parsing, no WebSocket bridge.
**Rationale**:
- Typed `AgentSessionEvent` objects flow directly to code
- `session.steer()` and `session.abort()` are direct method calls
- Tools are TypeScript objects injected at session creation — no file paths, no CLI flags
- Zero latency for event streaming (no IPC bridge)
- Simpler debugging (single process, single log stream)

### D3: Hono for cloud API
**Decision**: Use Hono (not Express, Fastify, or NestJS) for the cloud HTTP API.
**Rationale**:
- TypeScript-native with excellent type inference
- RPC client generation (typesafe API calls from Electron/remote-web)
- Edge-compatible (future serverless option)
- Minimal, fast, modern
- Familiar API (Express-like but typed)

**Alternatives considered**:
- *Express*: Untyped, callback-heavy, older patterns.
- *Fastify*: Good performance but more verbose type integration.
- *NestJS*: Overkill for a CRUD API with ElectricSQL sync.

### D4: SQLite via better-sqlite3 in Electron main process
**Decision**: Use `better-sqlite3` (synchronous, native bindings) for local SQLite in Electron main process.
**Rationale**:
- Synchronous API is simpler for local-first apps (no async callback hell)
- Native bindings are fast (no pure-JS overhead)
- Well-maintained, Electron-compatible
- Bun alternative (`bun:sqlite`) available if switching to Bun runtime

**Alternatives considered**:
- *sql.js*: Pure JS, slower, no native integration.
- *Prisma with SQLite*: Heavier than needed for local-first, adds ORM complexity.

### D5: ElectricSQL unchanged for cloud sync
**Decision**: Keep ElectricSQL for real-time sync between Electron app and cloud. No changes to the sync architecture.
**Rationale**:
- Already working and battle-tested
- Handles offline/online transitions gracefully
- Shapes are server-controlled (security)
- `txid` handshake ensures consistency

### D6: Zod for shared validation
**Decision**: Use Zod schemas in `packages/shared/` for validation, shared by Electron and cloud.
**Rationale**:
- TypeScript-first validation library
- Type inference from schemas (define once, use everywhere)
- Works in both Node.js (cloud) and Electron (renderer can use via IPC)
- Can generate OpenAPI specs from Zod schemas if needed

### D7: Auto-update via electron-updater
**Decision**: Use `electron-updater` (from electron-builder) for seamless auto-updates.
**Rationale**:
- Background download, prompt to restart
- Delta updates minimize download size
- Works with S3, GitHub Releases, or custom server
- Industry standard for Electron apps

### D8: System tray with background operation
**Decision**: Electron app runs in system tray. Agent sessions continue when window is closed. Notifications on completion/error.
**Rationale**:
- Daily driver apps should stay running
- Agent runs may take hours — closing window shouldn't interrupt
- System tray provides quick status visibility
- Notifications bring user back when needed

### D9: Direct HTTP POST for agent events to cloud
**Decision**: Electron app POSTs agent events to cloud API (`POST /v1/internal/tasks/:id/events`). Fire-and-forget with in-memory buffer if offline.
**Rationale**:
- Simpler than persistent WebSocket from Electron to cloud
- Works naturally with offline/online transitions
- Events are already generated in-process — just HTTP POST them
- Cloud persists and fans out to remote-web subscribers

### D10: Keycloak OAuth for cloud authentication
**Decision**: Keep Keycloak as the sole OAuth provider for the cloud (as planned in existing changes).
**Rationale**:
- Federates all identity sources internally
- Enterprises control their auth policies
- Kira maintains one OAuth integration instead of N

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   ELECTRON APP                                                               │
│   ─────────────                                                              │
│                                                                               │
│   Main Process (Node.js)                                                     │
│   ├── HTTP Server (Hono) — localhost:PORT                                    │
│   ├── SQLite (better-sqlite3)                                                │
│   │   ├── sessions, worktrees, settings, scratch                             │
│   │   └── NOT synced to cloud                                                │
│   ├── Pi SDK — createAgentSession() IN-PROCESS                               │
│   │   ├── Kira tools (updateTaskStatus, requestHumanReview, logToKanban)     │
│   │   └── Skills (markdown files in app bundle)                              │
│   ├── Git operations (simple-git CLI wrapper)                                │
│   ├── Cloud sync client:                                                     │
│   │   ├── ElectricSQL shapes for kanban (issues, projects, tags)             │
│   │   └── HTTP POST agent events → cloud                                     │
│   ├── System tray, notifications, deep links                                 │
│   └── Auto-update (electron-updater)                                         │
│                                                                               │
│   Renderer (Chromium)                                                        │
│   └── local-web (React) — same codebase as before                            │
│       ├── IPC to main process for file/git/agent operations                  │
│       └── ElectricSQL shapes for kanban sync                                 │
│                                                                               │
│   Distribution: .dmg / .exe / .AppImage / .deb                               │
│   Size: ~150MB                                                               │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   CLOUD API (Node.js + Hono)                                                 │
│   ────────────────────────                                                   │
│                                                                               │
│   HTTP Server (Hono)                                                         │
│   ├── REST API (CRUD)                                                        │
│   │   ├── /v1/issues, /v1/projects, /v1/tags, etc.                          │
│   │   ├── /v1/organizations, /v1/members, etc.                              │
│   │   └── /v1/internal/tasks/:id/events (agent events from Electron)        │
│   ├── ElectricSQL proxy — auth-gated shape subscriptions                     │
│   ├── WebSocket for agent event fan-out to remote-web                        │
│   ├── Keycloak OAuth                                                         │
│   └── LiteLLM proxy token management                                         │
│                                                                               │
│   PostgreSQL                                                                  │
│   ├── issues, projects, tags, members, etc.                                  │
│   ├── task_events (agent run history)                                        │
│   └── ElectricSQL replication enabled                                        │
│                                                                               │
│   ElectricSQL (internal)                                                     │
│   └── Streams shape updates to clients                                       │
│                                                                               │
│   Keycloak (identity)                                                        │
│   └── OAuth provider, federates GitHub/Google/enterprise SSO                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (ElectricSQL + API)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   REMOTE-WEB (React SPA)                                                     │
│   ────────────────────────                                                   │
│                                                                               │
│   Kanban Board (full CRUD)                                                   │
│   ├── Real-time sync via ElectricSQL                                        │
│   ├── Comments, reactions, attachments                                      │
│   └── Assign, tag, move columns                                              │
│                                                                               │
│   Agent Run Viewer (read-only)                                               │
│   ├── Shows task history with stored events                                  │
│   ├── Thinking blocks, tool calls, diffs                                    │
│   └── No live streaming, no steering, no start button                        │
│                                                                               │
│   Team & Org Management                                                      │
│   ├── Invite members, manage roles                                          │
│   └── Project settings                                                       │
│                                                                               │
│   Target users: Managers, mobile users, non-developers                       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Model

### Local SQLite (Electron main process)

```
sessions
├── id (UUID, primary key)
├── project_id (UUID, references cloud)
├── worktree_path (text)
├── agent_session_id (text, Pi's sessionId)
├── agent_session_file (text, Pi's sessionFile path)
├── status (text: pending, running, completed, interrupted, failed)
├── created_at, updated_at

worktrees
├── id (UUID, primary key)
├── session_id (UUID, references sessions)
├── path (text, absolute path)
├── branch_name (text)
├── base_commit (text)
├── created_at

settings
├── key (text, primary key)
├── value (text, JSON serialized)
├── updated_at

scratch
├── id (UUID, primary key)
├── content (text)
├── created_at, updated_at
```

### Cloud PostgreSQL (unchanged from current)

```
issues, projects, tags, members, etc. — same schema
task_events — stores agent events for history
```

## Risks / Trade-offs

- **Electron binary size (~150MB)** → Acceptable for a daily driver. Users install once. Auto-updates are deltas.
- **Memory footprint** → Disable GPU acceleration for headless runs. Limit renderer memory. Background runs don't need active renderer.
- **No Rust data migration** → V1 requires fresh install. Document in release notes. v2 can add migration tool.
- **Single process crash loses in-flight session** → Pi SDK session state is in-memory. Mark as interrupted on crash. Git worktrees preserve file state.
- **Better-sqlite3 native compilation** → Use prebuilds via electron-rebuild. CI tests compiled binary.
- **Hono maturity** → Newer than Express, but well-maintained, TypeScript-native, edge-compatible. Active community.
- **Larger hiring pool for TypeScript** → Mitigated by this being a net positive. Easier to find Node.js devs than Rust devs.

## Migration Plan

1. **Scaffold packages/** — Create `electron-app/`, `cloud-api/`, `shared/` directories
2. **Build shared types** — Port `crates/api-types` to TypeScript in `packages/shared/`
3. **Build cloud-api** — Port `crates/remote` routes to Hono, test against existing PostgreSQL
4. **Build Electron main process** — HTTP server, SQLite, Pi SDK integration, system tray
5. **Port local-web to Electron renderer** — Minimal changes, IPC bridges for main process calls
6. **Delete Rust codebase** — Once Electron app is feature-complete
7. **Update CI/CD** — Remove Rust builds, add Electron packaging and cloud-api Docker builds
8. **Update documentation** — Architecture diagrams, contribution guide, onboarding

## Open Questions

- **Bun vs Node.js runtime for Electron main process?** Bun is faster but electron compatibility is newer. Start with Node.js, consider Bun later.
- **IPC design for renderer↔main communication?** Use Electron's IPC (contextBridge + ipcRenderer) or expose HTTP server as bridge? HTTP is simpler for the existing local-web codebase.
- **File watching in Electron?** Use chokidar (Node.js) or native macOS FSEvents? Chokidar is cross-platform and battle-tested.