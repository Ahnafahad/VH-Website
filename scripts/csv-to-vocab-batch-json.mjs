// One-off CSV→JSON converter for when Codex returns the batch as CSV instead of
// the requested strict JSON array (happened before in the alt-defs pipeline;
// happened again here for batch 3). Does NOT touch the DB.
//
// Usage: node scripts/csv-to-vocab-batch-json.mjs <input.csv> <output.json>
//
// Expects a header row "col1:type,col2:type,..." (types are informational only)
// followed by standard-quoted CSV rows. Columns typed "json" are JSON.parse'd;
// HTML entities (&amp; etc.) are decoded in all string values.

import fs from 'fs';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node csv-to-vocab-batch-json.mjs <input.csv> <output.json>');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const raw = fs.readFileSync(inPath, 'utf8');
const rows = parseCsv(raw);
const headerRaw = rows[0].map(h => h.trim());
const header = headerRaw.map(h => h.split(':')[0].trim());
const typeOf = new Map(headerRaw.map(h => {
  const [name, type] = h.split(':');
  return [name.trim(), (type ?? '').trim()];
}));

function setPath(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] ?? {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

const records = rows.slice(1).map(cells => {
  const obj = {};
  header.forEach((col, idx) => {
    let val = decodeEntities((cells[idx] ?? '').trim());
    const type = typeOf.get(col);
    if (type === 'json') {
      val = val === '' ? (col === 'placement' ? {} : []) : JSON.parse(val);
      if (typeof val === 'object' && !Array.isArray(val)) {
        for (const k of Object.keys(val)) {
          if (typeof val[k] === 'string') val[k] = decodeEntities(val[k]);
        }
      }
    } else if (type === 'int') {
      val = parseInt(val, 10);
    } else if (type === 'float') {
      val = parseFloat(val);
    }
    setPath(obj, col, val);
  });
  return obj;
});

fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
console.log(`Converted ${records.length} row(s) → ${outPath}`);
