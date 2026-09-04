#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit): report-only ESLint check.
// Reads the tool-call JSON on stdin, and if the edited file is a .ts/.tsx/.js/.jsx
// file under src/, runs `npx eslint` on it and surfaces any findings back to
// Claude via hookSpecificOutput.additionalContext. Never blocks the tool call.

const { execSync } = require('child_process');

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    run(input);
  } catch {
    // Report-only: never let this hook fail the tool call.
    process.exit(0);
  }
});

function run(raw) {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    process.exit(0);
    return;
  }

  const filePath =
    (payload.tool_input && payload.tool_input.file_path) ||
    (payload.tool_response && payload.tool_response.filePath) ||
    '';

  if (!filePath) {
    process.exit(0);
    return;
  }

  const normalized = filePath.replace(/\\/g, '/');
  const isJsOrTs = /\.(ts|tsx|js|jsx)$/.test(normalized);
  const isUnderSrc = /(^|\/)src\//.test(normalized);

  if (!isJsOrTs || !isUnderSrc) {
    process.exit(0);
    return;
  }

  let output = '';
  try {
    // eslint exits 0 even when it reports warnings, so read stdout either way.
    output = execSync(`npx eslint "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // Non-zero exit: lint errors (or eslint itself failed to run).
    output = `${err.stdout || ''}${err.stderr || ''}`;
  }

  output = output.trim();
  if (!output) {
    process.exit(0);
    return;
  }

  const result = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `ESLint found issues in ${filePath}:\n${output}`,
    },
  };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}
