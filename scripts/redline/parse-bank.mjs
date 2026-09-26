// scripts/redline/parse-bank.mjs — parses the Sentence Correction Mastery bank markdown
// (850 YAML records, one fenced ```yaml block per "## Question N" heading) into raw objects.
import fs from 'fs';
import yaml from 'js-yaml';

export function parseBank(mdPath) {
  const text = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
  const records = [];
  const re = /^## Question (\d+)\s*\n+```yaml\n([\s\S]*?)\n```/gm;
  let m;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    let doc;
    try { doc = yaml.load(m[2]); } catch (e) { throw new Error(`Q${n}: YAML parse failed: ${e.message}`); }
    doc.__n = n;
    records.push(doc);
  }
  return records;
}
