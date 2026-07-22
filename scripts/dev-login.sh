#!/usr/bin/env bash
# Sign in as super-admin (ahnaf816@gmail.com) against a local dev server via
# the dev-login CredentialsProvider (src/lib/auth.ts) — no browser needed.
# Drives the same NextAuth credentials flow the /dev-login page's form does
# (csrf -> callback -> session), so it's a drop-in replacement for clicking
# through the browser tool when you just need an authed session to curl
# admin APIs against.
#
# Usage: scripts/dev-login.sh [port] [cookie-jar-path]
#   port             default 6960 (vh-website's dev port per .claude/launch.json)
#   cookie-jar-path  default /tmp/vh-dev-session-cookies.txt
#
# On success, prints the /api/auth/session JSON and leaves a curl cookie jar
# you can reuse: curl -b <jar> http://localhost:<port>/api/lms/admin/materials
#
# KNOWN ISSUE (2026-07-22, unresolved): as of this writing, dev-login
# reliably reaches the DB query step and then fails with
# "Failed query: select ... from users ..." inside the Next.js dev server
# (both Turbopack and webpack, both preview-tool-launched and plain
# `next dev`) — even though the identical query succeeds instantly from a
# standalone Node script using the same .env.local credentials. Root cause
# not yet found; suspected Next.js dev-mode fetch patching interacting with
# @libsql/client's transport. If this script reports a "Failed query" error,
# that's this bug, not a problem with the script or your DEV_LOGIN_CODE.

set -euo pipefail

PORT="${1:-6960}"
JAR="${2:-/tmp/vh-dev-session-cookies.txt}"
BASE="http://localhost:${PORT}"
ENV_FILE="$(dirname "$0")/../.env.local"

CODE=$(grep '^DEV_LOGIN_CODE=' "$ENV_FILE" | cut -d= -f2-)
if [ -z "$CODE" ]; then
  echo "DEV_LOGIN_CODE not found in $ENV_FILE" >&2
  exit 1
fi

rm -f "$JAR"
CSRF=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
if [ -z "$CSRF" ]; then
  echo "Could not fetch CSRF token — is the dev server running on port $PORT?" >&2
  exit 1
fi

RESP=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/callback/dev-login" \
  --data-urlencode "code=$CODE" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "callbackUrl=$BASE" \
  --data-urlencode "json=true")

SESSION=$(curl -s -b "$JAR" "$BASE/api/auth/session")

if [ "$SESSION" = "{}" ]; then
  echo "Login failed. Callback response:" >&2
  echo "$RESP" >&2
  exit 1
fi

echo "Logged in as super-admin. Cookie jar: $JAR"
echo "$SESSION"
