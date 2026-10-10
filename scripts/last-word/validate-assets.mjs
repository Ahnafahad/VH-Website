#!/usr/bin/env node
/**
 * npm run last-word:validate-assets [-- --write] [-- --strict] [-- --json]
 *
 * Checks every file listed in src/features/last-word/assets/asset-manifest.json
 * that exists under public/, against its spec (format sniffed from bytes,
 * dimensions, triangle budget, node names, bounds, duration, size budget,
 * forbidden compression, SVG hygiene).
 *
 *   (default)  print a report; exit 1 if any PRESENT file is invalid.
 *   --write    also write public/last-word/assets/available.json, listing only
 *              the asset ids that passed. The game loads exactly these; every
 *              other id uses its procedural placeholder. Runs in prebuild.
 *   --strict   additionally exit 1 when a must-have asset is missing.
 *   --no-fail  never exit non-zero (used by prebuild so a bad file can't
 *              break the site build; it is simply left out of available.json).
 *   --json     machine-readable output.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetBytes } from './lib/asset-checks.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Set(process.argv.slice(2));
const manifestPath = join(repo, 'src/features/last-word/assets/asset-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const publicRoot = join(repo, 'public');

const results = manifest.assets.map((spec) => {
  const files = [spec.path, ...(spec.altPaths ?? [])].map((rel) => {
    const abs = join(publicRoot, manifest.root, rel);
    if (!existsSync(abs)) return { path: rel, present: false };
    const check = validateAssetBytes(spec, new Uint8Array(readFileSync(abs)), rel);
    return { path: rel, present: true, ...check };
  });
  const primary = files[0];
  const status = !primary.present ? 'placeholder' : primary.ok ? 'ok' : 'invalid';
  return { id: spec.id, priority: spec.priority, category: spec.category, status, files };
});

const available = results.filter((r) => r.status === 'ok').map((r) => ({
  id: r.id,
  // Alternate encodings (e.g. .webm next to .mp3) are offered only if they also passed.
  paths: r.files.filter((f) => f.present && f.ok).map((f) => f.path),
}));

if (args.has('--write')) {
  const out = join(publicRoot, manifest.root, 'available.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ version: manifest.version, generatedAt: new Date().toISOString(), assets: available }, null, 2) + '\n');
}

const invalid = results.filter((r) => r.files.some((f) => f.present && !f.ok));
const missingMust = results.filter((r) => r.priority === 'must' && r.status === 'placeholder');

if (args.has('--json')) {
  console.log(JSON.stringify({ results, available, invalid: invalid.map((r) => r.id), missingMust: missingMust.map((r) => r.id) }, null, 2));
} else {
  const icon = { ok: '✓', placeholder: '·', invalid: '✗' };
  console.log(`Last Word assets — ${results.filter((r) => r.status === 'ok').length}/${results.length} supplied, ${missingMust.length} must-have still on placeholders\n`);
  for (const r of results) {
    console.log(`${icon[r.status]} ${r.id.padEnd(36)} ${r.priority.padEnd(5)} ${r.status}`);
    for (const f of r.files) {
      if (!f.present) continue;
      for (const e of f.errors ?? []) console.log(`    ✗ ${f.path}: ${e}`);
      for (const w of f.warnings ?? []) console.log(`    ! ${f.path}: ${w}`);
    }
  }
  if (args.has('--write')) console.log(`\nWrote public/${manifest.root}/available.json (${available.length} assets).`);
}

if (args.has('--no-fail')) process.exit(0);
if (invalid.length) process.exit(1);
if (args.has('--strict') && missingMust.length) process.exit(1);
