import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentProblems, playableChainIds, type ContentProblem } from './problems';
import { lastWordSetSchema, type LastWordSet, type ReviewStatus } from './schema';

/** The only folder the game reads. Pipeline drafts are never in it; see the import script. */
export const CONTENT_DIR = join(process.cwd(), 'content', 'last-word', 'sets');
export const PLAYER_STATUSES: readonly ReviewStatus[] = ['approved', 'published'];

export interface LoadedSet { file: string; set: LastWordSet; problems: ContentProblem[]; playableChains: number }
export interface ContentReport { sets: LoadedSet[]; failures: { file: string; errors: string[] }[] }

/** Reads and validates every set file. Server-only (uses the filesystem). */
export function readContent(dir = CONTENT_DIR): ContentReport {
  const report: ContentReport = { sets: [], failures: [] };
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (error) {
      report.failures.push({ file, errors: [`Invalid JSON: ${(error as Error).message}`] });
      continue;
    }
    const parsed = lastWordSetSchema.safeParse(raw);
    if (!parsed.success) {
      report.failures.push({ file, errors: parsed.error.issues.map(issue => `${issue.path.join('.') || '(set)'}: ${issue.message}`) });
      continue;
    }
    if (parsed.data.source?.path?.includes('drafts-unaudited')) {
      report.failures.push({ file, errors: ['Came from drafts-unaudited/, which is never playable.'] });
      continue;
    }
    if (report.sets.some(item => item.set.set_id === parsed.data.set_id)) {
      report.failures.push({ file, errors: [`Duplicate set_id ${parsed.data.set_id}.`] });
      continue;
    }
    const problems = contentProblems(parsed.data);
    report.sets.push({ file, set: parsed.data, problems, playableChains: playableChainIds(parsed.data, problems).size });
  }
  return report;
}

/** What the game may show: gated by review status, with chains that have errors withheld. */
export function selectPlayable(report: ContentReport, statuses: readonly ReviewStatus[] = PLAYER_STATUSES): LastWordSet[] {
  return report.sets
    .filter(({ set, problems }) => statuses.includes(set.status) && !problems.some(p => p.level === 'error' && !p.chainId))
    .map(({ set, problems }) => {
      const keep = playableChainIds(set, problems);
      return { ...set, chains: set.chains.filter(chain => keep.has(chain.id)) };
    })
    .filter(set => set.chains.length > 0);
}

// ponytail: process-lifetime cache in production; content ships with the deploy, so it cannot change underneath.
let cached: ContentReport | null = null;
export function loadContent(): ContentReport {
  if (process.env.NODE_ENV !== 'production') return readContent();
  return (cached ??= readContent());
}

export const loadPlayableSets = (statuses?: readonly ReviewStatus[]) => selectPlayable(loadContent(), statuses);
