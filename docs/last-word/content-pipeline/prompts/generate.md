# Task: author Last Word content for ONE word pair

You are the semantic content architect for a vocabulary game called Last Word. The player sees two similar words and a situation revealed in 2–5 beats. After each beat they choose the word that BEST describes the situation at that moment. New context may keep the answer, flip it, narrow it, reframe motive or tone, or look important while correctly leaving the answer unchanged. The learning target is the BOUNDARY between the two meanings, not definitions.

## The pair
- Word A: {{WORD}} ({{POS}}) — {{DEFINITION}}
- Word B: {{CONTRAST}} — note from curriculum: {{GLOSS}}
- Learners: age 17–20, university-admission candidates, English level B2–C1. Use broad, ordinary contexts any such student understands; no specialist or trivia knowledge.

## What to produce
One JSON object written to `{{OUT}}`, exactly matching the shape below.

1. `words`: for each of the two words — intended sense for this comparison, concise meaning, connotation, register, grammar notes, 3–5 collocations, the commonest learner misconception.
2. `semantic_axes`: 2–4 dimensions that actually separate the words (motive, degree, reasonableness, response to evidence, speaker evaluation, formality, and so on).
3. `edge`: one-line boundary rule; decisive clues favouring A; decisive clues favouring B; clues that are irrelevant and must NOT cause a switch; misconception tags M1, M2, M3.
4. `anchors`: for each word 6 unmistakable positive example sentences and 6 counterexamples (sentences where that word would be wrong); plus 4 borderline sentences with the better word and a note.
5. `chains`: exactly 20 playable chains with this mix — 6 stay, 6 flip, 3 narrow, 2 false_shift, 2 from reframe/corrupt/rehabilitate, 1 precision. Mark 4 of the 20 as `"transfer": true`; those must use domains that appear nowhere else in this file (relationships, sport, travel, household, public situations, abstract argument, short dialogue).

## Rules for every chain
- 2–5 beats, most with 3. It reads as one coherent evolving situation. Each later beat adds real evidence.
- SAME TARGET: every beat of a chain must be about the same actor and the same action, trait or thing, so the chosen word always labels the same subject. Never let a flip come from switching to a different actor or a different action. State that subject in the chain's `frame` field as a short sentence with a blank the word fills, for example "What the dean did to the professor: ___" or "Maya's attitude is ___". From beat 1 the frame's subject must already be present and judgeable in the text.
- Two failures a reviewer has already caught, do not repeat them: (1) a flip caused by moving to a different action (handling suppliers in beat 1, measuring sugar in beat 2) — the action must be the same one, seen with new evidence; (2) a first beat where both words are equally plausible but the scores pretend one is clearly better — either make beat 1 decisive or score it honestly close and label the chain narrow.
- If the answer flips, one specific semantic clue causes it. If it stays, the new detail is plausibly distracting but not deceptive.
- Never use either target word, or a word built from the same root, inside the context text.
- No dictionary-definition phrasing as the scenario. No repeated keyword pattern that gives the answer away.
- Vary names, settings, sentence shapes, domains and narrative structure across the 20. Do not reuse a domain more than twice. Use names from many cultures.
- No stereotypes; never tie a negative word to a nationality, religion, gender, disability, class or occupation.
- No ambiguous pronouns. No inference of unstated motive unless the beat explicitly supports it.
- Across the 20 chains, the final best word should be A about half the time and B about half the time, in no regular pattern.
- `fit` is 0.00–1.00 for both words on every beat. FAIRNESS: if a competent speaker would find both words equally natural, either give them similar fit scores, or rewrite the context until one is clearly more precise. Never manufacture certainty.
- `shift_type` per beat: one of initial, stay, flip, narrow, false_shift, reframe, corrupt, rehabilitate.
- Difficulty dimensions are each 1–5 and rated independently.
- `feedback_short` max 22 words and must name the decisive clue. `feedback_deep` max 80 words. `contrast_rule` is one memorable line. `hint` points at where to look without giving the answer.

## Self-check before writing
For each chain ask: could the other word be equally correct? Does it depend on cultural assumptions or outside facts? Is a keyword leaking the answer? Did the context change for a semantic reason? Does the feedback name the real clue? Rewrite any chain that fails.

## Output shape
```json
{
  "set_id": "{{SET_ID}}",
  "source_pair_id": {{ID}},
  "words": [{"word": "", "sense": "", "concise_meaning": "", "connotation": "", "register": "", "grammar": "", "collocations": [""], "misconceptions": [""]}],
  "semantic_axes": [{"id": "snake_case", "description": ""}],
  "edge": {"a": "", "b": "", "boundary_rule": "", "clues_a": [""], "clues_b": [""], "irrelevant_clues": [""], "misconceptions": {"M1": "", "M2": "", "M3": ""}},
  "anchors": {"positive": {"<word a>": [""], "<word b>": [""]}, "counter": {"<word a>": [""], "<word b>": [""]}, "borderline": [{"text": "", "best_word": "", "note": ""}]},
  "chains": [{
    "id": "{{SET_ID}}_001", "domain": "", "transfer": false, "chain_type": "stay|flip|narrow|false_shift|reframe|corrupt|rehabilitate|precision", "difficulty": 3, "frame": "",
    "beats": [{
      "text": "", "best_word": "", "fit": {"<word a>": 0.0, "<word b>": 0.0}, "decisive_clue": "", "reason": "", "shift_type": "initial",
      "difficulty": {"lexical_difficulty": 1, "semantic_distance": 1, "context_length": 1, "implicitness": 1, "ambiguity": 1, "cultural_specificity": 1, "processing_pressure": 1},
      "misconception_by_wrong_choice": {"<the other word>": "M1"}
    }],
    "feedback_short": "", "feedback_deep": "", "contrast_rule": "", "hint": ""
  }]
}
```
Use the two words in lower case everywhere as keys and values. Write only the file `{{OUT}}` containing valid JSON and nothing else. Do not modify any other file. Then print one line: `DONE`.
