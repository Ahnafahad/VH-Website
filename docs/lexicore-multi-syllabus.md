# LexiCore Multi-Syllabus — UI/UX Plan (notes, pre-implementation)

Written 2026-09-02, ahead of the UI/UX build phase. Backend (`vocab_syllabuses` +
`vocab_word_syllabuses` many-to-many, see `src/lib/db/schema.ts`) and content
(WordSmart/SAT/GRE word data) are being built first; this doc captures the
UI/UX decisions the user has already made so the later build session doesn't
have to re-derive them.

## Decided (user's own words, lightly cleaned up)

- Selecting one, two, or three syllabuses does **not** change how words are
  organized. Themes and study/practice pools contain all the words they
  normally would — no visual separation by syllabus within a theme or within
  a practice session. Syllabus selection is a **filter on which words are
  included**, not a reorganization of the canonical Unit → Theme taxonomy.
  (This matches the backend design: `unitId`/`themeId` on `vocab_words` is
  unrelated to syllabus membership — see the schema.ts comment above
  `vocabSyllabuses`.)
- Syllabus selection lives as a **checkbox-style control on the homepage** —
  the user picks which syllabus(es) they want words from.
- **Study and practice screens** get a small button that leads back to that
  syllabus selection control (so it's reachable without going all the way
  back to the homepage).

## Open question raised, deferred until after the current Codex pipeline work

The user asked whether there's a better approach for learners who want to
study **one syllabus at a time, sequentially** (e.g. finish SAT's word list
end-to-end before touching GRE) rather than the blended "select N syllabuses,
see the merged pool inside the normal taxonomy" model above. Not yet answered
— to be thought through and proposed in a later session/turn.
