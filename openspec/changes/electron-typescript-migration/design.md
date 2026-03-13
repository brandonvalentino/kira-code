## Context

Kira Code currently runs a Rust HTTP server (`crates/server`) that provides local API + SQLite. The frontend (`packages/local-web`) talks to this server. Distribution is via `npx kira-code` which downloads pre-built Rust binaries.

**The shift**: Replace Rust backend with TypeScript while keeping NPX distribution. Pi SDK becomes the unified agent runtime.

**Note**: This is v1 - NPX-based local web app. Electron desktop app is deferred.

## Goals / Non-Goals

**Goals:**
- Single TypeScript ecosystem (no Rust, no type generation)
- Keep `npx kira-code` as delivery mechanism
- Pi SDK as unified agent (replaces all Rust executors)
- LiteLLM proxy for authentication with virtual keys and usage limits
- Same user experience, simpler implementation
- Migrate existing user data automatically

**Non-Goals:**
- Electron desktop app (deferred to future change)
- Cloud-side agent execution (agents run locally via NPX)
- Offline support (v1 requires network for LiteLLM)
- Billing/payments beyond LiteLLM budget tracking
- Breaking changes to existing API

## Decisions

### D1: Pi SDK as unified agent runtime
**Decision**: Use `@mariozechner/pi-coding-agent` SDK for agent execution.
**Rationale**:
- TypeScript-native, no subprocess JSONL parsing
- Extensible via extensions, skills, custom tools
- Built-in session management with branching/compaction
- Multiple provider support (Anthropic, OpenAI, Google, etc.)
- Active maintenance and documentation

**Alternatives considered**:
- *Keep Rust executors*: Defeats purpose of TypeScript migration
- *Build custom agent*: Reinventing the wheel, Pi SDK is production-ready

### D2: Hono for HTTP server
**Decision**: Use Hono (not Express, Fastify, or NestJS) for local HTTP server.
**Rationale**:
- TypeScript-native with excellent type inference
- Minimal, fast, modern API
- Built-in SSE support for event streaming
- Edge-compatible (future option)
- Familiar Express-like patterns

**Alternatives considered**:
- *Express*: Untyped, older patterns
- *Fastify*: Good but more verbose type integration
- *NestJS*: Overkill for CRUD API

### D3: SQLite via Drizzle ORM
**Decision**: Use Drizzle ORM with better-sqlite3 for local data persistence.
**Rationale**:
- Type-safe queries with TypeScript
- Migration support built-in
- Better-sqlite3 is synchronous (simpler code)
- Matches Rust schema exactly
- No async callback hell

**Alternatives considered**:
- *sql.js*: Pure JS, slower
- *Prisma*: Heavier than needed
- *Raw SQLite*: Too much boilerplate

### D4: SSE for event streaming
**Decision**: Use Server-Sent Events (not WebSocket) for agent event streaming.
**Rationale**:
- Unidirectional (server → client) matches use case
- Simpler than WebSocket (no upgrade handshake)
- Built-in reconnection support
- Hono has built-in SSE helpers
- Lower latency than polling

**Alternatives considered**:
- *WebSocket*: Overkill for unidirectional streaming
- *Polling*: Higher latency, more requests

### D5: LiteLLM for authentication
**Decision**: Use LiteLLM proxy with virtual API keys for user authentication and usage tracking.
**Rationale**:
- Users subscribe to Kira Code with Claude Max integration
- Each user gets virtual key with budget limits
- LiteLLM handles rate limiting, usage tracking
- Pi SDK can use LiteLLM as custom provider via `models.json`
- No need to build auth system from scratch

**Alternatives considered**:
- *Direct Anthropic API keys*: No usage tracking, no budget limits
- *Build custom proxy*: Reinventing LiteLLM
- *OAuth*: Overkill for v1

### D6: Pi packages for distribution
**Decision**: Create `@kira/pi-package` npm package with Kira tools, skills, and model configuration.
**Rationale**:
- Pi SDK has built-in package system
- Easy to distribute custom tools and configurations
- Users can install via `pi install @kira/pi-package`
- `models.json` configuration for LiteLLM integration
- Skills and tools bundled together

**Alternatives considered**:
- *Manual configuration files*: Harder to distribute updates
- *Custom extension loader*: Pi package system already exists

### D7: Keep existing API structure
**Decision**: Match existing Rust API endpoints and response formats.
**Rationale**:
- Frontend requires no changes
- Existing documentation remains valid
- Easier migration for users
- Can incrementally replace Rust code

**Alternatives considered**:
- *Redesign API*: Unnecessary breaking changes
- *GraphQL over REST*: Overkill for v1

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   npx kira-code                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Node.js Process                       │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │  Hono HTTP Server (port 3000)           │   │   │
│  │  │                                         │   │   │
│  │  │  /api/workspaces  → Workspace routes    │   │   │
│  │  │  /api/repos       → Repo routes         │   │   │
│  │  │  /api/sessions    → Session routes      │   │   │
│  │  │  /api/config      → Config routes       │   │   │
│  │  │  /api/events      → SSE stream          │   │   │
│  │  │  /health          → Health check        │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │  Drizzle ORM + better-sqlite3           │   │   │
│  │  │  - workspaces                           │   │   │
│  │  │  - repos                                │   │   │
│  │  │  - sessions                             │   │   │
│  │  │  - execution_processes                  │   │   │
│  │  │  - settings                             │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │  Pi SDK Integration                     │   │   │
│  │  │  - createAgentSession()                 │   │   │
│  │  │  - session.prompt()                     │   │   │
│  │  │  - session.steer()                      │   │   │
│  │  │  - session.abort()                      │   │   │
│  │  │  - Custom Kira tools                    │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │  simple-git                             │   │   │
│  │  │  - worktree create/delete               │   │   │
│  │  │  - branch operations                    │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Frontend (served separately)                   │   │
│  │  packages/local-web (Vite dev server)          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │
         │ HTTP + SSE
         ▼
┌─────────────────────────────────────────────────────────┐
│  packages/local-web (React + Vite)                      │
│  - Unchanged from current implementation                │
│  - Talks to TypeScript server instead of Rust           │
└─────────────────────────────────────────────────────────┘
         │
         │ HTTPS
         ▼
┌─────────────────────────────────────────────────────────┐
│  LiteLLM Proxy                                          │
│  - Virtual API keys (kira_xxx)                          │
│  - Usage tracking per user                              │
│  - Budget enforcement                                   │
│  - Rate limiting                                        │
└─────────────────────────────────────────────────────────┘
         │
         │ API calls
         ▼
┌─────────────────────────────────────────────────────────┐
│  Anthropic Claude Max                                   │
│  - Actual LLM provider                                  │
└─────────────────────────────────────────────────────────┘
```

## Data Model

Match Rust schema exactly for seamless migration:

```
repos (id, path, name, display_name, setup_script, cleanup_script, ...)
workspaces (id, task_id, container_ref, branch, archived, pinned, ...)
workspace_repos (id, workspace_id, repo_id, target_branch)
sessions (id, workspace_id, pi_session_path, created_at, updated_at)
execution_processes (id, session_id, run_reason, status, exit_code, ...)
settings (key, value, updated_at)
images (id, file_path, original_name, mime_type, size_bytes)
tags (id, tag_name, content)
merges (id, workspace_id, repo_id, merge_commit, target_branch_name)
virtual_keys (id, user_id, key, models, max_budget, current_spend, ...)
```

Pi sessions stored separately in `~/.local/share/kira-code/sessions/*.jsonl`

## API Endpoints

Match existing Rust API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces` | List all workspaces |
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces/:id` | Get workspace |
| PATCH | `/api/workspaces/:id` | Update workspace |
| DELETE | `/api/workspaces/:id` | Delete workspace |
| GET | `/api/repos` | List repos |
| POST | `/api/repos` | Add repo |
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create session |
| POST | `/api/sessions/:id/start` | Start agent |
| POST | `/api/sessions/:id/steer` | Send steering message |
| POST | `/api/sessions/:id/abort` | Abort agent |
| GET | `/api/config` | Get config |
| PATCH | `/api/config` | Update config |
| GET | `/api/events` | SSE event stream |
| GET | `/health` | Health check |

## Error Handling

Match Rust response format:

```typescript
// Success
{ "success": true, "data": {...}, "message": null }

// Error
{ "success": false, "data": null, "message": "Workspace not found" }
```

HTTP status codes:
- 200: Success
- 400: Bad request (validation error)
- 404: Not found
- 409: Conflict (e.g., workspace has running processes)
- 500: Server error

## Security

- Virtual API keys stored in SQLite with hash
- LiteLLM proxy handles actual API key
- CORS allows only localhost origins
- No authentication required for local server (runs on user's machine)
- Rate limiting via LiteLLM

## Testing Strategy

- Unit tests for stores (CRUD operations)
- Integration tests for API routes
- E2E tests for agent execution flow
- Manual testing for NPX distribution

## Migration Strategy

1. TypeScript server starts alongside Rust server
2. Copies SQLite database on first run
3. Migrates config format
4. Validates all data
5. Rust server can be deleted after validation
