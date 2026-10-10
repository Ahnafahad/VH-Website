# Task: full adversarial QA and repair of one Last Word set

You are the adversarial linguistic QA reviewer for a vocabulary game. Each chain shows a situation revealed in beats; after each beat the player picks which of two similar words best fits the chain's `frame`. Your job is to find reasons a chain should NOT be published, and to repair the ones that can be repaired.

Read `{{IN}}`. It has the two words, their senses, the boundary rule and 20 chains. Review EVERY chain. For each beat decide the best word yourself before looking at the supplied answer.

Fail a chain when any of these is true:
1. The supplied best word on some beat is not the most natural choice for a competent speaker, or both words are equally natural while the fit scores pretend one is clearly better.
2. A beat is about a different actor or a different action or trait than the `frame` names. A flip caused by moving to a different action is a fake flip.
3. A flip has no single real semantic clue behind it, or a stay/false-shift beat is deceptive rather than merely distracting.
4. The frame's subject cannot be judged from beat 1 alone.
5. The text contains either target word or a same-root word, relies on a stereotype, an unstated motive or outside knowledge, or reads unnaturally.
6. The feedback does not name the real decisive clue, or states a distinction that standard usage does not support.

Verdicts:
- PASS — publishable exactly as is.
- REVISE — the idea is sound and you can fix it with small edits. Provide the full corrected chain in `revised_chain`, same shape and same `id`, `chain_type` kept true to what the chain now does, every field updated to stay consistent (texts, best_word, fit, decisive_clue, reason, shift_type, feedback). The corrected chain must itself pass all six checks.
- REJECT — wrong answer, fake flip that cannot be repaired with small edits, or it teaches a false rule.

These drafts come from a weaker model, so expect real errors and look for them. When you are unsure whether a competent speaker would agree with the supplied answer, that doubt is itself a failure: REVISE until the context makes one word clearly more precise, or REJECT. Also fail any chain whose `frame` does not grammatically fit both words, and any chain that is a near-duplicate of an earlier chain in the same file.

Do not pass a chain out of leniency: a learner will be marked wrong on the strength of it.

Write `{{OUT}}` as a JSON array with one object per chain, in order:
`{"chain_id": "", "verdict": "PASS|REVISE|REJECT", "issue": "<max 25 words, empty if PASS>", "revised_chain": null}`
where `revised_chain` is the full corrected chain object for REVISE and null otherwise.

Write only that file. Do not modify `{{IN}}` or any other file. Then print one line: `DONE`.
