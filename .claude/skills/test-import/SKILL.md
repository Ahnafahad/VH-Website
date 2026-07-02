---
name: test-import
description: Convert exam LaTeX (mock tests) into canonical test JSON and seed into Turso. Trigger - user provides a .tex mock test or asks to import/update an online test.
---

# Test Import Skill

Convert any IBA/BUP/FBS mock exam LaTeX source into the canonical JSON format, validate it with the seeder script, and (after the user provides an answer key) seed it into Turso.

## Canonical JSON Format

Full spec: `docs/tests-module.md`, section "Import JSON format (canonical)".

Compact example:
```json
{
  "slug": "iba-mock-5",
  "title": "IBA Mock Test 5",
  "bucket": "iba",
  "description": "Full-length IBA mock — 70 questions, 70 marks.",
  "sections": [
    {
      "order": 1,
      "title": "Language and Communication",
      "marksPerCorrect": 1,
      "penaltyPerWrong": 0.25,
      "thresholdPercent": null,
      "groups": [
        { "ref": "s1-instr-1", "kind": "instruction", "title": null, "content": "Each sentence has two blanks..." },
        { "ref": "s1-passage-1", "kind": "passage", "title": null, "content": "Passage text here..." },
        {
          "ref": "s3-ds-group",
          "kind": "shared_options",
          "title": "Questions 10 to 13",
          "content": "Each problem has two statements. Decide if data are sufficient.",
          "sharedOptions": [
            { "key": "A", "text": "Statement (1) ALONE is sufficient..." },
            { "key": "B", "text": "Statement (2) ALONE is sufficient..." },
            { "key": "C", "text": "BOTH statements TOGETHER are sufficient..." },
            { "key": "D", "text": "EACH statement ALONE is sufficient." },
            { "key": "E", "text": "Statements (1) and (2) TOGETHER are NOT sufficient." }
          ]
        }
      ],
      "questions": [
        {
          "number": 1,
          "group": "s1-instr-1",
          "stem": "The professor's ______ demeanor influenced the team.",
          "options": [
            { "key": "A", "text": "reticent" },
            { "key": "B", "text": "austere" },
            { "key": "C", "text": "petulant" },
            { "key": "D", "text": "affable" },
            { "key": "E", "text": "querulous" }
          ],
          "correctKey": null,
          "imageUrl": null,
          "explanation": null
        }
      ]
    }
  ]
}
```

Key rules:
- `slug`: kebab-case, unique per test (e.g. `iba-mock-4`)
- `bucket`: `"iba"` or `"du_fbs"`
- `group`: references a `ref` in the same section's `groups` array (nullable if standalone)
- `correctKey`: always `null` at import time; loaded later via admin API
- Math: `$...$` inline, `$$...$$` display (RichText format — no HTML)
- Content: markdown + dollar-math only — `**bold**`, `_italic_`, `$...$`
- `imageUrl`: `/tests/{slug}/filename.png` (file must be placed in `public/tests/{slug}/`)
- `totalQuestions` and `totalMarks` are NOT stored in JSON — seeder computes them

## LaTeX Conversion Rules

### Section headers
`\framebox{Section I: Language and Communication}` + `\framebox{30 Questions 30 Marks}`
→ `"title": "Language and Communication"` with that question count as a cross-check.

### Group types
| LaTeX pattern | JSON kind |
|---|---|
| `\textbf{Instruction:} ...` before a question block | `"instruction"` |
| Long passage text (`\textbf{Instruction:} Answer questions based on...` + passage) | `"passage"` |
| Logical scenario with bullet constraints (`\textbf{Questions N to M:} ...` + itemize) | `"scenario"` |
| Data-sufficiency A–E statements block (`\begin{enumerate}[label=(\Alph*)]` with DS answer options) | `"shared_options"` |

For `shared_options`: set `sharedOptions` to the A–E list AND duplicate the same A–E options on each question's own `options` array. This enables the validator to accept correctKey values from either list.

### Blank conversion
`\underline{\hspace{2cm}}` → `______` (six underscores, plain text)

### Underlined sentence-correction spans
`\ul{the underlined text}` or double `\underline{...}` → `**the underlined text**` (bold in markdown)

### Images
`\includegraphics[...]{Mock 4/q12.png}` → `"imageUrl": "/tests/iba-mock-4/q12.png"` + add a note to upload the file to `public/tests/{slug}/`. The stem text already says "in the pattern shown in the diagram above" — keep that wording.

### Math
Keep all LaTeX math inside `$...$` or `$$...$$`. Expand `\times` stays as `\times`, `\frac`, `\sqrt`, `\leq`, `\geq`, `\cdots` etc. are all valid inside RichText's math renderer. Do NOT convert math to Unicode — keep LaTeX.

### Mojibake table (Windows-1252 misread as Latin-1)
If the source `.tex` was encoded Windows-1252 or contains these byte sequences, convert:
| Raw bytes | Correct character |
|---|---|
| `â€"` | `—` (em dash U+2014) |
| `â€™` | `'` (right single quote U+2019) |
| `â€œ` | `"` (left double quote U+201C) |
| `â€` | `"` (right double quote U+201D) |
| `Â` | (remove — stray BOM-like prefix) |

In practice: LaTeX `---` (triple dash) renders as em-dash; convert to `—` in JSON.

### Straight quotes inside string values
Raw `"` characters inside JSON string values MUST be escaped as `\"` or replaced with typographic quotes (`"` U+201C, `"` U+201D). The management passage "change is" quote is a known example. Use typographic quotes (content is rendered as plain text, not parsed as code).

### Dollar signs (non-math)
Currency `\$6300` → `$6300` (literal, not inside math delimiters, since it is not a math expression). The renderer won't treat a lone `$6300` as math if there's no closing `$` — but to be safe, use `\$6300` in the JSON or just `$6300` plain since the renderer checks for paired delimiters.

### LaTeX commands to strip
These must NOT appear in JSON content outside math:
- `\item` → remove (it's list markup, not content)
- `\begin{...}` / `\end{...}` → remove
- `\framebox`, `\noindent`, `\textbf{}` (content kept, command stripped)
- `\ul{text}` → `**text**`
- `\underline{\hspace{...}}` → `______`
- `\includegraphics{...}` → set `imageUrl` instead

### Question numbering
IBA LaTeX exams use `\begin{enumerate}` with `\setcounter{enumi}{N}` to continue numbering across sub-blocks. Track the running counter manually.

Known quirk (iba-mock-4): Section III has a literal `13.` typed outside the enumerate — this is a numbering typo in the source; the true question number is determined by its position in the sequence (it was question 15). Always renumber by position and report the discrepancy.

## Invariants to Verify Before Outputting JSON

1. Section question counts match the `\framebox` header claim (e.g. "30 Questions 30 Marks").
2. Questions in each section are numbered sequentially from 1 without gaps or duplicates.
3. Every `group` value on a question exists as a `ref` in the same section's `groups` array.
4. Every group is referenced by at least one question.
5. Every question has at least 2 options (usually 5 for IBA).
6. `correctKey` is `null` on every question (keys loaded later).
7. `imageUrl` fields use `/tests/{slug}/...` paths.
8. No raw LaTeX commands remain in content outside `$...$` math.
9. No mojibake characters remain.

## Workflow

1. Read the `.tex` file. Note the slug (derive from test name: `iba-mock-4`, `bup-mock-2`, etc.).
2. Convert section by section following the rules above.
3. Write output to `tests-import/{slug}.json`.
4. Run: `node scripts/import-test.mjs tests-import/{slug}.json --dry-run`
   - Expected warnings: missing answer key (all correctKey null), missing image files.
   - Any other warning or error = fix before proceeding.
5. List any ambiguities found during conversion and ask the user to resolve them (see Ambiguity Policy below).
6. Ask user to provide the answer key (correct option letters per question number, per section).
7. Merge the answer key: set `correctKey` on each question.
8. Re-run dry-run to confirm keyed questions show in summary.
9. Seed (live): `node scripts/import-test.mjs tests-import/{slug}.json`
   - Requires `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env.local`.
   - DB tables must already exist (`npx drizzle-kit push` done separately).
10. Upload image files to `public/tests/{slug}/` (e.g. `q12.png`).
11. Publish the test via `/admin/tests` (test starts as `draft`).

## Ambiguity Policy

Never guess silently. Collect all ambiguities and report them to the user before or after producing the JSON draft. Examples of things to flag:
- A question whose stem references a figure but no `\includegraphics` is present
- A question block that seems to belong to a DS group but sits outside the enumerate
- A literal number typed outside the enumerate (as in iba-mock-4's sunfish question) — report the renumbering
- Conflicting question counts between the header and the actual question list
- Any text that looks like partial LaTeX that wasn't cleanly converted

Format: "Ambiguity N: [description]. Assumed [X]. Please confirm."

## Files Created / Modified

- `tests-import/{slug}.json` — the canonical import JSON
- `public/tests/{slug}/README.txt` — notes which images must be uploaded
- (After seeding) nothing else changes on disk; the DB is updated in Turso

## Seeder Notes

- Seeder (`scripts/import-test.mjs`) requires `@libsql/client` (already installed).
- `--dry-run`: validates only, no DB writes.
- `--force`: re-seeds over existing test even if attempts exist (use with caution).
- Test is always seeded as `status = 'draft'`. Publish via admin UI.
- `total_questions` and `total_marks` are computed from sections and stored in the `tests` row.
