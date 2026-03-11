## Context

Kira Code is a Rust (Axum/Tokio) + React (TypeScript/Vite) monorepo. The current executor system uses an `enum_dispatch` pattern over a `CodingAgent` enum with ~10 variants (ClaudeCode, Amp, Gemini, Codex, etc.), each mapping to a separate module in `crates/executors/src/executors/`. Every executor wraps a CLI tool's stdin/stdout in an ad-hoc way, yielding inconsistent event parsing, duplicated process-management code, and high per-agent maintenance cost.

The remote stack (`crates/remote`, `packages/remote-web`) already runs on PostgreSQL + ElectricSQL and has an auth layer (JWT/OAuth). The local stack (`crates/server`, `packages/local-web`) uses SQLite and no auth. Agent processes run locally on the developer's machine via `crates/server` and connect to the cloud UI through `crates/relay-tunnel` — this hybrid model is preserved.

Pi Coding Agent (`pi`) exposes an `--mode rpc` interface: the caller spawns `pi --mode rpc`, writes JSONL requests to stdin, and reads JSONL events from stdout. This gives us a single, well-defined protocol for all LLM providers that Pi supports (Anthropic, OpenAI, Groq, Gemini, etc.). Pi is distributed as an npm package (`@mariozechner/pi-coding-agent`) and will be bundled inside Kira's existing download artifact — identical to how `kira-code-mcp` is managed today.

## Goals / Non-Goals

**Goals:**
- Replace all legacy executor modules with a single `PiExecutor` that communicates via Pi RPC JSONL.
- Stream Pi events (thinking, tool calls, progress, diffs) to the Kira frontend via WebSocket/SSE.
- Support steering: pass interruption/guidance messages from the UI back to the running `pi` process via stdin.
- **Silently manage the `pi` binary**: bundle it in Kira's npx-cli download artifact; auto-install/update at startup via `ensureBinary`, identical to the existing `kira-code-mcp` pattern.
- Expose Kira-specific tools to the agent via a custom Pi extension (`kira-pi-extension`).
- Add auth (API key + OIDC) to the remote stack.
- Rebrand all user-facing strings and package metadata from "Vibe Kanban" to "Kira Code".

**Non-Goals:**
- Migrating existing SQLite data to PostgreSQL for current local users (out of scope for this change; local stack is deprioritized).
- Implementing billing, usage metering, or multi-region infrastructure.
- Building a full IDE extension; editor access is via Remote SSH / VS Code Web links only.
- Supporting Pi's interactive/TUI modes; only `--mode rpc` is used.

## Decisions

### D1: Pi RPC as the single executor protocol
**Decision**: Delete all legacy executor modules. Implement one `PiExecutor` struct.
**Rationale**: Maintaining 10+ bespoke CLI wrappers is unsustainable. Pi already handles provider-agnostic LLM routing, tool call execution, and streaming. Adopting Pi RPC removes thousands of lines of duplicated glue code.
**Alternatives considered**:
- *Keep multiple executors, add Pi as one more* — Increases maintenance burden further; doesn't deliver the architectural clarity needed.
- *Write a custom LLM orchestrator* — Too much scope; Pi already solves this problem well.

### D2: JSONL event mapping via typed Rust enum
**Decision**: Define a `PiEvent` enum in `crates/executors` that covers all Pi RPC output event types (`thinking`, `tool_call`, `tool_result`, `progress`, `edit`, `complete`, `error`). Deserialize stdout lines into `PiEvent` using `serde_json`.
**Rationale**: Typed events allow pattern matching in routing code and ensure compile-time exhaustiveness. Frontend receives a structured SSE/WebSocket stream derived from these types.
**Alternatives considered**:
- *Pass raw JSONL to frontend* — Frontend would need to understand Pi internals; tight coupling.
- *Generic `serde_json::Value`* — Loses type safety and makes routing logic fragile.

### D3: Kira Pi Extension delivered as an npm package
**Decision**: Implement the Kira extension as a TypeScript npm package (`@kira-code/pi-extension`) using Pi's extension API. The Rust backend installs/invokes it by passing `--extension @kira-code/pi-extension` to `pi`.
**Rationale**: Pi extensions are already TypeScript-native, so writing the extension in TypeScript avoids an FFI boundary. Publishing as an npm package enables versioning independent of the Rust release cycle.
**Alternatives considered**:
- *Embed extension logic in the Rust binary* — Requires cross-language serialization; complex build pipeline.
- *Inject tools via MCP server* — Viable but adds an extra network hop and process; extension API is simpler for Kira-specific tools.

### D4: Pi binary bundled in the Kira npx-cli download artifact
**Decision**: Package the `pi` npm package contents (`@mariozechner/pi-coding-agent`) into the same platform-specific zip that `download.js` fetches from R2 at startup. `ensureBinary` is extended to extract `pi` alongside `kira-code` and `kira-code-mcp`. The Rust backend resolves `pi` from `~/.kira/bin/pi` (the managed cache path) — never from `PATH`.
**Rationale**: Pi is already an npm package with a single `pi` binary entry point. Kira already has a complete, battle-tested binary distribution and version-pinning system in `npx-cli/`. Reusing it means zero runtime npm dependency, offline/air-gapped support, reproducible versions per Kira release, and zero user action required. This treats `pi` exactly like `kira-code-mcp` — an internal managed service.
**Alternatives considered**:
- *`npm install -g` at runtime* — Requires npm/Node on the target machine; non-reproducible; slower; fails in restricted environments.
- *Require user to install `pi` manually* — Adds friction; breaks "it just works" UX promise; users need to manage versions.
- *Separate auto-updater for `pi`* — Unnecessary complexity; Kira release cadence already controls the version via the bundled artifact.

> **Note — Future cloud hardening**: When Kira eventually runs agents server-side (multi-tenant cloud), a process sandbox (Linux namespaces, cgroup resource limits, network allowlists) will be required. That is explicitly deferred — agent execution remains local for this change.

### D5: Auth via trusted API key + optional OIDC
**Decision**: Extend `crates/trusted-key-auth` (already present) to gate all remote API and WebSocket routes. Add optional OIDC (GitHub OAuth, Google OAuth via the existing `crates/remote/auth/` infra) for team-based deployments.
**Rationale**: Trusted key auth is already in the codebase. Re-using it minimizes new code. OIDC support in `crates/remote/auth/` is already partly implemented for the hosted product.
**Alternatives considered**:
- *No auth changes* — Local-only acceptable; cloud absolutely requires auth.
- *Full RBAC from day one* — Defer role-based access control to a later change.

### D6: Git-backed skill repo as the Pi fleet config store
**Decision**: Kira provisions one private bare git repo per org to hold that org's Pi skills (e.g., `kira-internal:/orgs/<org-id>/skills.git`). The repo contains one subdirectory per skill, each with a `SKILL.md` and any companion files (scripts, references, assets). `PiExecutor` writes a `.pi/settings.json` into the worktree before spawning `pi`, pointing `packages` at this repo via Pi's native `git:` source type. Pi clones the repo on first use and pulls on subsequent runs — no Kira-side extraction or file materialisation needed.
**Rationale**: Pi skills are directories, not single files. They contain executable scripts and referenced assets that must be co-located. Storing them as zip blobs or as individual DB rows both require Kira to manage extraction and relative paths correctly. Using a git repo delegates all of that to Pi's already-working package system. Multi-file skills work out of the box. The org's skill library is version-controlled (git history, rollback, diffs) for free. Kira only needs to implement a thin git hosting layer and a UI over the repo contents.
**Alternatives considered**:
- *Zip blobs in R2/DB* — Kira must extract correctly, handle relative paths, manage file permissions. Fragile for scripts.
- *Single-file skills only (SKILL.md in DB)* — Too restrictive; rules out skills with helper scripts or large reference docs.
- *npm private registry per org* — Correct for production at scale but requires operating Verdaccio or GitHub Packages; over-engineered for v1.
- *Public npm packages only* — No mechanism for org-private skills; not viable for internal tooling.

### D7: Frontend event rendering in `web-core`
**Decision**: Add Pi event rendering components to `packages/web-core` (shared library) so both `local-web` and `remote-web` can display thinking blocks, tool call cards, and diff views without duplication.
**Rationale**: `web-core` is the established shared library. Adding Pi event UI there avoids the same components being built twice.
**Alternatives considered**:
- *Add only to `remote-web`* — Leaves `local-web` without the new UI; diverges the two frontends.

## Risks / Trade-offs

- **Pi version coupling** → Kira is coupled to a specific Pi RPC protocol version. Mitigation: pin the Pi version in the build workflow that produces the R2 artifact; implement a version check at startup (Kira reads `pi --version` and rejects mismatches); track Pi changelog for breaking changes.
- **Pi artifact size** → Bundling `pi` (~9.4 MB unpacked) increases the download size. Mitigation: Pi is already smaller than the Kira binary itself; acceptable trade-off for zero-friction install.
- **Pi startup latency** → Spawning a new `pi` process per task adds ~200–500 ms overhead. Mitigation: acceptable for local execution; a warm process pool can be added later if needed.
- **Extension side-channel risk** → The Kira Pi Extension runs inside the agent's context and can call Kira API endpoints. Mitigation: extension authenticates with a scoped short-lived JWT, not the user's full token; endpoints exposed to the extension are write-limited to the assigned task only.
- **Skill repo git clone latency** → Pi clones the org skill repo on first use, which can take 1–5 s depending on repo size and network. Mitigation: Pi caches the clone in `.pi/git/` and only pulls on subsequent runs (fast); keep skill repos small (text + lightweight scripts only); document the cold-start behaviour.
- **Skill repo content trust** → Skills can contain executable scripts that the agent runs. A malicious or misconfigured skill is a supply-chain risk. Mitigation: only org admins can push to the skill repo; Kira UI shows a diff for every skill edit before commit; future: code review gate on skill changes.
- **Rebrand churn** → "Vibe Kanban" appears in ~200 files (strings, package names, docs, DB migration comments). Mitigation: automated grep-and-replace pass first, then targeted manual review for user-visible strings.
- **SQLite → PostgreSQL gap** → Local stack continues to use SQLite; the two stacks share `crates/db` schema. Mitigation: keep using SQLx's compile-time checked queries with feature-flagged driver selection; avoid PostgreSQL-specific SQL in shared queries.

## Migration Plan

1. **Rebrand pass**: automated sed/ripgrep replace of "Vibe Kanban" / "vibe-kanban" / "vibekanban" strings; manual review of package.json, Cargo.toml, Docker files.
2. **Bundle Pi in npx-cli**: update the R2 build workflow to include `pi` in the platform zip; extend `ensureBinary`/`download.js` to extract `pi`; verify `~/.kira/bin/pi --version` works after install.
3. **Executor refactor**: create `PiExecutor` resolving `pi` from `~/.kira/bin/pi`; delete legacy executor modules; run existing integration tests.
4. **Frontend Pi events**: add `PiEventStream` component and child components to `web-core`; wire into `remote-web` task detail view first, then `local-web`.
5. **Kira Pi Extension**: scaffold TypeScript package; implement the three initial tools; publish to npm (private or public); update `pi` invocation in `PiExecutor` to pass `--extension`.
6. **Pi Fleet Config**: provision bare git repo per org on the Kira server; implement skill CRUD API (backed by git commits); build fleet config UI in `remote-web` (skill editor, model picker); update `PiExecutor` to fetch resolved config and write `.pi/settings.json` before spawn.
7. **Auth hardening**: gate remote routes behind `trusted-key-auth` middleware; add OIDC login flow to `remote-web`.
7. **Rollback**: each step is independently deployable. Legacy executors are deleted only after `PiExecutor` passes CI. Remote auth is additive (existing sessions continue to work during transition window).

## Open Questions

- **Pi binary distribution**: Should Kira bundle a specific Pi version in its Docker image, or fetch it at runtime? Bundling is more reproducible but increases image size.
- **Process pool sizing**: How many warm `pi` processes should be pre-spawned per server instance? Needs profiling on the target cloud instance type.
- **Extension tooling scope**: Which additional tools beyond the initial three (`update_task_status`, `request_human_review`, `log_to_kanban`) should be in the v1 extension? Defer to a follow-up change or decide now?
- **OIDC provider priority**: GitHub OAuth is already partially implemented — should Google OAuth be included in this change or deferred?
