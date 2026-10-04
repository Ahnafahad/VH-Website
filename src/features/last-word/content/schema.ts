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
export const lastWordBeatSchema = z.strictObject({
  id,
  text,
  best_word: text,
  fit: z.record(text, z.number().min(0).max(1)),
  decisive_clue: text,
  reason: text,
  shift_type: z.enum(['initial', 'stay', 'flip', 'false_shift', 'narrow', 'rehabilitate', 'corrupt', 'reframe']),
  difficulty: difficultySchema,
  misconception_by_wrong_choice: z.record(text, text),
  hints: hintsSchema,
});
export const lastWordChainSchema = z.strictObject({
  id,
  edge_id: id,
  domain: id,
  characters: z.array(text).min(1),
  purpose: z.enum(['tutorial', 'diagnostic', 'probe', 'practice', 'transfer']),
  difficulty: z.number().int().min(0).max(8),
  beats: z.array(lastWordBeatSchema).min(1).max(5),
  feedback_short: text.refine(value => value.split(/\s+/).length <= 22, 'Use at most 22 words.'),
  feedback_deep: text.refine(value => value.split(/\s+/).length <= 80, 'Use at most 80 words.'),
  contrast_rule: text,
  hints: hintsSchema,
});

/** The sole runtime authoring contract. Unknown fields are rejected at every object level. */
export const lastWordSetSchema = z.strictObject({
  schema_version: z.literal(1),
  set_id: id,
  title: text,
  words: z.array(z.strictObject({
    word: text,
    sense: text,
    connotation: text,
    register: text,
    misconceptions: z.array(text).min(1),
  })).min(2).max(5),
  semantic_axes: z.array(z.strictObject({ id, description: text })).min(1),
  edges: z.array(z.strictObject({
    id,
    a: text,
    b: text,
    boundary_rule: text,
    clues_a: z.array(text).min(1),
    clues_b: z.array(text).min(1),
    irrelevant_clues: z.array(text).min(1),
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
    if (chain.beats.length < 2 && chain.purpose !== 'diagnostic') problem('Only cold diagnostic items may contain one beat.', [...path, 'beats']);
    unique(chain.beats.map(beat => beat.id), [...path, 'beats']);
    chain.beats.forEach((beat, bi) => {
      const bp = [...path, 'beats', bi];
      if (!words.includes(beat.best_word)) problem('Best word is not in the set.', [...bp, 'best_word']);
      if (Object.keys(beat.fit).length !== words.length || words.some(word => beat.fit[word] === undefined)) problem('Fit must cover exactly every candidate word.', [...bp, 'fit']);
      if ((beat.fit[beat.best_word] ?? 0) < 0.7 || words.some(word => beat.fit[word] > beat.fit[beat.best_word])) problem('The explicit best word must have a highest fit of at least 0.7.', [...bp, 'fit']);
      const alternatives = words.filter(word => word !== beat.best_word);
      if (Object.keys(beat.misconception_by_wrong_choice).length !== alternatives.length || alternatives.some(word => !beat.misconception_by_wrong_choice[word])) problem('Supply a misconception or nuance explanation for every alternative only.', [...bp, 'misconception_by_wrong_choice']);
      if (!beat.text.includes(beat.decisive_clue)) problem('The decisive clue must be an exact excerpt of the current beat.', [...bp, 'decisive_clue']);
      if (bi === 0 && beat.shift_type !== 'initial') problem('The first beat must be initial.', [...bp, 'shift_type']);
      if (bi > 0) {
        const changed = chain.beats[bi - 1].best_word !== beat.best_word;
        if (beat.shift_type === 'initial') problem('Only the first beat may be initial.', [...bp, 'shift_type']);
        if (changed && ['stay', 'false_shift', 'narrow'].includes(beat.shift_type)) problem('This shift type requires the same best word.', [...bp, 'shift_type']);
        if (!changed && ['flip', 'rehabilitate', 'corrupt'].includes(beat.shift_type)) problem('This shift type requires a changed best word.', [...bp, 'shift_type']);
      }
      for (const word of words) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(beat.text)) problem('Context must not contain a candidate word.', [...bp, 'text']);
      }
    });
  });
});

export type DifficultyDimensions = z.infer<typeof difficultySchema>;
export type LastWordBeat = z.infer<typeof lastWordBeatSchema>;
export type LastWordChain = z.infer<typeof lastWordChainSchema>;
export type LastWordSet = z.infer<typeof lastWordSetSchema>;
