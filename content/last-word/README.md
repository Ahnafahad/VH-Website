# Last Word content

The game plays every JSON file in `content/last-word/sets/` whose `status` is `approved` or `published`. Nothing else is read. No code changes are needed to add content.

## Add content (drop-in)

1. **Pipeline output** (`set_id`, `edge`, `anchors`, `chains`, `qa` …, the shape in `docs/last-word/content-pipeline/prompts/generate.md`):

   ```sh
   npm run last-word:import-content -- path/to/folder-or-file.json   # a question bank { "sets": [...] } works too
   ```

   This converts each file to the runtime format and writes `content/last-word/sets/<set_id>.json`. Sets with a critic `qa` block arrive as `audited`; without one, as `draft`. Anything under `drafts-unaudited/` is refused. Re-importing never changes a set's existing status.

   **Runtime-format files** (they have `schema_version`) can be imported the same way, or copied straight into `content/last-word/sets/`.

2. Check it:

   ```sh
   npm run last-word:validate-content            # summary; exit 1 if a file cannot load
   npm run last-word:validate-content -- --verbose   # also list editorial warnings
   npm run last-word:validate-content -- --strict    # exit 1 on any chain error too (CI gate)
   ```

3. Read the set (preview it in the game at `/vocab/games/last-word?preview=<set_id>` while signed in as staff, or on the editorial page `/admin/last-word`), then promote it:

   ```sh
   npm run last-word:set-status -- <set_id> approved      # or: all-audited approved
   ```

4. Commit the JSON and deploy. Players see it on the next visit.

## Review status

| Status | Meaning | Visible to players |
|---|---|---|
| `draft` | Generated, not critic-reviewed | No |
| `audited` | Passed the pipeline's adversarial critic | No (staff preview only) |
| `approved` | A human editor read it and accepts it | **Yes** |
| `published` | Approved and announced/live (same visibility as approved) | **Yes** |

`set-status` refuses to approve a set with set-level errors. The source curriculum table `vocab_word_contrasts` is never read or written by any of this; game scenarios are a separate bank.

## What the validator checks

`src/features/last-word/content/problems.ts` (ported from `problems()` in `docs/last-word/content-pipeline/scripts/run-gen.mjs`, then extended). It reports; it never rewrites wording.

**Errors** withhold that chain from play (the rest of the set still plays):

- A candidate word or its stem appears in the context text (word minus a final e/y, prefix match; irregular derivatives such as compel → compulsion are not caught).
- `best_word` is not the highest `fit`, or two words tie for the top fit.
- A `stay`/`false_shift` beat changes the answer; a `flip`/`corrupt`/`rehabilitate` beat keeps it; a `flip` chain never flips; a `stay`/`false_shift` chain changes.
- The first beat is not `initial`, or a later beat is.
- `feedback_short` over 22 words, `feedback_deep` over 80 words.
- Fewer than two beats outside a cold diagnostic item.

**Warnings** are for editors:

- `decisive_clue` is not an exact excerpt of the beat (it is then shown quoted rather than highlighted).
- Best fit below 0.7 (§9: below “strongly defensible”).
- A wrong choice under fit 0.4 with no misconception tag.
- No `frame` (the subject the word labels).
- A domain used more than twice; identical beat text in two chains.
- One word is the final answer in too many chains (answer/position bias, §33).

**Schema** (`content/schema.ts`) rejects the whole file for shape errors: unknown fields, an unknown `edge_id`, a `best_word` not in the set, `fit` not covering every word, duplicate ids.

## How pipeline fields are converted

Copied verbatim: words (word, sense, connotation, register, misconceptions), semantic axes, the edge (rule, clues, misconception tags), anchors (positive and counter examples), and every chain and beat string. Derived by fixed rules (`content/convert.ts`):

| Runtime field | Rule |
|---|---|
| `title` | the words joined with " / " |
| `status` | `audited` if the file has `qa`, else `draft` |
| `edges[0].id` | `<a>__<b>` |
| `chain.domain` | lower-cased; characters outside `a-z 0-9 _ -` become `_` |
| `chain.purpose` | `transfer` if `transfer: true`, else `practice`. Diagnostic and probe rounds are chosen at runtime |
| `chain.characters` | `[]` (not supplied) |
| `chain.difficulty` | rounded, clamped to 0–8 |
| `beat.id` | `<chain id>_b<n>` |
| `chain.hints` | attention = `hint`; axis = first semantic axis description; contrast = `contrast_rule` |

Not carried over: per-word `concise_meaning`, `grammar`, `collocations`, and borderline anchors (no runtime use yet).

## Example (runtime format, one chain)

```json
{
  "schema_version": 1,
  "set_id": "persistent-obstinate",
  "title": "The goal and the method",
  "status": "approved",
  "source": { "format": "hand-authored" },
  "words": [
    { "word": "persistent", "sense": "continuing toward a goal despite difficulty", "connotation": "usually positive", "register": "general", "misconceptions": ["all refusal to stop is persistence"] },
    { "word": "obstinate", "sense": "unreasonably refusing to change despite good reason", "connotation": "usually negative", "register": "general", "misconceptions": ["any continued effort is obstinacy"] }
  ],
  "semantic_axes": [{ "id": "adaptability_to_evidence", "description": "whether someone updates a method after strong reasons" }],
  "edges": [{
    "id": "persistent__obstinate", "a": "persistent", "b": "obstinate",
    "boundary_rule": "Persistence keeps the goal while adapting; obstinacy refuses to change despite good reason.",
    "clues_a": ["changes method after feedback"], "clues_b": ["refuses valid evidence"], "irrelevant_clues": ["task takes a long time"],
    "misconceptions": { "M1": "treats any refusal to quit as obstinacy" }
  }],
  "chains": [{
    "id": "po_flip", "edge_id": "persistent__obstinate", "domain": "science_fair", "characters": ["Nila"],
    "purpose": "practice", "chain_type": "flip", "frame": "Nila's attitude is ___", "difficulty": 4,
    "beats": [
      { "id": "po_flip_b1", "text": "Nila keeps working after her first attempts fail.", "best_word": "persistent",
        "fit": { "persistent": 0.95, "obstinate": 0.25 }, "decisive_clue": "keeps working", "reason": "Ordinary difficulty, no refusal yet.",
        "shift_type": "initial", "difficulty": { "lexical_difficulty": 2, "semantic_distance": 3, "context_length": 2, "implicitness": 2, "ambiguity": 2, "cultural_specificity": 1, "processing_pressure": 2 },
        "misconception_by_wrong_choice": { "obstinate": "M1" } },
      { "id": "po_flip_b2", "text": "When judges show the method cannot work, she refuses to change anything.", "best_word": "obstinate",
        "fit": { "persistent": 0.3, "obstinate": 0.95 }, "decisive_clue": "refuses to change anything", "reason": "Refusing valid evidence is obstinacy.",
        "shift_type": "flip", "difficulty": { "lexical_difficulty": 2, "semantic_distance": 3, "context_length": 2, "implicitness": 2, "ambiguity": 2, "cultural_specificity": 1, "processing_pressure": 2 },
        "misconception_by_wrong_choice": {} }
    ],
    "feedback_short": "Refusing valid evidence, not the effort itself, made it obstinate.",
    "feedback_deep": "Continuing after failure is persistence. Ignoring proof that the method cannot work is obstinacy.",
    "contrast_rule": "Persistent toward the goal; obstinate against good reason.",
    "hints": { "attention": "How does Nila respond to the judges?", "axis": "Adapting versus refusing to reconsider.", "contrast": "One word allows changing the method; the other refuses." }
  }]
}
```

Optional fields: `chain_type`, `frame`, `qa`, `anchors`, per-beat `hints` (override the chain's), `edges[].misconceptions`.

## Editorial checklist (before `approved`)

Run `validate-content --verbose`, then for each chain check the design's §50 criteria:

- [ ] The pair is a real confusion, and every word is used in the intended sense.
- [ ] The situation sounds natural; beat 1 can be judged without hidden information.
- [ ] Every later beat adds evidence. A flip is caused by one specific semantic clue; a stay beat is distracting but not deceptive.
- [ ] The best answer is genuinely more precise; defensible alternatives have fit ≥ 0.4 so they earn partial credit.
- [ ] No outside facts needed; no obvious lexical overlap with the answer.
- [ ] Feedback names the decisive clue.
- [ ] No stereotype is reinforced (nationality, religion, gender, disability, class, occupation, family).
- [ ] The chain tests the set's actual edge.

The animation never reveals the answer; that is enforced in code, not content.
