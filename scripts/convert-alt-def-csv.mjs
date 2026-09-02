// Codex (via the local headroom proxy this account routes through) tends to emit
// batch output as a compact CSV instead of the requested JSON array, regardless of
// prompt instructions to the contrary. Rather than fight it, convert its raw rows.
//
// Usage: node scripts/convert-alt-def-csv.mjs <raw-rows.txt> <output.json>
// Input file: one row per line, "alt_definition,general_connotation,word_id"
// (any header line like "[50]{...}" is stripped automatically).

import { readFileSync, writeFileSync } from 'fs';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node convert-alt-def-csv.mjs <raw-rows.txt> <output.json>');
  process.exit(1);
}

const lines = readFileSync(inPath, 'utf-8').split('\n')
  .map(l => l.trim())
  .filter(l => l && !/^\[\d+\]\{/.test(l));

const out = lines.map(line => {
  const parts = line.split(',');
  const word_id = parseInt(parts[parts.length - 1], 10);
  const general_connotation = parts[parts.length - 2].trim();
  const alt_definition = parts.slice(0, parts.length - 2).join(',').trim();
  return { word_id, alt_definition, general_connotation };
});

writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Converted ${out.length} entries -> ${outPath}`);
