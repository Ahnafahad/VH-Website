#!/usr/bin/env node
// PreToolUse hook (Edit|Write|MultiEdit): block edits to generated Drizzle
// migrations (drizzle/**) and .env.local. These must never be hand-edited by
// Claude - schema changes go through src/lib/db/schema.ts + `npx drizzle-kit
// push` (see the db-schema-change skill), and .env.local is edited manually
// by the user because it holds live secrets.
//
// Security-relevant hook: unlike the report-only ESLint hook, this fails
// CLOSED on malformed input (denies rather than silently allowing), because
// an attacker-controlled or corrupted payload should not be able to bypass
// the block by breaking JSON parsing.

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    deny(
      'Could not parse the tool-call payload for the sensitive-file check, so the edit is being denied by default (fail-closed). Investigate .claude/hooks/block-sensitive.js.'
    );
    return;
  }

  const filePath = (payload.tool_input && payload.tool_input.file_path) || '';
  if (!filePath) {
    // No file path to check - nothing to block.
    process.exit(0);
    return;
  }

  const normalized = filePath.replace(/\\/g, '/');
  const isDrizzleMigration = /(^|\/)drizzle\//.test(normalized);
  const isEnvLocal = /(^|\/)\.env\.local$/.test(normalized);

  if (isDrizzleMigration) {
    deny(
      'drizzle/** holds generated migration files derived from `npx drizzle-kit push` and must never be hand-edited. For schema changes, edit src/lib/db/schema.ts and run `npx drizzle-kit push` (see the db-schema-change skill workflow).'
    );
    return;
  }

  if (isEnvLocal) {
    deny(
      '.env.local contains live secrets (TURSO_AUTH_TOKEN, NEXTAUTH_SECRET, GOOGLE_CLIENT_SECRET, RESEND_API_KEY, etc.) and must be edited manually by the user, not by Claude.'
    );
    return;
  }

  process.exit(0);
});

function deny(reason) {
  const result = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}
