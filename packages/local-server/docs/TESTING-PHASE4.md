# Phase 4 Testing Guide — Git Operations (Worktree Manager)

## Overview

Phase 4 adds git worktree management to the local server. This guide covers testing:
- `POST /api/workspaces/from-pr` — create workspace from a GitHub PR
- `DELETE /api/workspaces/:id/worktree` — delete a workspace's worktree
- `src/git/worktree.ts` — worktree creation and deletion

## Prerequisites

### 1. Dependencies
```bash
# Ensure simple-git is installed
cd packages/local-server
pnpm install
```

### 2. GitHub CLI (`gh`)
The `from-pr` endpoint requires `gh` CLI installed and authenticated:
```bash
# Check if installed
gh --version

# Check if authenticated
gh auth status

# If not installed: https://cli.github.com/
# If not logged in:
gh auth login
```

### 3. Server running
```bash
cd packages/local-server
pnpm run dev
# Server starts at http://localhost:3000
```

### 4. A git repo registered
The `from-pr` endpoint needs an existing repo registered in the DB. Use the kira-code repo itself:
```bash
REPO_RESP=$(curl -s -X POST http://localhost:3000/api/repos \
  -H "Content-Type: application/json" \
  -d "{\"path\": \"$(pwd | sed 's|/packages/local-server||')\", \"name\": \"kira-code\"}")
echo $REPO_RESP | jq .
REPO_ID=$(echo $REPO_RESP | jq -r '.data.id')
echo "REPO_ID=$REPO_ID"
```

---

## Test Suite

### Test 1: Worktree path resolution

Verify the configurable worktree base directory:

```bash
# Default path (should be ~/.local/share/kira-code/worktrees/)
curl -s -X DELETE "http://localhost:3000/api/workspaces/00000000-0000-0000-0000-000000000001/worktree" | jq .data.worktreePath
# Expected: "/home/<user>/.local/share/kira-code/worktrees/workspace-00000000-0000-0000-0000-000000000001"

# Override via env var
KIRA_WORKTREE_DIR=/tmp/test-worktrees pnpm run dev &
# Then the path should use /tmp/test-worktrees/workspace-<id>
```

**Expected**: Path uses `~/.local/share/kira-code/worktrees/workspace-<id>` by default.

---

### Test 2: from-pr — invalid URL

```bash
curl -s -X POST http://localhost:3000/api/workspaces/from-pr \
  -H "Content-Type: application/json" \
  -d '{"prUrl": "not-a-github-url", "repoId": "00000000-0000-0000-0000-000000000001"}' | jq .
```

**Expected**:
```json
{
  "success": false,
  "data": null,
  "message": "Invalid GitHub PR URL: \"not-a-github-url\"\nExpected format: https://github.com/owner/repo/pull/123"
}
```

---

### Test 3: from-pr — non-existent repo

```bash
curl -s -X POST http://localhost:3000/api/workspaces/from-pr \
  -H "Content-Type: application/json" \
  -d '{"prUrl": "https://github.com/owner/repo/pull/1", "repoId": "00000000-0000-0000-0000-000000000001"}' | jq .
```

**Expected**:
```json
{
  "success": false,
  "data": null,
  "message": "Repo not found"
}
```

---

### Test 4: from-pr — gh CLI not installed

Stop server, unset PATH for gh, restart:
```bash
# Simulate by passing a PR from a private repo without gh auth
# OR: temporarily rename the gh binary
sudo mv $(which gh) /tmp/gh-backup

curl -s -X POST http://localhost:3000/api/workspaces/from-pr \
  -H "Content-Type: application/json" \
  -d "{\"prUrl\": \"https://github.com/owner/repo/pull/1\", \"repoId\": \"$REPO_ID\"}" | jq .

sudo mv /tmp/gh-backup $(which gh)  # restore
```

**Expected**:
```json
{
  "success": false,
  "data": null,
  "message": "GitHub CLI (`gh`) is not installed or not in PATH.\nPlease install it from https://cli.github.com/ and run `gh auth login`."
}
```

---

### Test 5: from-pr — success (requires a real open PR)

Pick any public GitHub PR. The kira-code repo may have open PRs, or use any public repo:

```bash
# Example using any public repo with an open PR
# Replace with a real PR URL you have access to
PR_URL="https://github.com/mariozechner/lemmy/pull/1"  # example

RESULT=$(curl -s -X POST http://localhost:3000/api/workspaces/from-pr \
  -H "Content-Type: application/json" \
  -d "{\"prUrl\": \"$PR_URL\", \"repoId\": \"$REPO_ID\", \"profile\": \"quick\"}")
echo $RESULT | jq .
```

**Expected**:
```json
{
  "success": true,
  "data": {
    "workspace": {
      "id": "<uuid>",
      "branch": "pr/1",
      "name": "PR #1",
      ...
    },
    "session": {
      "id": "<uuid>",
      "workspaceId": "<uuid>",
      "createdAt": "..."
    },
    "worktreePath": "/home/<user>/.local/share/kira-code/worktrees/workspace-<uuid>",
    "prNumber": 1,
    "branch": "pr/1"
  },
  "message": null
}
```

**Verify worktree directory exists**:
```bash
WORKSPACE_ID=$(echo $RESULT | jq -r '.data.workspace.id')
WORKTREE_PATH=$(echo $RESULT | jq -r '.data.worktreePath')
ls -la "$WORKTREE_PATH"
# Should show the checked-out PR branch files
git -C "$WORKTREE_PATH" branch
# Should show: * pr/<N>
```

**Verify session was created and agent started**:
```bash
SESSION_ID=$(echo $RESULT | jq -r '.data.session.id')
curl -s "http://localhost:3000/api/sessions/$SESSION_ID/status" | jq .
# Expected: isActive: true
```

**Verify agent events stream**:
```bash
# In a separate terminal, watch events
curl -sN http://localhost:3000/api/events
# Should see agent_event entries for the new session
```

---

### Test 6: delete worktree — workspace not found

```bash
curl -s -X DELETE "http://localhost:3000/api/workspaces/00000000-0000-0000-0000-000000000001/worktree" | jq .
```

**Expected**:
```json
{
  "success": false,
  "data": null,
  "message": "Workspace not found"
}
```

---

### Test 7: delete worktree — success

Using the workspace created in Test 5:
```bash
curl -s -X DELETE "http://localhost:3000/api/workspaces/$WORKSPACE_ID/worktree" | jq .
```

**Expected**:
```json
{
  "success": true,
  "data": {
    "worktreeDeleted": true,
    "worktreePath": "/home/<user>/.local/share/kira-code/worktrees/workspace-<uuid>"
  },
  "message": null
}
```

**Verify directory removed**:
```bash
ls "$WORKTREE_PATH" 2>&1
# Expected: ls: cannot access '...': No such file or directory
```

**Verify DB updated**:
```bash
curl -s "http://localhost:3000/api/workspaces/$WORKSPACE_ID" | jq .data.worktreeDeleted
# Expected: true
```

---

### Test 8: delete worktree — already deleted (idempotent)

Run the delete again on the same workspace:
```bash
curl -s -X DELETE "http://localhost:3000/api/workspaces/$WORKSPACE_ID/worktree" | jq .
```

**Expected**: Returns 200 with `worktreeDeleted: true` (no error — idempotent since directory is already gone).

---

### Test 9: Custom worktree directory via env var

```bash
# Stop the server (Ctrl+C), then restart with custom worktree dir
KIRA_WORKTREE_DIR=/tmp/my-worktrees pnpm run dev &
sleep 3

# Create workspace from PR (reuse PR_URL and REPO_ID from Test 5)
RESULT=$(curl -s -X POST http://localhost:3000/api/workspaces/from-pr \
  -H "Content-Type: application/json" \
  -d "{\"prUrl\": \"$PR_URL\", \"repoId\": \"$REPO_ID\"}")
echo $RESULT | jq .data.worktreePath
# Expected: "/tmp/my-worktrees/workspace-<uuid>"

ls /tmp/my-worktrees/
# Expected: workspace-<uuid>/ directory
```

---

## Automated Test Script

Save and run this script to execute all non-interactive tests:

```bash
#!/usr/bin/env bash
set -e

BASE_URL="${BACKEND_URL:-http://localhost:3000}"
REPO_PATH="${REPO_PATH:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

echo "=== Phase 4 Automated Tests ==="
echo "Server: $BASE_URL"
echo "Repo: $REPO_PATH"
echo ""

# Register repo
echo "--- Setup: Register repo ---"
REPO_ID=$(curl -s -X POST "$BASE_URL/api/repos" \
  -H "Content-Type: application/json" \
  -d "{\"path\": \"$REPO_PATH\", \"name\": \"test-repo\"}" | jq -r '.data.id')
echo "Repo ID: $REPO_ID"

# Test 1: Invalid URL
echo ""
echo "--- Test 1: Invalid PR URL ---"
RESP=$(curl -s -X POST "$BASE_URL/api/workspaces/from-pr" \
  -H "Content-Type: application/json" \
  -d '{"prUrl": "not-a-url", "repoId": "00000000-0000-0000-0000-000000000001"}')
SUCCESS=$(echo $RESP | jq -r '.success')
[[ "$SUCCESS" == "false" ]] && echo "PASS" || echo "FAIL: $RESP"

# Test 2: Non-existent repo
echo ""
echo "--- Test 2: Non-existent repo ---"
RESP=$(curl -s -X POST "$BASE_URL/api/workspaces/from-pr" \
  -H "Content-Type: application/json" \
  -d '{"prUrl": "https://github.com/owner/repo/pull/1", "repoId": "00000000-0000-0000-0000-000000000001"}')
MSG=$(echo $RESP | jq -r '.message')
[[ "$MSG" == "Repo not found" ]] && echo "PASS" || echo "FAIL: $MSG"

# Test 3: Delete non-existent workspace worktree
echo ""
echo "--- Test 3: Delete worktree for missing workspace ---"
RESP=$(curl -s -X DELETE "$BASE_URL/api/workspaces/00000000-0000-0000-0000-000000000001/worktree")
MSG=$(echo $RESP | jq -r '.message')
[[ "$MSG" == "Workspace not found" ]] && echo "PASS" || echo "FAIL: $MSG"

echo ""
echo "=== Automated tests complete ==="
echo ""
echo "For full end-to-end test (requires real GitHub PR):"
echo "  PR_URL=https://github.com/owner/repo/pull/N REPO_ID=$REPO_ID bash test-phase4-e2e.sh"
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `gh: command not found` | gh CLI missing | Install from https://cli.github.com/ |
| `You are not logged into any GitHub hosts` | gh not authenticated | Run `gh auth login` |
| `Failed to fetch PR #N: ...` | No access to repo | Ensure `gh auth status` shows correct account |
| `Worktree already exists` | Previous failed run | Delete `~/.local/share/kira-code/worktrees/workspace-<id>` manually |
| `branch already exists` | PR was fetched before | `git branch -D pr/<N>` in the repo directory |
| `404` on `/api/workspaces/from-pr` | Server needs restart | Ctrl+C and restart `pnpm run dev` |
