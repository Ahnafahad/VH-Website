/**
 * Last Word content tooling (run with tsx; see content/last-word/README.md).
 *
 *   npm run last-word:validate-content [-- --strict]   report every set; exit 1 on a broken file,
 *                                                      or (--strict) on any error at all
 *   npm run last-word:import-content -- <folder|file>  convert pipeline sets into content/last-word/sets/
 *   npm run last-word:set-status -- <set_id|all-audited> <status>  move sets through draft → audited → approved → published
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { convertPipelineSet, isPipelineSet } from '../../src/features/last-word/content/convert';
import { CONTENT_DIR, PLAYER_STATUSES, readContent } from '../../src/features/last-word/content/load';
import { lastWordSetSchema, reviewStatuses, type ReviewStatus } from '../../src/features/last-word/content/schema';

const [command, ...args] = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const positional = args.filter(arg => !arg.startsWith('--'));
const fail = (message: string): never => { console.error(message); process.exit(1); };

if (command === 'validate') validate();
else if (command === 'import') importSets(positional[0] ?? fail('Usage: import <folder|file>'));
else if (command === 'status') setStatus(positional[0] ?? fail('Usage: status <set_id> <status>'), positional[1] as ReviewStatus);
else fail('Commands: validate | import <folder|file> | status <set_id> <status>');

function validate() {
  const report = readContent();
  let errors = 0;
  for (const { file, errors: list } of report.failures) {
    console.log(`✗ ${file} — not loadable`);
    list.forEach(e => console.log(`    ✗ ${e}`));
  }
  for (const { file, set, problems, playableChains } of report.sets) {
    const visible = PLAYER_STATUSES.includes(set.status) ? 'players' : 'editors only';
    console.log(`${problems.some(p => p.level === 'error') ? '!' : '✓'} ${file}  ${set.status} (${visible})  ${playableChains}/${set.chains.length} chains playable`);
    for (const p of problems) {
      if (p.level === 'error') errors++;
      if (p.level === 'error' || flags.has('--verbose')) console.log(`    ${p.level === 'error' ? '✗' : '·'} ${p.chainId ? `${p.chainId}: ` : ''}${p.message}`);
    }
    const warnings = problems.filter(p => p.level === 'warning').length;
    if (warnings && !flags.has('--verbose')) console.log(`    · ${warnings} editorial warning(s); --verbose to list`);
  }
  console.log(`\n${report.sets.length} sets loaded, ${report.failures.length} broken, ${errors} chain error(s) (those chains are withheld from play).`);
  if (report.failures.length || (flags.has('--strict') && errors)) process.exit(1);
}

function importSets(target: string) {
  const path = resolve(target);
  if (path.replace(/\\/g, '/').includes('drafts-unaudited')) fail('Refusing drafts-unaudited/: unaudited drafts are never imported.');
  if (!existsSync(path)) fail(`Not found: ${target}`);
  const files = statSync(path).isDirectory() ? readdirSync(path).filter(f => f.endsWith('.json')).map(f => join(path, f)) : [path];
  // A file may hold one set, or a question bank: { sets: [...] }.
  const items = files.flatMap(file => {
    const json = JSON.parse(readFileSync(file, 'utf8')) as { sets?: unknown[] };
    const source = relative(process.cwd(), file).replace(/\\/g, '/');
    return Array.isArray(json.sets) ? json.sets.map((raw, i) => ({ raw, source: `${source}#sets[${i}]`, file })) : [{ raw: json as unknown, source, file }];
  });
  for (const { raw, source, file } of items) {
    try {
      const set = isPipelineSet(raw) ? convertPipelineSet(raw, source) : lastWordSetSchema.parse(raw);
      const out = join(CONTENT_DIR, `${set.set_id}.json`);
      // Re-importing must never silently promote or demote an editor's decision.
      if (existsSync(out)) set.status = (JSON.parse(readFileSync(out, 'utf8')) as { status: ReviewStatus }).status;
      writeFileSync(out, JSON.stringify(set, null, 2) + '\n');
      console.log(`✓ ${source.startsWith(basename(file)) ? source : basename(file)} → content/last-word/sets/${set.set_id}.json (${set.status})`);
    } catch (error) {
      console.log(`✗ ${basename(file)}: ${(error as Error).message.slice(0, 2000)}`);
      process.exitCode = 1;
    }
  }
  console.log('\nNext: npm run last-word:validate-content');
}

function setStatus(setId: string, status: ReviewStatus) {
  if (!reviewStatuses.includes(status)) fail(`Status must be one of ${reviewStatuses.join(', ')}.`);
  // `all-audited` promotes every audited set in one go (editor-approved bank).
  if (setId === 'all-audited') {
    for (const { set } of readContent().sets) if (set.status === 'audited') setStatus(set.set_id, status);
    return;
  }
  const file = join(CONTENT_DIR, `${setId}.json`);
  if (!existsSync(file)) fail(`No set ${setId} in content/last-word/sets/.`);
  const set = JSON.parse(readFileSync(file, 'utf8')) as { status: ReviewStatus };
  if (PLAYER_STATUSES.includes(status) && status !== set.status) {
    const loaded = readContent().sets.find(item => item.set.set_id === setId);
    if (!loaded || loaded.problems.some(p => p.level === 'error' && !p.chainId)) fail('The set has set-level errors; fix them before approving.');
  }
  set.status = status;
  writeFileSync(file, JSON.stringify(set, null, 2) + '\n');
  console.log(`${setId}: ${status}`);
}
