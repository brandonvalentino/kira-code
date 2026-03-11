## Context

Kira Code is a Rust (Axum/Tokio) + React (TypeScript/Vite) monorepo pivoting from a local-first product to a cloud-first platform. The cloud stack (`crates/remote`, `packages/remote-web`) runs on PostgreSQL and already has an auth layer (JWT/OAuth). The local stack (`crates/server`, `packages/local-web`, `npx-cli/`) is being deleted entirely.

The Pi Coding Agent (`@mariozechner/pi-coding-agent`) exposes a TypeScript SDK (`createAgentSession`) that manages the full agent lifecycle — LLM routing, tool execution, session persistence, event streaming, and steering — in-process. No subprocess spawning, no JSONL parsing.

## Goals / Non-Goals

**Goals:**
- Delete the entire local Rust stack and replace it with a single Node.js package.
- Run agent execution locally on the developer's machine (filesystem access is the core value).
- Connect local agent runtime to cloud via a plain outbound WebSocket — no tunneling infrastructure.
- Bundle all base skills and Kira-specific tools in a versioned npm package (`packages/pi-base`).
- Rebrand all user-facing strings and metadata from "Vibe Kanban" to "Kira Code".

**Non-Goals:**
- Server-side agent execution (cloud sandboxing) — deferred.
- Fleet config UI or per-org skill customization — deferred to v2; v1 uses the bundled `pi-base` package.
- Billing, usage metering, multi-region infrastructure.
- Migrating existing local SQLite data.

## Decisions

### D1: Node.js SDK over Rust RPC subprocess
**Decision**: Use `@mariozechner/pi-coding-agent` SDK directly in a Node.js process (`packages/agent-runtime`). Delete `PiExecutor` Rust struct and all JSONL parsing.
**Rationale**: The SDK gives type-safe, in-process access to `createAgentSession()`, `session.subscribe()`, `session.steer()`, and custom tool injection. There is no translation layer — events flow from the Pi SDK directly to the WebSocket as JSON. Writing custom tools in TypeScript is trivial (`ToolDefinition` + `execute: async () => ...`). The Rust RPC approach required building and maintaining three separate things: a Rust JSONL parser, a TypeScript extension package, and a git-backed skill distribution system. The SDK approach collapses all of that into two TypeScript packages.
**Alternatives considered**:
- *Pi `--mode rpc` subprocess from Rust* — Requires JSONL parsing in Rust, separate TS extension package, complex skill materialisation before spawn. High maintenance.
- *Pi `--mode rpc` subprocess from Node.js* — Avoids Rust but still requires JSONL parsing and subprocess management. SDK is strictly better.

### D2: Plain outbound WebSocket replaces relay tunnel
**Decision**: Delete `crates/relay-tunnel` (entire crate) and `crates/relay-control`. The agent runtime opens a plain outbound `wss://` WebSocket to `crates/remote` on startup. `crates/remote` adds `WS /v1/agent/connect`.
**Rationale**: The relay tunnel was purpose-built to expose a *local HTTP server* to the cloud. There is no local HTTP server in the new architecture. The agent runtime only needs bidirectional message passing (receive commands, stream events). A plain authenticated WebSocket is the simplest correct solution. No Yamux, no HTTP proxying, no relay registry.
**Alternatives considered**:
- *Keep relay tunnel, replace Rust client with Node.js Yamux client* — Adds Yamux dependency for zero benefit. The relay's HTTP-proxy capability is unused.
- *SSE for events, REST for commands* — Unidirectional SSE can't handle steering without polling. WebSocket is cleaner.

### D3: `packages/pi-base` as v1 fleet config
**Decision**: Bundle all base skills, the Kira extension, and prompt templates in a single versioned npm package (`packages/pi-base`). Ship it as a workspace package depended on by `agent-runtime`. No git hosting, no per-org repos, no dynamic injection.
**Rationale**: For v1, all users get the same capabilities. Versioning is handled by the npm release — upgrading `pi-base` ships new skills to all users on their next `npx kira-code` run. Eliminates the entire Pi Fleet Config backend (git repo provisioning, skill CRUD API, settings.json materialisation). Dramatically reduces scope and attack surface.
**Alternatives considered**:
- *Git-backed per-org skill repos* — Correct for v2 multi-tenant customisation; over-engineered for v1.
- *Fetch skills from cloud API at runtime* — Adds latency to every agent start; requires a skill management backend; unnecessary for v1.

### D4: Delete `npx-cli/`, replace with direct Node.js entrypoint
**Decision**: Remove `npx-cli/` entirely. `packages/agent-runtime/package.json` sets `"bin": { "kira-code": "./dist/index.js" }`. `npx kira-code` runs the Node.js entrypoint directly.
**Rationale**: `npx-cli/` exists solely to download and run a platform-specific Rust binary. With no Rust binary to distribute, the entire bootstrapper is dead code. Node.js is already on the machine (it ran `npx`). Removing it eliminates: platform detection, architecture mapping, R2 downloads, zip extraction, binary caching, and version management — hundreds of lines of bootstrapping code.
**Alternatives considered**:
- *Keep npx-cli, use it to download a Node.js bundle* — Pointless indirection. npm handles Node.js package distribution natively.

### D5: Worktree management moves to Node.js
**Decision**: The agent runtime manages worktrees using `child_process` calls to `git worktree add/remove`. The existing `crates/worktree-manager` and `crates/git` logic is rewritten in TypeScript in `packages/agent-runtime`.
**Rationale**: With no local Rust process, worktree lifecycle must live in the same process as the agent. Git operations are simple enough to shell out to `git` CLI from Node.js without needing to compile Rust.
**Alternatives considered**:
- *Keep a minimal Rust binary just for worktree management* — Adds a Rust dependency back to the local machine for marginal benefit.
- *Use `isomorphic-git` (JS git library)* — Avoids shelling out but adds significant complexity for worktree operations that `git` CLI handles trivially.

### D6: Agent event persistence in `crates/remote`
**Decision**: When the cloud backend receives Pi SDK events over the agent WebSocket, it persists them to PostgreSQL and fans them out to any connected UI WebSocket subscribers (the user's browser tabs).
**Rationale**: Events must be persisted so users can reload the page mid-run, join from another device, or review completed runs. Fan-out to multiple subscribers supports team visibility.

### D7: Rebrand string replacement
**Decision**: Automated grep-and-replace for "Vibe Kanban" / "vibe-kanban" / "vibekanban" / "VibeKanban" / "VK_" across all sources, followed by manual review of user-visible strings.

### D8: Replace GitHub/Google OAuth with Keycloak
**Decision**: Remove `GitHubOAuthProvider` and `GoogleOAuthProvider` entirely. Replace with a single `KeycloakOAuthProvider` using the `openidconnect` crate. Keycloak becomes the sole identity provider.
**Rationale**: Keycloak is a production-grade identity broker — it can federate GitHub, Google, LDAP, SAML, and any other identity source internally. Instead of Kira Code maintaining N OAuth integrations, we delegate all identity concerns to Keycloak. The codebase gets simpler (one provider, one code path) and enterprises get full control over their auth policies without code changes to Kira.

The `openidconnect` crate is the right library here because:
- **OIDC discovery** (`/.well-known/openid-configuration`) handles Keycloak's per-realm endpoint variation automatically — no hardcoded URLs.
- **ID token verification** with JWKS is built in — replaces manual `fetch_user()` calls to provider APIs.
- **77k+ downloads, 507 GitHub stars, actively maintained** — the de facto Rust OIDC library.
- Our async Axum stack is compatible: `CoreProviderMetadata::discover_async()` + `request_async()`.

**What gets removed**:
- `GitHubOAuthProvider` and `GoogleOAuthProvider` from `provider.rs`
- `GITHUB_OAUTH_CLIENT_ID/SECRET` and `GOOGLE_OAUTH_CLIENT_ID/SECRET` env vars
- `github` and `google` fields from `AuthConfig` in `config.rs`
- GitHub/Google login buttons from `packages/remote-web`

**What gets added**:
- `KeycloakOAuthProvider` implementing the existing `AuthorizationProvider` trait via `openidconnect`
- `KEYCLOAK_ISSUER_URL` (e.g. `https://keycloak.example.com/realms/kira`), `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` env vars
- `keycloak` field in `AuthConfig`; `ConfigError::NoKeycloakConfig` replaces `NoOAuthProviders`
- Single "Sign in with Keycloak" button in `packages/remote-web`

**Alternatives considered**:
- *Keep GitHub/Google, add Keycloak alongside* — Keeps three providers to maintain; defeats the purpose of centralising identity.
- *`axum-keycloak-auth`* — Only handles JWT validation middleware, not the full OAuth2 authorization code flow needed by `OAuthHandoffService`.
- *Manual implementation* — Brittle against Keycloak's JWKS rotation and OIDC discovery document changes.

## Architecture

```
CLOUD
  [remote-web]  ←REST/WS→  [crates/remote]
                                  ↑
                         WS /v1/agent/connect
                                  ↑
LOCAL
  npx kira-code → [packages/agent-runtime]
                      ↓
                  [packages/pi-base]
                  (skills, extension, prompts)
                      ↓
                  createAgentSession()
                      ↓
                  [user filesystem / worktree]
```

## Risks / Trade-offs

- **Node.js startup latency** → `npx` cold-start adds ~1–2 s vs a compiled binary. Mitigation: acceptable for a developer tool; `npx` caches the package after first run.
- **Pi SDK version coupling** → `agent-runtime` is coupled to a specific `@mariozechner/pi-coding-agent` version. Mitigation: pin in `package.json`; update deliberately with each Kira release.
- **WebSocket reconnection** → The local runtime must handle cloud backend restarts gracefully. Mitigation: exponential backoff reconnect loop in `agent-runtime`.
- **Extension tool trust** → Kira extension tools run inside the agent's context and call cloud API endpoints. Mitigation: tools authenticate with a scoped short-lived JWT (task-scoped, 2-hour expiry), not the user's full token.
- **Rebrand churn** → "Vibe Kanban" appears in ~200 files. Mitigation: automated replace pass first, then targeted manual review.

## Migration Plan

1. **Rebrand pass** — automated replace across all sources.
2. **Delete local stack** — remove `crates/server`, `crates/deployment`, `crates/local-deployment`, `crates/db`, `crates/relay-tunnel`, `crates/relay-control`, `packages/local-web`, `npx-cli/`.
3. **`packages/pi-base`** — scaffold with base skills and Kira extension tools.
4. **`packages/agent-runtime`** — implement WebSocket client, session manager, worktree manager, Pi SDK integration.
5. **`crates/remote` agent endpoint** — add `WS /v1/agent/connect`, session state, event persistence, UI fan-out.
6. **`packages/remote-web` agent UI** — thinking blocks, tool call cards, diff viewer, steering input.
7. **Auth hardening** — gate agent WebSocket endpoint; issue task-scoped extension tokens.
8. **Final verification** — format, lint, type-check, tests.

## Open Questions

- **Extension token issuance**: Should the agent runtime request a task-scoped token per-run from the cloud, or should the cloud push the token with the `start_agent` command? Push is simpler.
- **Worktree location**: `~/.kira/worktrees/<task-id>/` or inside the project repo? Project repo is more discoverable; `~/.kira/` is cleaner for isolation.
- **Multiple concurrent runs**: Should one `npx kira-code` process handle multiple simultaneous agent sessions, or one process per run? One process, multiple sessions via `SessionManager` is simpler for v1.
