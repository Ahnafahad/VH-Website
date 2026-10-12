import { lastWordSetSchema, type LastWordSet } from './schema';

/** Content-pipeline output (docs/last-word/content-pipeline/prompts/generate.md). */
export interface PipelineSet {
  set_id: string;
  source_pair_id?: number;
  words: { word: string; sense: string; connotation: string; register: string; misconceptions: string[] }[];
  semantic_axes: { id: string; description: string }[];
  edge: { a: string; b: string; boundary_rule: string; clues_a: string[]; clues_b: string[]; irrelevant_clues: string[]; misconceptions?: Record<string, string> };
  anchors?: { positive?: Record<string, string[]>; counter?: Record<string, string[]> };
  chains: {
    id: string; domain: string; transfer?: boolean; chain_type?: string; difficulty: number; frame?: string;
    beats: { text: string; best_word: string; fit: Record<string, number>; decisive_clue: string; reason: string; shift_type: string; difficulty: Record<string, number>; misconception_by_wrong_choice?: Record<string, string> }[];
    feedback_short: string; feedback_deep: string; contrast_rule: string; hint: string; qa?: string;
  }[];
  qa?: { pass: number; revised: number; rejected: number };
}

export const isPipelineSet = (value: unknown): value is PipelineSet =>
  typeof value === 'object' && value !== null && 'edge' in value && !('schema_version' in value);

/**
 * Pipeline → runtime. Purely mechanical: every string is copied verbatim; nothing is reworded.
 * Fields the pipeline lacks are derived by these documented rules (content/last-word/README.md):
 *   title      = the words joined with " / "
 *   status     = "audited" when the critic's `qa` block is present, else "draft"
 *   edge.id    = "<a>__<b>", each word lower-cased, accents removed, other characters → "-"
 *   domain     = lower-cased, non [a-z0-9_-] characters → "_"
 *   purpose    = "transfer" when `transfer: true`, else "practice" (diagnostics are chosen at runtime)
 *   characters = [] (not supplied; the scheduler then varies by domain only)
 *   difficulty = pipeline value rounded and clamped to 0–8
 *   beat.id    = "<chain id>_b<n>"
 *   hints      = { attention: chain.hint, axis: first semantic axis description, contrast: chain.contrast_rule }
 */
export function convertPipelineSet(input: PipelineSet, sourcePath?: string): LastWordSet {
  const { a, b } = input.edge;
  const edgeId = `${slug(a)}__${slug(b)}`;
  const axis = input.semantic_axes[0]?.description ?? input.edge.boundary_rule;
  return lastWordSetSchema.parse({
    schema_version: 1,
    set_id: input.set_id,
    title: input.words.map(word => word.word).join(' / '),
    status: input.qa ? 'audited' : 'draft',
    source: { format: 'pipeline', path: sourcePath, source_pair_id: input.source_pair_id, qa: input.qa },
    words: input.words.map(({ word, sense, connotation, register, misconceptions }) => ({ word, sense, connotation, register, misconceptions })),
    semantic_axes: input.semantic_axes,
    edges: [{ id: edgeId, ...pick(input.edge, ['a', 'b', 'boundary_rule', 'clues_a', 'clues_b', 'irrelevant_clues', 'misconceptions']) }],
    anchors: input.anchors && { positive: input.anchors.positive ?? {}, counter: input.anchors.counter ?? {} },
    chains: input.chains.map(chain => ({
      id: chain.id,
      edge_id: edgeId,
      domain: chain.domain.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+/, '') || 'general',
      characters: [],
      purpose: chain.transfer ? 'transfer' : 'practice',
      chain_type: chain.chain_type,
      frame: chain.frame,
      difficulty: Math.max(0, Math.min(8, Math.round(chain.difficulty))),
      beats: chain.beats.map((beat, i) => ({
        id: `${chain.id}_b${i + 1}`,
        ...pick(beat, ['text', 'best_word', 'fit', 'decisive_clue', 'reason', 'shift_type', 'difficulty']),
        misconception_by_wrong_choice: beat.misconception_by_wrong_choice ?? {},
      })),
      feedback_short: chain.feedback_short,
      feedback_deep: chain.feedback_deep,
      contrast_rule: chain.contrast_rule,
      hints: { attention: chain.hint, axis, contrast: chain.contrast_rule },
      qa: chain.qa,
    })),
  });
}

function pick<T extends object, K extends keyof T>(value: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]])) as Pick<T, K>;
}

const slug = (word: string) => word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-+|-+$/g, '');
