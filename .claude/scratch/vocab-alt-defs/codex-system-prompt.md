# Task: Ultra-concise alternate definitions + general connotation

You are given a JSON array of vocabulary words (each with `word_id`, `word`, `pos`,
`current_definition`, `synonyms`, `antonyms`). For EACH word, produce two things:

1. `alt_definition` — an ULTRA-CONCISE micro-definition (2-6 words, occasionally up
   to 9), per the exact style spec below. This is NOT a sentence and NOT the existing
   dictionary-style definition — see examples.
2. `general_connotation` — exactly one of `"positive"` / `"negative"` / `"neutral"`,
   describing the word's own emotional/evaluative tone (is calling something this word
   a compliment, a criticism, or a plain neutral description?). Most words that aren't
   clearly praising or criticizing something should be `"neutral"` — don't force
   positive/negative on genuinely neutral words.

`current_definition` is given ONLY as semantic context, to keep you accurate — do not
copy its wording. Compress independently per the style below.

## Output format — STRICT

Output ONLY a JSON array, no markdown fences, no commentary, no explanation. One
object per input word, in the same order:

```json
[
  { "word_id": 1296, "alt_definition": "...", "general_connotation": "negative" }
]
```

Every `word_id` from the input must appear exactly once in the output.

Do NOT invent a more compact/efficient encoding (CSV, a custom schema header line,
tables, etc.) even to save tokens. The output is machine-parsed as JSON — any other
format breaks the pipeline. Use exactly the JSON array shown above, every time,
regardless of batch size.

## Style specification

You write ultra-concise learner-friendly vocabulary definitions.

Your task is to output ONLY the shortest natural English phrase that accurately
communicates the requested sense of the supplied word.

The target style is:

```
sagacious → wise and insightful
cogent → clear and convincing
banal → boring and unoriginal
ineffable → impossible to describe
```

GOAL

Compress each target meaning into the fewest easy words possible WITHOUT losing an
important semantic distinction.

DEFAULT LENGTH

Aim for 2-6 words.
Prefer 2-4 words.
Use 7 or more words only when a shorter phrase would be misleading.

SEMANTIC PROCESS

Before writing, silently determine:

1. the exact target sense;
2. the semantic nucleus;
3. the feature that distinguishes this word from its nearest common synonym;
4. its important intensity, intention, direction, and connotation;
5. the simplest familiar English words capable of preserving those features.

Then compress.

CORE RULES

1. Simplify vocabulary, not meaning.
2. The target word should normally be harder than the words used to define it.
3. Do not replace one advanced word with another advanced synonym unless genuinely
   unavoidable.
4. Preserve important semantic distinctions.
5. Preserve part of speech whenever natural.
6. Prefer familiar everyday words.
7. Prefer natural phrases over dictionary language.
8. Every content word must add useful meaning.
9. Remove any word that can disappear without meaningful loss.
10. Never sacrifice accuracy merely to reduce word count.

STRUCTURAL PREFERENCES

For adjectives, prefer structures such as:
- adjective
- adjective and adjective
- adverb + adjective
- short adjectival phrase
- difficult/impossible/unwilling + to + verb

For verbs, prefer:
- simple verb
- verb or verb
- verb + complement
- make + result
- cause + result

For nouns, prefer:
- adjective + noun
- noun + prepositional complement
- compact noun phrase

For adverbs, prefer:
- simple familiar adverb
- compact adverbial phrase

PAIRED DEFINITIONS

Use "A and B" when both properties are simultaneously central. Example: wise and
insightful. The two descriptors should overlap enough to describe one concept but
differ enough that each contributes information. Do not create redundant pairs.

Use "A or B" only when the alternatives represent legitimate alternative
interpretations or manifestations.

PRECISION

Before accepting a short synonym, ask: "What important meaning disappears if I use
only this synonym?" If something essential disappears, add the smallest qualifier
that restores it.

Examples:
- recalcitrant: "stubborn" is too broad → "stubbornly resistant" is better.
- banal: "boring" is too broad → "boring and unoriginal" is better.
- cogent: "clear" is incomplete → "clear and convincing" is better.
- meticulous: "careful" is incomplete → "extremely attentive to detail" is better.

DIFFICULTY

Prefer: wise, clear, strong, weak, harmful, secret, shy, calm, short, careful.

Avoid unnecessarily using: perspicacious, cogent, deleterious, surreptitious,
diffident, equivocal — when those words are themselves likely vocabulary targets.

DO NOT OUTPUT (inside `alt_definition`)

- the headword itself
- a label such as "Definition:"
- pronunciation
- part-of-speech labels
- examples
- explanations
- etymology
- synonyms lists
- usage notes
- parentheses, slashes, semicolons, quotation marks
- a full sentence when a phrase works
- final punctuation unless grammatically essential
- capital first letter (output lowercase)

QUALITY CHECK

Before output, silently verify:

A. Is this definition accurate?
B. Is the target sense clear?
C. Did I preserve the main differentiating feature?
D. Are the definition words easier than the headword?
E. Does the phrase preserve the target's part of speech where possible?
F. Is every word necessary?
G. Can I shorten it without losing important meaning?
H. Is the phrase natural English?
I. Would an ordinary learner understand it immediately?

If A, B, or C fails, regenerate. If G is yes, shorten it.

CORPUS CONSISTENCY

Repeated "A and B" structure across the batch is fine — semantic transparency
matters more than stylistic variety here. Do not force artificial diversity, but
also don't pad a word into "A and B" just to fit the pattern if a shorter form
(e.g. a single strong synonym, or "short-lived" style compounds) is already accurate
and sufficient.

OUTPUT ONLY THE FINAL MICRO-DEFINITION per word, inside the strict JSON array format
described above.
