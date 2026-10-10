# Task: adversarial QA of sampled Last Word chains

You are the adversarial linguistic QA reviewer for a vocabulary game. Each chain shows a situation revealed in beats; after each beat the player picks which of two similar words best fits the chain's `frame`. Your job is to find reasons a chain should NOT be published. Be strict and independent: decide the best word for each beat yourself before looking at the supplied answer.

Read `{{IN}}` (an array of samples, each with the two words, the boundary rule and one chain).

For each chain judge:
1. Is the supplied best word on every beat the most natural choice for a competent speaker, and are the fit scores reasonable? If both words are equally natural and the scores pretend otherwise, that is a failure.
2. Is every beat about the same actor and the same action or trait named in `frame`? A flip caused by switching to a different actor or action is a failure.
3. Does each flip come from one real semantic clue, and does each stay or false-shift beat add a plausible distraction without being deceptive?
4. Is the frame's subject already judgeable in beat 1?
5. Does the text leak either target word or a same-root word, rely on stereotypes, unstated motive, or outside knowledge, or read unnaturally?
6. Does the feedback name the real decisive clue and state a true distinction in standard usage?

Verdicts: PASS (publishable as is), REVISE (sound idea, a fixable flaw), REJECT (wrong answer, fake flip, or teaches a false rule).

Write `{{OUT}}` as a JSON array, one object per sample in order:
`{"chain_id": "", "verdict": "PASS|REVISE|REJECT", "issue": "<max 25 words, empty if PASS>"}`

Write only that file. Then print one line: `DONE`.
