import { z } from 'zod';

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);
const dimension = z.number().int().min(1).max(5);
export const difficultySchema = z.strictObject({
  lexical_difficulty: dimension,
  semantic_distance: dimension,
  context_length: dimension,
  implicitness: dimension,
  ambiguity: dimension,
  cultural_specificity: dimension,
  processing_pressure: dimension,
});
const hintsSchema = z.strictObject({ attention: text, axis: text, contrast: text });
export const shiftTypes = ['initial', 'stay', 'flip', 'false_shift', 'narrow', 'rehabilitate', 'corrupt', 'reframe', 'precision'] as const;
export const lastWordBeatSchema = z.strictObject({
  id,
  text,
  best_word: text,
  fit: z.record(text, z.number().min(0).max(1)),
  decisive_clue: text,
  reason: text,
  shift_type: z.enum(shiftTypes),
  difficulty: difficultySchema,
  misconception_by_wrong_choice: z.record(text, text),
  /** Beat-specific hints; when absent the chain's hints apply. */
  hints: hintsSchema.optional(),
});
export const lastWordChainSchema = z.strictObject({
  id,
  edge_id: id,
  domain: id,
  characters: z.array(text).default([]),
  purpose: z.enum(['tutorial', 'diagnostic', 'probe', 'practice', 'transfer']),
  chain_type: z.enum(['stay', 'flip', 'narrow', 'false_shift', 'reframe', 'corrupt', 'rehabilitate', 'precision']).optional(),
  /** The subject the chosen word labels, e.g. "Maya's attitude is ___". */
  frame: text.optional(),
  difficulty: z.number().int().min(0).max(8),
  beats: z.array(lastWordBeatSchema).min(1).max(5),
  feedback_short: text,
  feedback_deep: text,
  contrast_rule: text,
  hints: hintsSchema,
  /** Critic verdict carried from the content pipeline. */
  qa: z.enum(['pass', 'revised']).optional(),
});

/** Editorial gate. Players only ever see `approved` and `published` sets (see content/load.ts). */
export const reviewStatuses = ['draft', 'audited', 'approved', 'published'] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

/**
 * The runtime authoring contract: shape and cross-references only. Linguistic quality rules
 * (leaks, fit order, shift consistency, feedback length) live in content/problems.ts so one bad
 * chain can be reported and withheld without rejecting the whole set.
 */
export const lastWordSetSchema = z.strictObject({
  schema_version: z.literal(1),
  set_id: id,
  title: text,
  status: z.enum(reviewStatuses),
  source: z.strictObject({
    format: z.enum(['hand-authored', 'pipeline']),
    path: text.optional(),
    source_pair_id: z.number().int().optional(),
    qa: z.strictObject({ pass: z.number().int(), revised: z.number().int(), rejected: z.number().int() }).optional(),
  }).optional(),
  words: z.array(z.strictObject({
    word: text,
    sense: text,
    connotation: text,
    register: text,
    misconceptions: z.array(text).min(1),
  })).min(2).max(5),
  semantic_axes: z.array(z.strictObject({ id, description: text })).min(1),
  /** Clear examples per word, used when a word itself (not just the boundary) is weak (§32). */
  anchors: z.strictObject({ positive: z.record(text, z.array(text)), counter: z.record(text, z.array(text)) }).optional(),
  edges: z.array(z.strictObject({
    id,
    a: text,
    b: text,
    boundary_rule: text,
    clues_a: z.array(text).min(1),
    clues_b: z.array(text).min(1),
    irrelevant_clues: z.array(text).min(1),
    /** Tag → description, e.g. M1 → "treats any refusal to quit as obstinacy". */
    misconceptions: z.record(text, text).optional(),
  })).min(1),
  chains: z.array(lastWordChainSchema).min(1),
}).superRefine((set, ctx) => {
  const problem = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path });
  const words = set.words.map(word => word.word);
  const unique = (values: string[], path: (string | number)[]) => {
    if (new Set(values).size !== values.length) problem('Identifiers must be unique.', path);
  };
  unique(words, ['words']);
  unique(set.semantic_axes.map(axis => axis.id), ['semantic_axes']);
  unique(set.edges.map(edge => edge.id), ['edges']);
  unique(set.edges.map(edge => [edge.a, edge.b].sort().join('__')), ['edges']);
  unique(set.chains.map(chain => chain.id), ['chains']);
  set.edges.forEach((edge, i) => {
    if (edge.a === edge.b || !words.includes(edge.a) || !words.includes(edge.b)) problem('Edges must connect two different words in this set.', ['edges', i]);
  });
  set.chains.forEach((chain, ci) => {
    const path = ['chains', ci];
    if (!set.edges.some(edge => edge.id === chain.edge_id)) problem('Unknown edge_id.', [...path, 'edge_id']);
    unique(chain.beats.map(beat => beat.id), [...path, 'beats']);
    chain.beats.forEach((beat, bi) => {
      const bp = [...path, 'beats', bi];
      if (!words.includes(beat.best_word)) problem('Best word is not in the set.', [...bp, 'best_word']);
      if (Object.keys(beat.fit).length !== words.length || words.some(word => beat.fit[word] === undefined)) problem('Fit must cover exactly every candidate word.', [...bp, 'fit']);
      if (Object.keys(beat.misconception_by_wrong_choice).some(word => word === beat.best_word || !words.includes(word))) problem('Misconceptions may only be keyed by alternative words.', [...bp, 'misconception_by_wrong_choice']);
    });
  });
});

export type DifficultyDimensions = z.infer<typeof difficultySchema>;
export type LastWordBeat = z.infer<typeof lastWordBeatSchema>;
export type LastWordChain = z.infer<typeof lastWordChainSchema>;
export type LastWordSet = z.infer<typeof lastWordSetSchema>;
export type LastWordSetInput = z.input<typeof lastWordSetSchema>;
