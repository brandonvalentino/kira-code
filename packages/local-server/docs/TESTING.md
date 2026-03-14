# Testing Agent Runs via API

## Quick Start

### 1. Start the server

```bash
cd packages/local-server
pnpm run dev
```

Server will start on `http://localhost:3000` (or `BACKEND_PORT` env var).

### 2. Create a workspace (if you don't have one)

```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "repoId": "<repo-uuid>",
    "branch": "main",
    "name": "test-workspace"
  }'
```

Save the `id` from the response.

### 3. Create a session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": "<workspace-uuid>"}'
```

Save the session `id`.

### 4. Start the agent with a model profile

```bash
curl -X POST http://localhost:3000/api/sessions/<session-id>/start \
  -H "Content-Type: application/json" \
  -d '{"profile": "quick"}'
```

Available profiles (default):
- `quick` - claude-haiku-4-5 (fast, cheap)
- `normal` - claude-sonnet-4-5 (balanced)
- `pro` - claude-opus-4-5 with medium thinking (most capable)

### 5. Send a prompt

```bash
curl -X POST http://localhost:3000/api/sessions/<session-id>/prompt \
  -H "Content-Type: application/json" \
  -d '{"text": "List files in the current directory"}'
```

### 6. Watch events in real-time (SSE)

Open another terminal:

```bash
curl http://localhost:3000/api/events
```

You'll see events like:
```json
{
  "type": "agent_event",
  "sessionId": "...",
  "event": {
    "type": "message_update",
    "message": { ... }
  }
}
```

### 7. Steer the agent mid-run

```bash
curl -X POST http://localhost:3000/api/sessions/<session-id>/steer \
  -H "Content-Type: application/json" \
  -d '{"text": "Actually, focus on the src directory instead"}'
```

### 8. Abort the agent

```bash
curl -X POST http://localhost:3000/api/sessions/<session-id>/abort
```

### 9. Check session status

```bash
curl http://localhost:3000/api/sessions/<session-id>/status
```

Response:
```json
{
  "success": true,
  "data": {
    "sessionId": "...",
    "isActive": true,
    "isStreaming": false,
    "sessionFile": "/path/to/session.jsonl"
  }
}
```

## Model Profiles API

### List all profiles

```bash
curl http://localhost:3000/api/model-profiles
```

### Create a custom profile

```bash
curl -X POST http://localhost:3000/api/model-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-fast-model",
    "provider": "google",
    "modelId": "gemini-2.5-flash-lite-preview-06-17",
    "thinkingLevel": "off",
    "description": "My custom fast model"
  }'
```

### Set default profile

```bash
curl -X POST http://localhost:3000/api/model-profiles/quick/set-default
```

## Running the Test Script

```bash
cd packages/local-server
chmod +x test-agent-run.sh
./test-agent-run.sh
```

This runs through the complete flow automatically.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | 3000 | Server port |
| `BACKEND_URL` | http://localhost:3000 | Base URL for test script |
| `ANTHROPIC_API_KEY` | - | Anthropic Claude API key |
| `ANTHROPIC_OAUTH_TOKEN` | - | Anthropic OAuth token (claude.ai subscription) |
| `LITELLM_URL` | - | LiteLLM proxy URL (optional) |
| `LITELLM_API_KEY` | - | LiteLLM proxy API key (optional) |

### Using Anthropic OAuth (claude.ai subscription)

If you have a Claude Pro/Team subscription, you can use OAuth instead of API keys:

1. **Get your OAuth token** (from Pi SDK or claude.ai):
   ```bash
   # If you have pi CLI installed
   pi login anthropic
   
   # Or extract from your pi auth file
   cat ~/.pi/agent/auth.json
   ```

2. **Set the environment variable**:
   ```bash
   export ANTHROPIC_OAUTH_TOKEN=your-oauth-token-here
   ```

3. **Start the server** - it will automatically use the OAuth token for Anthropic models.

OAuth tokens work with all Claude models (haiku, sonnet, opus) and count against your subscription limits.

## Event Types

Watch for these event types in the SSE stream:

| Event Type | Description |
|------------|-------------|
| `agent_event` | Wrapped Pi SDK agent events |
| `review_requested` | Agent called `requestHumanReview` tool |
| `workspace_updated` | Agent called `updateTaskStatus` tool |
| `keep_alive` | SSE keep-alive ping |

## Common Issues

**"No active session"** - Call `/start` before `/prompt`

**"Session not found"** - Check your session UUID format (with dashes)

**"Model not available"** - Set the appropriate API key env var (e.g. `ANTHROPIC_API_KEY`) or configure LiteLLM proxy

**Events not streaming** - SSE connections may timeout; reconnect as needed
