# Task: classify word pairs for a context-shift vocabulary game

Read `source/pairs.tsv` (888 rows: id, word, contrast, type, pos, gloss).

For every row decide whether the pair is FLIPPABLE.

FLIPPABLE = both words can plausibly describe the same person, action or situation, so that adding one new detail of context can make either word the more precise choice. The difference is one of meaning, degree, motive, connotation or reasonableness. Examples: persistent/obstinate, coerce/compel, pacify/appease, infamous/famous, confident/arrogant, imperial/imperious (only if a single evolving situation could genuinely move between them).

NOT FLIPPABLE = the words merely look or sound alike but describe unrelated things (martial/marital, proscribe/prescribe), or differ only in grammar form or number (criterion/criteria, stratum/strata), or are different parts of speech, or could never both be candidates for the same situation.

Judge by meaning, not by the `type` column, which is unreliable. Be strict: when a natural short story could not move from one word to the other, mark it false.

Write the result to `source/triage.json` as a JSON array with exactly 888 objects, one per input row, in input order:
`{"id": <number>, "flippable": true|false, "reason": "<max 12 words>"}`

Write only that file. Do not modify any other file. When done, print one line: `DONE <count true> <count false>`.
