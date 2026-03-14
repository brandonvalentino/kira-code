#!/usr/bin/env bash
# Helper script to extract Anthropic OAuth token from Pi SDK auth file
# Usage: ./get-oauth-token.sh

set -e

AUTH_FILE="${1:-$HOME/.pi/agent/auth.json}"

if [ ! -f "$AUTH_FILE" ]; then
  echo "Auth file not found: $AUTH_FILE"
  echo ""
  echo "To get your OAuth token:"
  echo "1. Install pi CLI: npm install -g @mariozechner/pi-coding-agent"
  echo "2. Run: pi login anthropic"
  echo "3. Or check: cat ~/.pi/agent/auth.json"
  exit 1
fi

echo "Reading auth file: $AUTH_FILE"
echo ""

# Try to extract OAuth token for Anthropic
TOKEN=$(cat "$AUTH_FILE" | jq -r '.anthropic | select(.type == "oauth") | .refresh_token // .access_token // empty' 2>/dev/null)

if [ -z "$TOKEN" ]; then
  # Try alternative structure
  TOKEN=$(cat "$AUTH_FILE" | jq -r '.[] | select(.type == "oauth" and .provider == "anthropic") | .refresh_token // .access_token // empty' 2>/dev/null)
fi

if [ -z "$TOKEN" ]; then
  echo "No Anthropic OAuth token found in $AUTH_FILE"
  echo ""
  echo "Available credentials:"
  cat "$AUTH_FILE" | jq .
  echo ""
  echo "To login with OAuth:"
  echo "  pi login anthropic"
  exit 1
fi

echo "✓ Found Anthropic OAuth token"
echo ""
echo "To use it with Kira server:"
echo "  export ANTHROPIC_OAUTH_TOKEN=$TOKEN"
echo ""
echo "Or add to your .env file:"
echo "  ANTHROPIC_OAUTH_TOKEN=$TOKEN"
