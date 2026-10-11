import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertPipelineSet, isPipelineSet, type PipelineSet } from '../content/convert';
import { readContent, selectPlayable } from '../content/load';
import { contentProblems } from '../content/problems';
import { lastWordSetSchema, type LastWordSet } from '../content/schema';
import { classifyAnswer } from '../core/learning';

const audited = (id: number) => JSON.parse(readFileSync(`docs/last-word/content-pipeline/sets-audited/${id}.json`, 'utf8')) as PipelineSet;
const repo = readContent();
const byId = (id: string) => repo.sets.find(item => item.set.set_id === id)!.set;
const clone = (set: LastWordSet): LastWordSet => structuredClone(set);
const errors = (set: LastWordSet) => contentProblems(set).filter(p => p.level === 'error').map(p => `${p.chainId ?? ''} ${p.message}`);

describe('repository content', () => {
  it('every file in content/last-word/sets loads', () => {
    expect(repo.failures).toEqual([]);
    expect(repo.sets.map(item => item.set.set_id)).toEqual(expect.arrayContaining([
      'confident-arrogant', 'persistent-obstinate', 'assure-ensure', 'frugal-thrifty-miserly',
      'scrupulous-meticulous', 'mortify-horrify', 'eccentric-eclectic', 'inherent-innate', 'agnostic-atheist']));
  });

  it('every best word classifies as best', () => {
    for (const { set } of repo.sets) for (const beat of set.chains.flatMap(chain => chain.beats)) expect(classifyAnswer(beat, beat.best_word)).toBe('best');
  });

  it('players never see audited, unapproved pipeline sets', () => {
    const visible = selectPlayable(repo).map(set => set.set_id);
    expect(visible).toContain('confident-arrogant');
    expect(visible).not.toContain('scrupulous-meticulous');
  });

  it('chains with errors are withheld, the rest of the set still plays', () => {
    const playable = selectPlayable(repo, ['audited']).find(set => set.set_id === 'mortify-horrify')!;
    expect(playable.chains.map(chain => chain.id)).not.toContain('mortify-horrify_017');
    expect(playable.chains).toHaveLength(19);
  });
});

describe('pipeline converter', () => {
  it('is deterministic and copies wording verbatim', () => {
    const source = audited(291);
    const a = convertPipelineSet(source, 'x.json');
    expect(convertPipelineSet(source, 'x.json')).toEqual(a);
    expect(a.status).toBe('audited');
    expect(a.edges[0].id).toBe('mortify__horrify');
    expect(a.chains[0].beats[0].text).toBe(source.chains[0].beats[0].text);
    expect(a.chains[0].feedback_short).toBe(source.chains[0].feedback_short);
    expect(a.chains[0].hints.attention).toBe(source.chains[0].hint);
    expect(a.chains[0].beats[1].id).toBe(`${source.chains[0].id}_b2`);
  });

  it('maps transfer chains to the transfer purpose and everything else to practice', () => {
    const set = convertPipelineSet(audited(400));
    const transfer = audited(400).chains.filter(chain => chain.transfer).map(chain => chain.id);
    for (const chain of set.chains) expect(chain.purpose).toBe(transfer.includes(chain.id) ? 'transfer' : 'practice');
  });

  it('marks a set without a critic block as draft', () => {
    const { qa: _qa, ...draft } = audited(133);
    expect(convertPipelineSet(draft as PipelineSet).status).toBe('draft');
  });

  it('tells the two formats apart', () => {
    expect(isPipelineSet(audited(133))).toBe(true);
    expect(isPipelineSet(byId('confident-arrogant'))).toBe(false);
  });
});

describe('content problems (ported run-gen.mjs checks)', () => {
  const base = () => clone(byId('persistent-obstinate'));

  it('the hand-authored sets are clean', () => {
    for (const id of ['confident-arrogant', 'persistent-obstinate', 'assure-ensure', 'frugal-thrifty-miserly']) expect(errors(byId(id))).toEqual([]);
  });

  it('catches a target word or its stem leaking into context', () => {
    const set = base();
    set.chains[3].beats[1].text = 'She stays persistently on the same plan.';
    expect(errors(set).join()).toMatch(/candidate word or its stem/);
  });

  it('catches a best word that is not the top fit, and ties', () => {
    const set = base();
    const beat = set.chains[3].beats[0];
    beat.fit = { persistent: 0.5, obstinate: 0.8 };
    beat.best_word = 'persistent';
    expect(errors(set).join()).toMatch(/not the top fit/);
    beat.fit = { persistent: 0.8, obstinate: 0.8 };
    expect(errors(set).join()).toMatch(/tie/);
  });

  it('catches shift types that contradict the answer path', () => {
    const set = base();
    const flip = set.chains.find(chain => chain.id === 'po_flip')!;
    flip.beats[1].shift_type = 'stay';
    expect(errors(set).join()).toMatch(/stay beat changes the answer/);
    flip.chain_type = 'stay';
    expect(errors(set).join()).toMatch(/stay chain changes the answer/);
  });

  it('enforces feedback length and the one-beat diagnostic rule', () => {
    const set = base();
    set.chains[3].feedback_short = Array(23).fill('word').join(' ');
    set.chains[3].beats = set.chains[3].beats.slice(0, 1);
    expect(errors(set).join()).toMatch(/23 words/);
    expect(errors(set).join()).toMatch(/one beat/);
  });

  it('reports a paraphrased decisive clue as a warning only', () => {
    const set = base();
    set.chains[3].beats[0].decisive_clue = 'a paraphrase that is not in the text';
    expect(errors(set)).toEqual([]);
    expect(contentProblems(set).some(p => p.level === 'warning' && /excerpt/.test(p.message))).toBe(true);
  });
});

describe('content folder gate', () => {
  it('rejects anything that came from drafts-unaudited, and broken files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lw-'));
    const set = { ...clone(byId('assure-ensure')), set_id: 'leak-test', status: 'approved', source: { format: 'pipeline', path: 'docs/last-word/content-pipeline/drafts-unaudited/1.json' } };
    expect(lastWordSetSchema.safeParse(set).success).toBe(true);
    writeFileSync(join(dir, 'leak.json'), JSON.stringify(set));
    writeFileSync(join(dir, 'broken.json'), '{');
    const report = readContent(dir);
    expect(report.sets).toEqual([]);
    expect(report.failures.map(f => f.file).sort()).toEqual(['broken.json', 'leak.json']);
  });
});
