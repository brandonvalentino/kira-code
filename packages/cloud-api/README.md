# @kira/cloud-api

Cloud API server for Kira Code — a TypeScript/Hono server providing multi-user collaboration features, kanban boards, and remote agent tunneling.

## Overview

This is the **cloud-hosted** API server that complements the local `@kira/local-server`. While the local server runs on each user's machine (via `npx kira-code`), the cloud API runs on remote infrastructure and provides:

- **Multi-user collaboration** — Organizations, projects, issues, and team management
- **Kanban boards** — Full CRUD for issues, statuses, assignees, tags, comments
- **ElectricSQL sync** — Real-time data synchronization for frontend clients
- **OAuth authentication** — GitHub OAuth + JWT session management
- **Relay tunneling** — Secure WebSocket tunnel to local agents for remote execution
- **File attachments** — S3/R2 presigned upload URLs for issue attachments
- **GitHub App integration** — Webhook handling + installation management
- **LiteLLM proxy tokens** — Short-lived API keys for LLM access

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Cloud API (packages/cloud-api)                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Hono Server (0.0.0.0:8081)                         │   │
│  │  - REST API (/v1/*)                                 │   │
│  │  - WebSocket relay (/relay/connect)                 │   │
│  │  - ElectricSQL proxy (/v1/shape/*)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                    │                              │
│         ↓                    ↓                              │
│  ┌─────────────┐     ┌──────────────┐                      │
│  │  PostgreSQL │     │  ElectricSQL │                      │
│  │  (kanban)   │     │  (sync)      │                      │
│  └─────────────┘     └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
         │
         │ HTTPS + WebSocket
         ↓
┌─────────────────────────────────────────────────────────────┐
│  Clients                                                    │
│  - packages/local-web (frontend)                            │
│  - packages/local-server (agent tunnel)                     │
│  - Remote browsers (remote-web deployment)                  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Environment Setup

Create `.env` in the `packages/cloud-api/` directory:

```bash
# Required
KIRACODE_REMOTE_JWT_SECRET=your-super-secret-key-min-32-chars
KIRA_INTERNAL_SECRET=changeme-internal-secret

# Database
SERVER_DATABASE_URL=postgres://remote:remote@localhost:5433/remote
SERVER_LISTEN_ADDR=0.0.0.0:8081
SERVER_PUBLIC_BASE_URL=http://localhost:3000

# ElectricSQL
ELECTRIC_URL=http://localhost:3001
ELECTRIC_ROLE_PASSWORD=remote

# Optional: R2/S3 for attachments
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET=your-bucket

# Optional: GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=

# Optional: LiteLLM
LITELLM_PROXY_URL=
LITELLM_MASTER_KEY=
```

### 2. Start Dependencies

```bash
# Start PostgreSQL + ElectricSQL
docker compose up -d remote-db electric

# Wait for DB
sleep 5

# Run migrations
pnpm run db:migrate
```

### 3. Start the Server

```bash
# Development (with hot reload)
pnpm run dev

# Production build
pnpm run build
pnpm run start
```

### 4. Verify

```bash
curl http://localhost:8081/v1/health
# {"status":"ok"}
```

## API Reference

### Authentication

All endpoints except `/v1/health`, `/v1/oauth/*`, and `/v1/github/webhook` require a Bearer JWT token:

```bash
curl http://localhost:8081/v1/organizations \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/health` | Health check |
| `POST` | `/v1/organizations` | Create organization |
| `GET` | `/v1/organizations` | List user's organizations |
| `POST` | `/v1/projects` | Create project |
| `POST` | `/v1/issues` | Create issue |
| `PATCH` | `/v1/issues/:id` | Update issue |
| `POST` | `/v1/issue_comments` | Add comment |
| `POST` | `/v1/issue_assignees` | Assign user |
| `GET` | `/v1/shape/:table` | ElectricSQL sync proxy |

### Internal Endpoints

These use `KIRA_INTERNAL_SECRET` instead of user JWT:

```bash
curl -X POST http://localhost:8081/v1/internal/tasks/:id/events \
  -H "Authorization: Bearer $KIRA_INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"kind":"agent_started","payload":{}}'
```

### WebSocket Endpoints

- **Relay tunnel**: `ws://localhost:8081/relay/connect?host_id=HOST_ID`
- **Task events**: `ws://localhost:8081/ws/tasks/:TASK_ID?token=JWT`

## Project Structure

```
packages/cloud-api/
├── src/
│   ├── auth/
│   │   ├── jwt.ts              # JWT sign/verify (HS256)
│   │   └── middleware.ts       # requireSession, requireInternal
│   ├── db/
│   │   ├── schema.ts           # Drizzle ORM schema
│   │   └── index.ts            # DB pool + migrations
│   ├── proxy/
│   │   └── electric.ts         # ElectricSQL shape proxy
│   ├── relay/
│   │   └── server.ts           # WebSocket relay multiplexer
│   ├── routes/
│   │   ├── organizations.ts    # Org CRUD
│   │   ├── projects.ts         # Project CRUD
│   │   ├── issues.ts           # Issue CRUD
│   │   ├── issue-*.ts          # Issue sub-resources
│   │   ├── oauth.ts            # OAuth flow + token refresh
│   │   ├── hosts.ts            # Relay host management
│   │   ├── attachments.ts      # S3/R2 file uploads
│   │   ├── tokens.ts           # LiteLLM proxy tokens
│   │   ├── internal/events.ts  # Agent event ingestion
│   │   └── ...                 # (22 route files total)
│   ├── stores/
│   │   └── task-events.ts      # Event persistence
│   ├── shapes.ts               # ElectricSQL shape definitions
│   ├── state.ts                # AppState type + factory
│   ├── server.ts               # Hono app factory
│   └── index.ts                # Entry point
├── migrations/                  # PostgreSQL migrations
├── docker-compose.yml           # Dev stack (Postgres + Electric)
├── drizzle.config.ts            # Drizzle ORM config
├── package.json
├── tsconfig.json
├── TEST.md                      # Comprehensive test guide
└── README.md                    # This file
```

## Database Schema

The API uses PostgreSQL with the following core tables:

- `organizations` — Team/org containers
- `users` — User accounts
- `organization_member_metadata` — Org membership + roles
- `projects` — Kanban boards
- `project_statuses` — Custom statuses per project
- `issues` — Tasks/issues
- `issue_comments`, `issue_assignees`, `issue_tags`, `issue_followers`, `issue_relationships`
- `tags` — Project tags
- `pull_requests` — GitHub PR tracking
- `workspaces` — Local workspace sync metadata
- `notifications` — User notifications
- `task_events` — Agent execution event log
- `hosts`, `relay_sessions` — Relay tunnel state
- `attachments`, `blobs`, `pending_uploads` — File storage
- `reviews` — PR review state
- `github_app_installations` — GitHub App links
- `auth_sessions`, `oauth_accounts`, `oauth_handoffs` — Auth state

Migrations are copied from `crates/remote/migrations/` (Rust server) for compatibility.

## Development

### Type Checking

```bash
pnpm run check
```

### Database Commands

```bash
pnpm run db:generate   # Generate Drizzle migrations from schema
pnpm run db:migrate    # Run pending migrations
pnpm run db:push       # Push schema directly (dev only)
pnpm run db:studio     # Open Drizzle Studio
```

### Build

```bash
pnpm run build   # Compile to dist/
pnpm run start   # Run production server
```

## Testing

See [`TEST.md`](./TEST.md) for comprehensive test scenarios.

Quick smoke test:
```bash
./scripts/quick-test.sh
```

## Deployment

### Docker

Build and run with Docker Compose:

```bash
docker compose up -d
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KIRACODE_REMOTE_JWT_SECRET` | Yes | HS256 JWT signing key (min 32 chars) |
| `KIRA_INTERNAL_SECRET` | Yes | Shared secret for `/v1/internal/*` endpoints |
| `SERVER_DATABASE_URL` | Yes | PostgreSQL connection string |
| `SERVER_LISTEN_ADDR` | No | Listen address (default: `0.0.0.0:8081`) |
| `SERVER_PUBLIC_BASE_URL` | No | Public URL for OAuth redirects |
| `ELECTRIC_URL` | No | ElectricSQL internal URL |
| `R2_*` | No | Cloudflare R2 / S3 credentials |
| `GITHUB_OAUTH_*` | No | GitHub OAuth app credentials |
| `GITHUB_APP_*` | No | GitHub App credentials |
| `LITELLM_*` | No | LiteLLM proxy configuration |

## Relationship to Other Packages

| Package | Relationship |
|---------|--------------|
| `@kira/shared` | Shared types/schemas imported by cloud-api and local-server |
| `@kira/local-server` | Local agent that tunnels to cloud-api via relay |
| `@kira/local-web` | Frontend that consumes cloud-api for collaboration features |
| `crates/remote` | Rust predecessor; migrations and API design reference |
