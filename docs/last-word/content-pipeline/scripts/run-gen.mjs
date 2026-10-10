// Gated batch pipeline: generate a batch (3 parallel agy/Gemini agents) -> mechanical checks on every set
// -> independent Gemini Pro critic on a random sample -> only then the next batch. Resumable.
// usage: node run-gen.mjs <idsFile.json> [batchSize=12] [concurrency=3]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [idsFile, batchSize = '12', conc = '3'] = process.argv.slice(2);
const ROOT = 'D:/VH Website/last-word-content';
const AGY = 'C:/Users/ahnaf/AppData/Local/agy/bin/agy.exe';
const GEN_MODEL = 'gemini-3.8-flash-high', CRITIC_MODEL = 'gemini-3.1-pro-high';
const pairs = Object.fromEntries(JSON.parse(fs.readFileSync(`${ROOT}/source/pairs.json`)).map(p => [p.id, p]));
const tpl = fs.readFileSync(`${ROOT}/prompts/generate.md`, 'utf8');
const reviewTpl = fs.readFileSync(`${ROOT}/prompts/review.md`, "utf8");
const criticTpl = fs.readFileSync(`${ROOT}/prompts/critic.md`, 'utf8');
const slug = s => String(s).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
for (const d of ['prompts/_jobs', 'critic', 'rejected', 'sets', 'logs']) fs.mkdirSync(`${ROOT}/${d}`, { recursive: true });
const say = m => { console.log(m); fs.appendFileSync(`${ROOT}/logs/batches.log`, m + '\n'); };

const agy = (prompt, model, logName) => new Promise(res => {
  const log = fs.openSync(`${ROOT}/logs/${logName}.log`, 'w');
  spawn(AGY, ['-p', prompt, '--add-dir', ROOT, '--mode', 'accept-edits', '--model', model, '--print-timeout', '900s'],
    { cwd: ROOT, stdio: ['ignore', log, log] }).on('close', res);
});
const load = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

// Returns a list of problems; empty = mechanically sound.
function problems(j, minChains = 20) {
  if (!j) return ['unparseable'];
  const out = [], w = (j.words || []).map(x => x.word);
  if (w.length !== 2 || !(j.chains?.length >= minChains && j.chains.length <= 20)) return ['wrong shape'];
  // ponytail: whole-word prefix match on the word minus a final e/y; misses irregular derivatives (compel -> compulsion), the critic covers those
  const leak = new RegExp(`\\b(${w.map(x => x.toLowerCase().replace(/[ey]$/, '')).join('|')})`, 'i');
  let finalA = 0;
  for (const c of j.chains) {
    if (!c.frame) out.push(`${c.id} no frame`);
    if (!(c.beats?.length >= 2 && c.beats.length <= 5)) { out.push(`${c.id} beat count`); continue; }
    for (const b of c.beats) {
      if (!w.includes(b.best_word) || !w.every(k => typeof b.fit?.[k] === 'number')) out.push(`${c.id} bad beat`);
      else if (b.fit[b.best_word] < Math.max(...w.map(k => b.fit[k]))) out.push(`${c.id} best_word not top fit`);
      if (leak.test(b.text)) out.push(`${c.id} leaks target word`);
    }
    const bests = c.beats.map(b => b.best_word), changed = new Set(bests).size > 1;
    if (c.chain_type === 'flip' && !changed) out.push(`${c.id} flip never flips`);
    if (['stay', 'false_shift'].includes(c.chain_type) && changed) out.push(`${c.id} ${c.chain_type} changes answer`);
    if (bests.at(-1) === w[0]) finalA++;
  }
  const share = finalA / j.chains.length;
  if (share < 0.3 || share > 0.7) out.push(`final answer imbalance ${finalA}/${j.chains.length}`);
  return out;
}
const good = id => { const j = load(`${ROOT}/sets/${id}.json`); return !!j?.qa && problems(j, 13).length === 0; };

async function generate(id) {
  const p = pairs[id], setId = `${slug(p.word)}-${slug(p.contrast_word)}`;
  fs.writeFileSync(`${ROOT}/prompts/_jobs/${id}.md`, tpl.replaceAll('{{WORD}}', p.word).replaceAll('{{CONTRAST}}', p.contrast_word)
    .replaceAll('{{POS}}', p.pos).replaceAll('{{DEFINITION}}', p.definition).replaceAll('{{GLOSS}}', p.contrast_gloss)
    .replaceAll('{{OUT}}', `sets/${id}.json`).replaceAll('{{SET_ID}}', setId).replaceAll('{{ID}}', id));
  const spare = `${ROOT}/unreviewed/${id}.json`; // generated earlier but never reviewed (quota ran out): reuse, do not pay twice
  if (problems(load(spare)).length === 0) fs.renameSync(spare, `${ROOT}/sets/${id}.json`);
  else return false; // Hermes is the generator; this pipeline only audits
  let pr = problems(load(`${ROOT}/sets/${id}.json`));
  if (!pr.length) pr = await review(id);
  if (pr.length && fs.existsSync(`${ROOT}/sets/${id}.json`)) { // keep the evidence, free the slot for a later retry
    fs.writeFileSync(`${ROOT}/rejected/${id}.problems.txt`, pr.join('\n'));
    const noReview = pr[0] === "review returned no verdicts"; // quota, not a content fault: keep the draft for next window
    fs.renameSync(`${ROOT}/sets/${id}.json`, `${ROOT}/${noReview ? "unreviewed" : "rejected"}/${id}.json`);
  }
  return pr.length === 0;
}

// Full QA: Gemini Pro judges every chain; PASS kept, REVISE replaced by its corrected version, REJECT dropped.
async function review(id) {
  fs.writeFileSync(`${ROOT}/prompts/_jobs/review-${id}.md`, reviewTpl.replaceAll("{{IN}}", `sets/${id}.json`).replaceAll("{{OUT}}", `critic/review-${id}.json`));
  await agy(`Read prompts/_jobs/review-${id}.md and follow it exactly.`, CRITIC_MODEL, `review-${id}`);
  const v = load(`${ROOT}/critic/review-${id}.json`), j = load(`${ROOT}/sets/${id}.json`);
  if (!Array.isArray(v)) return ["review returned no verdicts"];
  const by = Object.fromEntries(v.map(x => [x.chain_id, x])), qa = { pass: 0, revised: 0, rejected: 0 };
  j.chains = j.chains.flatMap(c => {
    const r = by[c.id];
    if (r?.verdict === "PASS") { qa.pass++; return [{ ...c, qa: "pass" }]; }
    if (r?.verdict === "REVISE" && r.revised_chain?.beats) { qa.revised++; return [{ ...r.revised_chain, id: c.id, qa: "revised" }]; }
    qa.rejected++; return []; // unreviewed chains are dropped too: nothing unjudged gets published
  });
  j.qa = qa;
  fs.writeFileSync(`${ROOT}/sets/${id}.json`, JSON.stringify(j, null, 1));
  return problems(j, 15);
}

// Independent critic on 6 random chains from the batch; returns {pass, fail, notes}.
async function critic(n, ids) {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sample = Array.from({ length: 8 }, () => { const sid = pick(ids), j = load(`${ROOT}/sets/${sid}.json`); return { sid, words: j.words.map(x => x.word), boundary_rule: j.edge.boundary_rule, chain: pick(j.chains) }; });
  fs.writeFileSync(`${ROOT}/critic/batch-${n}-sample.json`, JSON.stringify(sample, null, 1));
  fs.writeFileSync(`${ROOT}/prompts/_jobs/critic-${n}.md`, criticTpl.replaceAll('{{IN}}', `critic/batch-${n}-sample.json`).replaceAll('{{OUT}}', `critic/batch-${n}-verdict.json`));
  await agy(`Read prompts/_jobs/critic-${n}.md and follow it exactly.`, CRITIC_MODEL, `critic-${n}`);
  const v = load(`${ROOT}/critic/batch-${n}-verdict.json`);
  if (!Array.isArray(v)) return null;
  v.forEach((x, i) => { // a chain that fails the second audit is not published
    if (x.verdict === "PASS" || !sample[i]) return;
    const f = `${ROOT}/sets/${sample[i].sid}.json`, j = load(f);
    j.chains = j.chains.filter(c => c.id !== sample[i].chain.id); j.qa.rejected++;
    fs.writeFileSync(f, JSON.stringify(j, null, 1));
  });
  return { pass: v.filter(x => x.verdict === 'PASS').length, reject: v.filter(x => x.verdict === 'REJECT').length, total: v.length };
}

const todo = JSON.parse(fs.readFileSync(idsFile)).filter(id => !good(id));
// Drafts already waiting in unreviewed/ go first: they only cost a review, so scarce Gemini quota buys the most finished sets.
const spareFirst = id => fs.existsSync(`${ROOT}/unreviewed/${id}.json`) ? 0 : 1;
for (let i = todo.length - 1; i >= 0; i--) if (spareFirst(todo[i])) todo.splice(i, 1); // only audit what Hermes has drafted
say(`START todo=${todo.length} batch=${batchSize} conc=${conc}`);
for (let n = 1; todo.length; n++) {
  const batch = todo.splice(0, +batchSize), queue = [...batch], ok = [];
  await Promise.all(Array.from({ length: +conc }, async () => { while (queue.length) { const id = queue.shift(); if (await generate(id)) ok.push(id); } }));
  say(`batch ${n}: generated ${ok.length}/${batch.length} clean after full review (ids ${batch[0]}..${batch.at(-1)})`);
  if (ok.length < batch.length * 0.6) { say(`STOPPED batch ${n}: too many mechanical failures or quota exhausted — see rejected/ and logs/`); break; }
  const c = await critic(n, ok);
  if (!c) { say(`STOPPED batch ${n}: critic returned no verdict (likely quota)`); break; }
  say(`batch ${n}: critic ${c.pass}/${c.total} PASS, ${c.reject} REJECT`);
  if (c.reject >= 1 || c.pass < c.total * 0.75) { say(`STOPPED batch ${n}: critic gate failed — see critic/batch-${n}-verdict.json`); break; }
}
if (!todo.length) say('ALL DONE (rerun to retry anything in rejected/)');
