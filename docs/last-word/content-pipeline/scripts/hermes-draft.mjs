// Second drafting source: Hermes (free-tier models via OmniRoute) writes drafts into unreviewed/.
// run-gen.mjs picks those up and spends Gemini quota only on the Pro review. Resumable.
// usage: node hermes-draft.mjs <idsFile.json> [concurrency=2]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [idsFile, conc = '2'] = process.argv.slice(2);
const ROOT = 'D:/VH Website/last-word-content';
const pairs = Object.fromEntries(JSON.parse(fs.readFileSync(`${ROOT}/source/pairs.json`)).map(p => [p.id, p]));
const tpl = fs.readFileSync(`${ROOT}/prompts/generate.md`, 'utf8');
const slug = s => String(s).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const OVERRIDE = '\n\nOVERRIDE FOR THIS RUN: you have no file tools. Do not write a file. Reply with ONLY the complete JSON object — no code fences, no commentary, no DONE line. All 20 chains must be present.\n';
// Same mechanical checker as the main pipeline, loaded from its source so the two can never drift apart.
const src = fs.readFileSync(`${ROOT}/run-gen.mjs`, 'utf8');
const problems = eval('(' + src.slice(src.indexOf('function problems'), src.indexOf('const good')).replace('function problems', 'function') + ')');
const exists = id => ['sets', 'unreviewed'].some(d => fs.existsSync(`${ROOT}/${d}/${id}.json`));
const say = m => { console.log(m); fs.appendFileSync(`${ROOT}/logs/hermes.log`, m + '\n'); };

function draft(id) {
  const p = pairs[id], setId = `${slug(p.word)}-${slug(p.contrast_word)}`, job = `${ROOT}/prompts/_jobs/h-${id}.md`;
  fs.writeFileSync(job, tpl.replaceAll('{{WORD}}', p.word).replaceAll('{{CONTRAST}}', p.contrast_word).replaceAll('{{POS}}', p.pos)
    .replaceAll('{{DEFINITION}}', p.definition).replaceAll('{{GLOSS}}', p.contrast_gloss)
    .replaceAll('{{OUT}}', `sets/${id}.json`).replaceAll('{{SET_ID}}', setId).replaceAll('{{ID}}', id) + OVERRIDE);
  return new Promise(res => {
    let out = '';
    const c = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'D:\\AI-Stack\\scripts\\start-hermes.ps1',
      'chat', '-Q', '--oneshot', '--query-file', job.replaceAll('/', '\\')], { stdio: ['ignore', 'pipe', 'ignore'] });
    c.stdout.on('data', d => out += d);
    const timer = setTimeout(() => c.kill(), 600000);
    c.on('close', () => {
      clearTimeout(timer);
      let j = null;
      try { j = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)); } catch { /* not JSON: counts as a failure */ }
      // One bad chain should not sink a whole draft: drop the chains the checker names, keep the set if 16+ survive.
      const bad = new Set(problems(j).map(x => x.split(" ")[0]));
      if (j?.chains) j.chains = j.chains.filter(c => !bad.has(c.id));
      const pr = problems(j, 16);
      if (!pr.length) fs.writeFileSync(`${ROOT}/unreviewed/${id}.json`, JSON.stringify({ ...j, drafted_by: 'hermes' }, null, 1));
      else fs.writeFileSync(`${ROOT}/logs/hermes-${id}.fail.txt`, pr.join('\n') + '\n---\n' + out.slice(-600));
      res(pr.length === 0);
    });
  });
}

// Work from the END of the list so Hermes and the Gemini pipeline (which starts at the front) meet in the middle.
const todo = JSON.parse(fs.readFileSync(idsFile)).reverse().filter(id => !exists(id));
say(`START hermes todo=${todo.length} conc=${conc}`);
let fails = 0, ok = 0;
await Promise.all(Array.from({ length: +conc }, async () => {
  while (todo.length && fails < 8) { // ponytail: 8 failures in a row = free quota gone or gateway down; rerun to resume
    const id = todo.shift();
    if (exists(id)) continue;
    if (await draft(id)) { ok++; fails = 0; say(`ok ${id}`); } else { fails++; say(`FAIL ${id}`); }
  }
}));
say(`done ok=${ok} remaining=${todo.length} ${fails >= 8 ? 'STOPPED (repeated failures)' : ''}`);
