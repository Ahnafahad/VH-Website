// One-time batch splitter for the ultra-concise alt-definition full run.
// Excludes the already-completed pilot words, splits the rest into ~50-word
// batch input files for Codex to read one at a time.
import { readFileSync, writeFileSync } from 'fs';

const BASE = '.claude/scratch/vocab-alt-defs';
const words = JSON.parse(readFileSync(`${BASE}/words-snapshot.json`, 'utf-8'));
const done = new Set([1319, 1394, 1494, 1073, 1668, 1640, 1580, 1794, 1539, 1353, 1784, 1381, 1198, 1705, 1701]);
const remaining = words.filter(w => !done.has(w.id));

const BATCH_SIZE = 50;
const batches = [];
for (let i = 0; i < remaining.length; i += BATCH_SIZE) batches.push(remaining.slice(i, i + BATCH_SIZE));

batches.forEach((b, i) => {
  writeFileSync(`${BASE}/batch-${i + 1}-input.json`, JSON.stringify(b, null, 2));
});

console.log(`${remaining.length} words remaining -> ${batches.length} batches: [${batches.map(b => b.length).join(', ')}]`);
