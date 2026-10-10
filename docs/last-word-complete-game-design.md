# LAST WORD
## Complete Product, Learning, Content, Interaction & Motion Specification

**Document type:** Product + game design + learning system + AI content-generation specification  
**Status:** Design-ready  
**Scope:** Brand-neutral. The host app may inject its own typography, color, iconography, sound identity, and navigation shell.  
**Primary audience:** Students learning commonly confused words, near-synonyms, usage boundaries, connotation, and context-sensitive vocabulary.  
**Core promise:** *Do not memorize what a word means. Learn exactly when it becomes the right word.*

---

# 0. One-sentence product definition

**Last Word is a fast, cinematic semantic decision game where a situation evolves one beat at a time and the player must continuously decide which of several similar words best fits the situation *now*.**

The correct answer can change as new context appears. The player's job is not to recall definitions; it is to recognize the **boundary between meanings**.

Example:

- Choices: **PERSISTENT** / **OBSTINATE**
- Beat 1: “Maya kept trying after three failed attempts.” → **Persistent**
- Beat 2: “Experts showed her that the method itself could not work.” → **Obstinate**
- Beat 3: “She accepted their evidence, changed her method, and kept pursuing the goal.” → **Persistent**

That shifting judgment is the game.

---

# 1. The design thesis

Most vocabulary products track whether a student knows a word. Last Word tracks something more useful:

> **Does the student know where one word stops being the best choice and another similar word starts?**

This changes the unit of learning.

A conventional vocabulary system models words as independent cards:

```text
FRUGAL
THRIFTY
MISERLY
CHEAP
```

Last Word models them as a semantic graph:

```text
FRUGAL ───── THRIFTY
   │            │
   │            │
MISERLY ───── CHEAP
```

The **nodes** are words.  
The **edges** are distinctions.

Students should not repeatedly relearn a node they already know. They only need practice on edges that remain weak.

This is the foundation for content generation, adaptation, progress, review scheduling, and skipping known material.

---

# 2. Product goals

## 2.1 Learning goals

A successful player should be able to:

1. Recognize the meaning of each target word.
2. Distinguish it from nearby words.
3. Notice the contextual clue that changes which word is appropriate.
4. Explain the difference in simple language.
5. Transfer the distinction to unfamiliar contexts.
6. Make the distinction quickly without mentally reciting a definition.
7. Retain the distinction after time has passed.

## 2.2 Game goals

The experience should feel like a premium game, not a quiz with game decoration.

The player should experience:

- anticipation before context reveals;
- uncertainty when two words are both plausible;
- a satisfying “I see it” moment when one detail flips the answer;
- physical-feeling interaction through depth, inertia, light, haptics, sound, and motion;
- visible mastery rather than repetitive grinding;
- short sessions that are easy to start;
- enough variation that replaying a distinction does not feel like repeating the same question.

## 2.3 Anti-goals

Last Word must **not** become:

- a flashcard deck;
- a standard MCQ interface;
- “definition → choose the synonym”;
- a reading-heavy textbook inside a game;
- a streak machine that rewards attendance more than learning;
- an endless animation showcase that makes text difficult to read;
- a system that forces students through content they have already mastered.

---

# 3. Product principles

## Principle 1 — The context moves; the learner moves with it

Every strong round contains at least one meaningful semantic shift. New information should change, narrow, strengthen, or occasionally reverse the best answer.

## Principle 2 — The important object is the *distinction*, not the word

Knowing **frugal** does not automatically mean knowing the difference between **frugal** and **thrifty**.

Likewise, once the learner has demonstrated that they know what **frugal** means, the app should not re-teach that definition every time it appears in a new confusion set.

## Principle 3 — Never punish legitimate nuance

Language is not always binary. Content must distinguish:

- **best answer**;
- **defensible but less precise answer**;
- **incorrect answer**.

If two words are genuinely acceptable, the game must not pretend one is objectively wrong.

## Principle 4 — Explanation follows judgment

The player should attempt the distinction before receiving the explanation whenever possible.

## Principle 5 — Feedback must explain the clue, not merely reveal the answer

Bad feedback:

> Incorrect. The answer is “obstinate.”

Good feedback:

> **“Ignored clear evidence” is the turning point.** Persistence means continuing despite difficulty; obstinacy implies unreasonable refusal to change.

## Principle 6 — Mastery reduces repetition

Strong performance removes content from the near-term queue. Weak or uncertain performance brings it back in a different context.

## Principle 7 — Motion serves meaning

3D, particles, camera movement, glow, sound, and haptics should communicate state changes: uncertainty, shift, lock-in, correction, mastery. They should never compete with reading.

---

# 4. The learning model: Nodes, edges, and confusion sets

## 4.1 Word node

A **word node** stores knowledge about one word independent of any specific comparison.

Example:

```yaml
word: frugal
part_of_speech: adjective
core_meaning: careful about spending or using resources; avoids waste
connotation: usually neutral-to-positive
register: general
known_score: 0.91
last_verified: 2026-10-04
```

A student can have high node mastery for **frugal** even while having low edge mastery for **frugal ↔ thrifty**.

## 4.2 Distinction edge

An **edge** stores whether the student can discriminate between two nearby meanings.

Example:

```yaml
edge: frugal__miserly
boundary_rule: frugal avoids waste; miserly withholds spending beyond what is reasonable or humane
mastery_score: 0.84
transfer_score: 0.72
speed_score: 0.78
retention_score: 0.61
```

## 4.3 Confusion set

A **confusion set** contains two to five words that learners commonly mix up.

Examples:

```text
assure / ensure / insure
imply / infer
persistent / obstinate / stubborn
frugal / thrifty / economical / cheap / miserly
confident / assertive / arrogant / aggressive
empathy / sympathy / compassion
```

Each confusion set must be decomposed into its meaningful pairwise boundaries.

A five-word set does **not** require every theoretical pair to be taught. Only edges that represent a meaningful confusion should exist.

---

# 5. The answer to “if they already know a similar word, do they need to learn it again?”

## Short answer

**No. Do not reteach known words. But do verify new distinctions.**

## Exact rule

The system tracks three different things:

1. **Word recognition** — “Do you understand *frugal*?”
2. **Boundary mastery** — “Can you distinguish *frugal* from *miserly*?”
3. **Transfer mastery** — “Can you still make that distinction in a completely new context?”

Suppose a student already mastered:

```text
FRUGAL ↔ MISERLY ✅
```

Later the curriculum introduces:

```text
FRUGAL ↔ THRIFTY
```

The app should **not** show another “What does frugal mean?” lesson.

Instead it should cold-open with a short diagnostic:

> She enjoys finding clever ways to reuse things and make limited resources go further.

**FRUGAL** / **THRIFTY**

If the student consistently distinguishes the pair, the edge is immediately marked as known and the system moves on.

### Skip policy

A word may be skipped as teaching content if node mastery is high.

A distinction may be skipped only if the relevant **edge mastery** is high and has sufficient evidence.

This prevents two opposite problems:

- wasting time by teaching known material;
- falsely assuming that knowing two definitions means the learner understands their difference.

---

# 6. Core game loop

A standard Last Word round lasts approximately **12–30 seconds**.

## 6.1 Round anatomy

Each round contains:

1. **Word field appears**
2. **Initial context arrives**
3. **Player chooses the best word**
4. **New context beat arrives**
5. **Player keeps or changes the choice**
6. Repeat for 2–5 beats
7. **Last Word moment** — final judgment locks
8. **Meaningful feedback**
9. **Micro-transition into next round**

## 6.2 Example full round

### Word field

```text
PERSISTENT          OBSTINATE
```

### Beat 1

> Nila continued working after her first several attempts failed.

Player selects **PERSISTENT**.

### Beat 2

> Several specialists then showed that the method violated a basic requirement.

The visual balance destabilizes. Player switches to **OBSTINATE**.

### Beat 3

> She accepted the criticism, redesigned the method, and continued toward the same goal.

Player switches back to **PERSISTENT**.

### Lock

The environment compresses inward. Both word objects snap into focus. The selected word comes forward.

> **LAST WORD: PERSISTENT**

### Explanation

> **The goal stayed; the method changed.** Persistence is continued effort despite difficulty. Obstinacy would mean refusing to change despite good reason.

This should feel like resolving a tiny mystery, not checking an answer key.

---

# 7. Selection interaction

The interaction should make semantic choice feel physical.

## 7.1 Mobile default

Two-word round:

- drag/tilt the central context object toward either word;
- or tap a word to magnetize the context card toward it;
- swipe across the field to change selection quickly.

Three-to-five-word round:

- words orbit or sit around a shallow 3D arc;
- horizontal swipe rotates the active word into the focus slot;
- tap locks temporarily;
- new beats can unlock the field again.

## 7.2 Desktop default

- Arrow keys or A/D change selection.
- Number keys select words when there are 3+ options.
- Space/Enter locks.
- Pointer/touchpad interactions remain fully supported.

## 7.3 Selection should remain reversible

Until a beat closes, the player may change their mind.

This is essential. The game is about updating judgment as evidence changes.

## 7.4 Beat checkpoints

Every beat records:

```text
selected word
correctness class
reaction time
whether the player switched
switch direction
confidence (in special diagnostic rounds)
hint usage
```

The product therefore learns much more than final-answer accuracy.

---

# 8. Scoring model

Score should reward **semantic judgment**, not frantic tapping.

## 8.1 Per-beat scoring

Suggested base values:

```text
Best answer                     +100
Defensible / near-best           +55
Incorrect                          0
Correct semantic switch          +35 bonus
Correctly refusing false shift   +25 bonus
Fast but accurate                +0 to +30
Hint used                        score multiplier ×0.75
```

## 8.2 Nuance streak

A nuance streak grows when the learner makes consecutive **high-quality distinctions**.

```text
2 correct decisions   → x1.1
4                     → x1.25
7                     → x1.5
10+                   → x1.75 cap
```

Do not create extreme score multipliers that encourage guessing quickly instead of thinking.

## 8.3 “Hold Your Ground” bonus

Not every new sentence should flip the answer.

Some beats are deliberate bait.

If the player correctly keeps the original selection despite a misleading new detail, award a **Hold Your Ground** bonus.

This prevents players from learning the meta-rule “new text means switch.”

## 8.4 “Perfect Read”

Awarded when a player gets every beat in a shifting chain correct.

The animation should visually replay the path of the correct word as a clean continuous trajectory.

---

# 9. Correctness must not be binary

Every generated beat must carry one of these answer structures.

```yaml
best: persistent
acceptable:
  - word: determined
    strength: 0.55
incorrect:
  - obstinate
```

Recommended semantic-fit scale:

| Fit | Meaning | Game treatment |
|---|---|---|
| 1.00 | Best/most precise | Full credit |
| 0.70–0.99 | Strongly defensible | Partial credit; explain nuance |
| 0.40–0.69 | Possible but noticeably weaker | Low partial credit |
| <0.40 | Misleading / incorrect | No credit |

The authoring model must be told **never to manufacture a distinction where competent speakers would reasonably disagree without contextual resolution**.

---

# 10. Content package required from a list of commonly confused words

If your starting input is only:

```text
assure / ensure / insure
imply / infer
frugal / thrifty / miserly
```

that list is **not enough to play the game**.

For every confusion set, the content pipeline must generate the following.

## 10.1 Set metadata

```yaml
set_id:
title:
words:
part_of_speech:
age_band:
language_level:
register:
topic_sensitivity:
```

## 10.2 Word profiles

For every word:

- concise meaning;
- expanded meaning;
- connotation;
- grammatical behavior;
- typical collocations;
- register;
- common learner misconception;
- strong positive examples;
- strong negative/counterexamples;
- “do not confuse with” notes.

## 10.3 Semantic axes

A semantic axis describes *what actually separates the words*.

For example:

```yaml
set: [persistent, obstinate]
axes:
  - adaptability_to_evidence
  - reasonableness_of_continuation
  - speaker_evaluation
```

For:

```text
frugal / thrifty / miserly
```

possible axes are:

```text
resourcefulness
avoidance_of_waste
reluctance_to_spend
harm_caused_by_under-spending
positive_vs_negative_connotation
```

These axes are critical because they are what the context beats should manipulate.

## 10.4 Pairwise boundary rules

For every relevant edge:

```yaml
edge: persistent__obstinate
rule: >
  Persistent describes continuing toward a goal despite difficulty;
  obstinate adds unreasonable refusal to change despite strong reasons or evidence.
turning_clues:
  - refuses clear evidence
  - will not reconsider
  - changes method after feedback
```

## 10.5 Anchor examples

Generate at least:

- 6 unmistakable examples for each word;
- 6 counterexamples for each word;
- 4 borderline examples for each important edge.

Anchor examples teach the semantic territory before difficult nuance is introduced.

## 10.6 Context-shift chains

This is the heart of Last Word.

Generate **20–40 playable chains per important edge** initially.

Each chain should contain:

```yaml
scenario_id:
setting:
characters:
beats:
  - text:
    best_word:
    fit_scores:
    decisive_clue:
    reason:
    shift_type:
```

Required shift types:

1. **Stay** — new context does not change the answer.
2. **Flip** — best answer changes.
3. **Narrow** — several answers were possible; one becomes clearly best.
4. **Rehabilitate** — initially negative interpretation becomes neutral/positive.
5. **Corrupt** — initially neutral/positive action becomes negative with new motive/evidence.
6. **Reframe** — same behavior is interpreted differently after purpose or relationship is revealed.

## 10.7 Explanation payloads

Every beat must contain:

- decisive clue;
- one-sentence explanation;
- optional deeper explanation;
- contrast sentence;
- misconception tag.

Example:

```yaml
decisive_clue: "refused to reconsider after clear evidence"
feedback_short: "That refusal to adapt moves the meaning from persistent toward obstinate."
contrast: "Persistence survives difficulty; obstinacy resists good reason."
```

## 10.8 Transfer items

Generate contexts from different domains than the teaching examples.

If teaching examples used school and work, transfer items should use:

- relationships;
- sports;
- travel;
- household decisions;
- public situations;
- abstract arguments;
- short dialogue.

A distinction is not mastered if the learner only recognizes the original story pattern.

## 10.9 Error diagnostic tags

Each wrong choice should map to a likely misconception.

Example:

```yaml
misconceptions:
  M1: "believes all continued effort = persistent"
  M2: "interprets obstinate as simply strong-minded"
  M3: "does not use response-to-evidence as a clue"
```

This lets remediation target the actual misunderstanding.

## 10.10 Difficulty metadata

Every beat should be rated across separate dimensions:

```yaml
lexical_difficulty: 1-5
semantic_distance: 1-5
context_length: 1-5
implicitness: 1-5
ambiguity: 1-5
cultural_specificity: 1-5
processing_pressure: 1-5
```

Do not collapse all difficulty into one arbitrary level.

---

# 11. Content difficulty ladder

## Level 0 — Recognition

Words are far apart semantically.

Purpose: detect whether teaching is needed at all.

## Level 1 — Anchor distinction

The decisive clue is explicit.

> He continued practicing even though it was difficult.

## Level 2 — Natural context

The decisive clue is present but not highlighted.

## Level 3 — Close semantic competition

Both words initially seem plausible.

## Level 4 — Context shift

A new beat changes the best answer.

## Level 5 — False shift

New information looks important but should **not** change the choice.

## Level 6 — Implicit motive

The clue depends on implication, tone, purpose, or relationship.

## Level 7 — Transfer

Unfamiliar domain and phrasing.

## Level 8 — Precision

Several words are defensible; the player identifies the *best* one.

A learner should not grind through levels sequentially if their diagnostic performance shows they can start higher.

---

# 12. Student progression system

Progress exists at four layers.

## 12.1 Word mastery

“How well does the student understand this word at all?”

Suggested states:

```text
Unknown
Recognized
Known
Stable
```

## 12.2 Edge mastery

“How reliably can the student distinguish A from B?”

Suggested states:

```text
Unseen
Exploring
Distinguishing
Reliable
Fluent
Mastered
```

## 12.3 Transfer mastery

“Does the distinction survive unfamiliar wording and domains?”

## 12.4 Retention mastery

“Does the distinction survive time?”

The user-facing interface should compress these into a beautiful simple visualization, while the backend keeps the detailed model.

---

# 13. Mastery estimation

Do not mark a distinction mastered after one lucky answer.

A practical first version can use an evidence-weighted score rather than a complicated psychometric model.

## 13.1 Evidence values

Example weighting:

```text
Easy anchor correct                  +0.5
Normal context correct               +1.0
Correct shift                        +1.4
Correct false-shift / hold           +1.5
Hard transfer correct                +1.8
Correct after long review interval   +2.0
Hinted correct                       +0.35
Near-answer                          +0.2
Wrong                               -1.0
Confident wrong                     -1.5
Repeated same misconception         -1.2
```

## 13.2 Mastery confidence

A distinction becomes **Fluent** only if evidence includes:

- at least one standard context;
- at least one context shift;
- at least one transfer context;
- performance across at least two sessions or a later review window.

## 13.3 Speed is secondary

Speed should only increase mastery confidence **after accuracy is reliable**.

A fast wrong answer means strong misconception, not skill.

---

# 14. Diagnostic / “prove you know it” flow

This solves the repetition problem.

When a confusion set is introduced, do **not** automatically teach it.

## Stage 1 — Cold read

Give 2–3 unassisted rounds.

## Stage 2 — Adaptive probe

If all are correct, present a harder shift/transfer item.

## Stage 3 — Decision

Possible outcomes:

### A. Demonstrated mastery

> “You already own this distinction.”

Skip instruction. Award mastery credit. Put it into later retention review only.

### B. Partial mastery

Skip basic definitions. Teach only the missing edge or misconception.

### C. Weak mastery

Start the guided learning sequence.

### D. Confident misconception

Show contrastive feedback immediately, then give a new example testing the exact misconception.

This makes Last Word feel intelligent rather than repetitive.

---

# 15. Review scheduling

The system should use **adaptive spaced retrieval**, not fixed repetition counts.

A simple launch schedule might begin with:

```text
same session → if weak
next day → if newly learned
3–4 days → if correct
7–10 days → if correct again
21–30 days → if stable
60+ days → if still stable
```

Intervals should shrink after failure and expand after successful delayed retrieval.

Important: the app should not replay the exact same sentence unless deliberately testing memory for that sentence. Reviews should normally use **new contexts testing the same distinction**.

---

# 16. Remediation logic

A wrong answer should trigger **the smallest useful intervention**.

## First miss

Show a short clue-level correction.

> “Notice: she changed her method when shown evidence.”

Then continue.

## Repeated miss on same boundary

Show a 2-card contrast:

```text
PERSISTENT
Keeps pursuing the goal while still adapting.

OBSTINATE
Refuses to change despite good reason.
```

Then test a fresh context.

## Persistent misconception

Temporarily widen semantic distance with a very clear example, then gradually narrow it again.

## Never do this

Do not dump a dictionary page after one mistake.

---

# 17. The signature visual experience

The visual concept should feel **exotic, tactile, dimensional, and alive**, while remaining brand-neutral.

## 17.1 World metaphor: The Semantic Chamber

The game does not take place on a flat quiz screen.

It takes place inside a shallow 3D **semantic chamber**.

Layers:

```text
Layer 0 — atmospheric depth / particles / soft environmental motion
Layer 1 — distant semantic traces and previously rejected words
Layer 2 — active word objects
Layer 3 — context card / narrative object
Layer 4 — interaction effects / selection field
Layer 5 — HUD / accessibility / progress
```

The camera should move by only a few degrees or a few virtual centimeters during ordinary play. The experience should feel dimensional without forcing the eyes to chase text.

## 17.2 Word objects

Words are not ordinary buttons.

Each word lives on a **3D semantic card / monolith / floating tile** with:

- depth;
- soft edge light;
- physical tilt;
- slight inertial response;
- subtle surface refraction or material shimmer;
- shadow/parallax against the scene;
- reactive halo when selected.

The actual typography remains crisp and front-facing.

## 17.3 Context object

The evolving sentence appears on a central floating panel.

New beats should feel as though the sentence is being **revealed into the scene**, not loaded as a new page.

Possible effect:

- existing sentence shifts upward slightly;
- incoming clause emerges from depth;
- camera/focus breathes inward;
- semantic field reacts;
- one or more word objects subtly pull toward the context.

The visual system must **never reveal the correct answer** through animation before the player decides.

## 17.4 Semantic tension

When two words are close contenders:

- both objects may receive a restrained gravitational pull;
- the context card can hover between them;
- ambient particles can form a faint bridge;
- no color coding should imply correctness.

After the player locks, the chosen card draws the context toward itself.

## 17.5 A semantic flip

When a new context beat changes the correct word, do **not** flash “answer changed.”

Instead:

- a low-frequency ripple passes through the scene;
- the central card rotates or shifts a few degrees;
- the old selection loosens magnetically;
- the choice field becomes live again;
- a tiny haptic tick signals “new evidence.”

The learner discovers whether the answer changed.

---

# 18. Motion language

Motion should have a consistent grammar.

## 18.1 Motion meanings

| Motion | Meaning |
|---|---|
| Soft float | Available / unresolved |
| Magnetic pull | Selected |
| Tight snap | Locked decision |
| Lateral slip | Switching judgment |
| Depth emergence | New evidence |
| Pulse through connection | Semantic relationship |
| Card fracture/dissolve | Rejected interpretation |
| Stable glow / settle | Mastery |
| Recoil | Incorrect confidence |
| Gentle re-centering | Correction / learning |

## 18.2 Suggested timing tokens

```text
micro_response      80–140 ms
selection_snap     160–240 ms
card_transition    240–420 ms
context_reveal     350–650 ms
semantic_flip      450–750 ms
mastery_moment     700–1300 ms
scene_transition   500–900 ms
```

Avoid long unskippable celebrations after every correct answer.

## 18.3 Easing philosophy

Use spring/inertial movement for physical objects and smoother ease curves for text/content transitions.

Typography itself should not bounce aggressively.

## 18.4 Reduced-motion mode

Every essential state must remain understandable with motion minimized.

Reduced-motion behavior:

- replace camera moves with fades;
- remove particles/parallax;
- replace 3D flips with opacity/scale changes;
- preserve the semantic state indicators;
- never require motion perception to understand the game.

---

# 19. Graphics and effects

Possible premium effects, used sparingly:

- volumetric-feeling light cones created with lightweight gradients;
- shallow depth-of-field illusion;
- iridescent edge reflections;
- glass/refraction-inspired surfaces;
- animated noise texture;
- particles that follow semantic connections;
- subtle word trails when switching;
- depth fog;
- “semantic crack” effect when a misconception breaks;
- flowing line network for mastered relationships;
- soft bloom/glow around active objects.

## Performance rule

The visual ambition should come from **composition and motion**, not from rendering dozens of expensive 3D systems simultaneously.

For web/mobile implementation:

- prefer transform-based motion over layout animation;
- keep concurrent animated objects limited;
- use sprites/textures for effects that do not need real geometry;
- degrade effects by device capability;
- disable heavy post-processing on lower tiers;
- profile on real devices.

---

# 20. Sound and haptics

Sound should make Last Word tactile even when visuals are subtle.

## 20.1 Sound categories

- context arrival — soft dimensional tick/whoosh;
- selection — low magnetic click;
- switch — fast sliding tone;
- lock — short resolved impact;
- correct — tonal resolution;
- near-answer — unresolved partial cadence;
- incorrect — dampened displacement, never humiliating buzzer;
- mastery — wider harmonic bloom;
- new review due — understated notification cue.

## 20.2 Haptics

- light tap on selection;
- different tiny texture on switch;
- medium lock pulse;
- success confirmation;
- optional corrective pulse.

Haptics must be independently disable-able.

---

# 21. The tutorial

The tutorial should teach the game's idea in **under two minutes** and use interaction instead of explanation.

## Tutorial scene 1 — Choose

Words:

```text
CONFIDENT     ARROGANT
```

Context:

> “Ari believes she can handle the presentation.”

The interface invites the player to move the context toward **CONFIDENT**.

## Tutorial scene 2 — Context can change

New beat:

> “She also says nobody else on the team is capable of doing it properly.”

The field reopens.

The player switches to **ARROGANT**.

Text appears only after the interaction:

> **One detail can change the word.**

## Tutorial scene 3 — Context can also *not* change

A new example adds irrelevant information. Player should hold the answer.

Message:

> **New information doesn't always mean a new answer.**

## Tutorial scene 4 — Last Word

A final short chain plays normally.

After completion:

> **Read the situation. Follow the meaning. Have the Last Word.**

Then gameplay begins immediately.

---

# 22. Primary screen architecture

## 22.1 Home / Launch

Primary actions:

- **Continue** — resumes recommended learning path.
- **Quick Run** — 3–5 minute mixed practice.
- **Mastery Map** — inspect learned distinctions.
- **Review** — due items.

Home should emphasize one obvious action, not dashboards full of numbers.

## 22.2 Set introduction

Show the confusion set as spatially related word objects.

Example:

```text
        THRIFTY

FRUGAL          MISERLY

        CHEAP
```

Do not immediately display definitions.

CTA:

> **Prove what you know**

## 22.3 Diagnostic

Minimal HUD. No teaching until evidence is collected.

## 22.4 Live round

Required visible components:

- words;
- context;
- beat progress;
- optional pause;
- subtle session progress.

Do not show XP bars, currency, multiple counters, and achievements while the learner is reading.

## 22.5 Feedback moment

Feedback has three layers:

1. immediate correctness/fit;
2. decisive clue;
3. optional “Why?” expansion.

## 22.6 Session recap

Show learning, not just points.

Example:

```text
TODAY YOU SHARPENED

Persistent ↔ Obstinate     Fluent ↑
Assure ↔ Ensure            Stable
Frugal ↔ Miserly           Needs one more review

2 distinctions skipped because you already knew them.
1 misconception corrected.
Next review: tomorrow.
```

## 22.7 Mastery map

A 2D/3D semantic network of word nodes and distinction edges.

- bright/stable edge = mastered;
- developing edge = still learning;
- dormant edge = due for retention check;
- hidden/locked regions = unseen curriculum.

Selecting a node shows which neighboring distinctions are mastered without forcing the user through duplicate word lessons.

---

# 23. Session design

## Recommended default session

Duration: **4–7 minutes**.

Approximate composition:

```text
1 warm-up known distinction
2 current learning rounds
1 hard semantic shift
1 transfer round
1 due review
1 optional challenge round
```

The session should end at a natural learning boundary, not at an arbitrary energy limit.

## Micro-session

60–120 seconds, useful for quick review.

## Deep run

10–15 minutes, optional. Higher density of difficult context shifts and mixed confusion sets.

---

# 24. Game modes

The launch version only requires one main mode plus review, but the system can support more without changing the core content model.

## Mode A — Last Word Journey

Adaptive learning path. Default mode.

## Mode B — Shift Run

Fast sequence of context-shift rounds. Score-focused but still learning-valid.

## Mode C — No-Hint Run

Mastered distinctions only. Tests fluency.

## Mode D — Transfer Run

Only novel domains and wording. Tests true understanding.

## Mode E — Daily Chain

Every player receives the same curated set of semantic chains for the day. Good for social comparison without exposing private learning weaknesses.

Avoid launching all modes at once. Journey + Review + one optional challenge mode are enough initially.

---

# 25. Progress that students can understand

Do not expose obscure percentages like “edge mastery = 0.837.”

Use plain-language status:

```text
NEW
GETTING IT
RELIABLE
FLUENT
MASTERED
REVIEW DUE
```

When a distinction improves, explain why:

> **Frugal ↔ Miserly became Reliable**  
> You handled both a context flip and a new transfer example.

This teaches students what mastery actually means.

---

# 26. Content generation architecture

Use a **multi-stage generation pipeline**, not one giant “make 50 questions” prompt.

Recommended pipeline:

```text
INPUT WORD LIST
   ↓
1. Lexical Research / Sense Normalization
   ↓
2. Semantic Boundary Mapper
   ↓
3. Scenario & Chain Generator
   ↓
4. Explanation Generator
   ↓
5. Ambiguity / Naturalness Critic
   ↓
6. Difficulty Calibrator
   ↓
7. Duplicate / Pattern Detector
   ↓
8. Human spot-check or high-confidence publish gate
   ↓
PLAYABLE CONTENT BANK
```

Why separate stages?

Because an LLM can easily create polished-looking but linguistically dubious questions. A separate critic should actively try to prove each item ambiguous or unfair.

---

# 27. Master content-generation prompt

Below is the prompt to give an AI content agent when you have a list of commonly confused words.

Copy the entire block and replace the variables.

```text
SYSTEM / ROLE

You are the semantic content architect for a vocabulary game called Last Word.
Your job is NOT to generate ordinary vocabulary quizzes.
Your job is to model the exact semantic boundaries between commonly confused words and create evolving context chains in which the best word can remain stable, become more precise, or change as new evidence appears.

CORE GAME

The player sees 2–5 semantically related words and a situation revealed in 2–5 beats.
After each beat, the player chooses the word that BEST describes the situation at that moment.
New context may:
- keep the answer the same,
- flip the answer,
- narrow several plausible words to one,
- reframe motive or tone,
- make a previously reasonable behavior unreasonable,
- or appear important while correctly leaving the answer unchanged.

The learning target is the BOUNDARY between meanings, not memorization of definitions.

INPUT

Confusion set: {{WORD_SET}}
Learner age band: {{AGE_BAND}}
Approximate English level: {{LANGUAGE_LEVEL}}
Target locale/cultural context: {{LOCALE}}
Number of chains requested: {{CHAIN_COUNT}}

TASK A — NORMALIZE MEANINGS

For every word:
1. Identify the intended sense relevant to this confusion set.
2. Give a concise meaning.
3. Give connotation (positive / neutral / negative / context-dependent).
4. Give register and grammatical constraints.
5. List common collocations.
6. List the most common misconception learners have about it.
7. Do not merge distinct dictionary senses that would make the comparison incoherent.

TASK B — MAP SEMANTIC BOUNDARIES

Identify the dimensions that actually distinguish these words.
Examples of dimensions include motive, degree, reasonableness, agency, intentionality, formality, emotional stance, relationship to evidence, resource use, or speaker evaluation.

Create only meaningful pairwise edges. Do not fabricate a distinction between words that are not commonly confusable in the intended senses.

For every edge provide:
- one-line boundary rule;
- decisive clues favoring A;
- decisive clues favoring B;
- clues that are irrelevant and should NOT cause a switch;
- examples where both are possible but one is more precise;
- common misconception tags.

TASK C — GENERATE ANCHORS

For every word generate:
- 6 clear positive examples;
- 6 clear counterexamples;
- 4 borderline examples.

Use varied domains. Do not repeatedly use the same syntactic template.

TASK D — GENERATE LAST WORD CHAINS

Generate {{CHAIN_COUNT}} playable chains.

Each chain must:
- contain 2–5 beats;
- read like one coherent evolving situation;
- contain at least one semantically meaningful decision;
- use natural language appropriate to the learner level;
- avoid trivia or specialist knowledge;
- avoid relying on stereotypes;
- avoid ambiguous pronoun references;
- avoid clues that require guessing an unstated motive unless the beat explicitly supports the inference;
- vary character names, settings, sentence shapes, domains, and narrative structures;
- not reveal the target word inside the context;
- not use dictionary-definition phrasing as the scenario;
- avoid making the correct answer obvious through repeated keyword patterns.

Across the full batch target approximately:
- 30% stay chains,
- 30% flip chains,
- 15% narrow chains,
- 10% false-shift chains,
- 10% reframe/corrupt/rehabilitate chains,
- 5% precision/borderline chains.

For EACH beat provide:
- text;
- best_word;
- a 0.00–1.00 fit score for every candidate word;
- decisive_clue;
- one-sentence reason;
- shift_type;
- difficulty dimensions;
- misconception triggered by each likely wrong answer.

IMPORTANT FAIRNESS RULE

If two candidate words would be equally natural to a competent speaker, either:
1. mark both as acceptable with similar fit scores, OR
2. revise the context until one is meaningfully more precise.
Never create artificial certainty.

TASK E — EXPLANATIONS

For every chain provide:
- short feedback (max 22 words);
- deeper explanation (max 80 words);
- a memorable contrast rule;
- optional hint that points to the relevant clue without giving the answer.

TASK F — TRANSFER

For each important edge generate at least 4 transfer items from domains not used in the teaching anchors.

TASK G — QUALITY SELF-CHECK

Before returning an item, challenge it:
- Could another answer be equally correct?
- Does the answer depend on cultural assumptions?
- Is the supposed distinction actually supported by standard usage?
- Is a keyword leaking the answer?
- Does the context change for a semantic reason, or just because the author wanted a flip?
- Is the explanation describing the decisive clue?
- Does a student need outside factual knowledge?
- Is the wording age-appropriate?

If any answer is yes in a harmful way, rewrite the item.

OUTPUT

Return strict structured JSON matching the supplied Last Word content schema. Do not add prose outside the JSON.
```

---

# 28. Recommended JSON content schema

```json
{
  "set_id": "persistent-obstinate",
  "words": [
    {
      "word": "persistent",
      "sense": "continuing firmly despite difficulty",
      "connotation": "usually positive or neutral",
      "register": "general",
      "misconceptions": ["all refusal to stop is persistence"]
    }
  ],
  "semantic_axes": [
    {
      "id": "adaptability_to_evidence",
      "description": "whether the person updates method or belief when given strong reasons"
    }
  ],
  "edges": [
    {
      "a": "persistent",
      "b": "obstinate",
      "boundary_rule": "Persistence continues despite difficulty; obstinacy refuses reasonable change despite good reason.",
      "clues_a": ["adapts method", "goal remains worthwhile"],
      "clues_b": ["ignores evidence", "refuses reasonable compromise"],
      "irrelevant_clues": ["task is difficult"]
    }
  ],
  "chains": [
    {
      "id": "po_001",
      "domain": "school_project",
      "difficulty": 3,
      "beats": [
        {
          "text": "Leena's prototype failed twice, but she kept working on it.",
          "best_word": "persistent",
          "fit": {
            "persistent": 0.94,
            "obstinate": 0.32
          },
          "decisive_clue": "continued after ordinary difficulty",
          "reason": "Nothing yet suggests that continuing is unreasonable.",
          "shift_type": "initial",
          "misconception_by_wrong_choice": {
            "obstinate": "treats any refusal to quit as obstinacy"
          }
        },
        {
          "text": "Her teacher then showed that the design violated a requirement, but Leena refused even to consider changing it.",
          "best_word": "obstinate",
          "fit": {
            "persistent": 0.39,
            "obstinate": 0.96
          },
          "decisive_clue": "refused to consider change despite a valid requirement",
          "reason": "The refusal to respond to good evidence makes obstinate more precise.",
          "shift_type": "flip"
        }
      ],
      "feedback_short": "Difficulty didn't cause the flip; refusing valid evidence did.",
      "contrast_rule": "Persistent toward the goal; obstinate against good reason."
    }
  ]
}
```

---

# 29. Content critic prompt

Do not trust the generator alone. Run generated content through a separate critic.

```text
You are the adversarial linguistic QA reviewer for Last Word.

You receive a proposed semantic distinction and game scenario.
Your job is to find reasons the item should NOT be published.

For every beat, independently judge:
1. Which candidate word is most natural?
2. Which other words are defensible?
3. Whether the supplied fit scores are reasonable.
4. Whether the decisive clue genuinely supports the claimed distinction.
5. Whether the answer relies on stereotypes, unsupported motive inference, specialist knowledge, or awkward wording.
6. Whether the scenario accidentally teaches a false rule.
7. Whether the difficulty tag is appropriate.
8. Whether the context creates a real semantic shift rather than an arbitrary plot twist.
9. Whether the feedback accurately explains the difference.

Return:
- PASS
- REVISE
- REJECT

If REVISE, provide a minimally changed version that resolves the problem.
If competent speakers could reasonably disagree, do not force a binary answer. Mark multiple acceptable answers or demand more context.
```

---

# 30. Difficulty-calibration prompt

```text
You are calibrating Last Word items for adaptive learning.

Rate each beat from 1–5 independently on:
- vocabulary difficulty;
- semantic closeness of options;
- amount of inference required;
- context complexity;
- ambiguity;
- processing speed demand;
- cultural specificity.

Then estimate the prerequisite knowledge needed.

Do not call an item difficult merely because the sentence is long.
The most valuable form of difficulty is semantic closeness with fair contextual evidence.
```

---

# 31. Prompt for an AI coding/design agent to build Last Word

Use the following prompt *together with this markdown file*.

```text
You are building the Last Word learning game from the attached product specification.
Treat the specification as the source of truth for learning behavior, interaction rules, progression, and content architecture.

OBJECTIVE

Build a premium, tactile, highly polished interactive experience that feels like a modern game rather than a quiz product.
It must remain brand-neutral: use design tokens and placeholders for host-app typography, color, iconography, and sound identity rather than inventing a permanent brand.

NON-NEGOTIABLE PRODUCT RULES

1. The core unit is a semantic DISTINCTION (edge), not merely a word.
2. Do not reteach word definitions when node mastery shows the learner already knows the word.
3. New context arrives in beats and may keep, narrow, or change the best answer.
4. Player selection must remain reversible while a beat is active.
5. Content must support best / defensible / incorrect answers rather than fake binary certainty.
6. Feedback must point to the decisive contextual clue.
7. The adaptive system must diagnose, skip known material, remediate misconceptions, and schedule later transfer/retention checks.
8. 3D and motion must communicate semantic state without compromising text readability.
9. Implement a reduced-motion mode and a low-performance visual tier.
10. Do not add generic gamification clutter that is not justified by the spec.

DESIGN DIRECTION

Create a shallow 3D “semantic chamber” with floating word objects and a central evolving context object.
Use depth, spring motion, magnetic selection, restrained glow, particles, parallax, and tactile feedback.
Text must remain crisp and stable.
The scene should look unusually polished even with no final brand skin applied.

Build the experience from reusable systems rather than one-off screens:
- WordObject
- ContextCard
- SemanticField
- BeatController
- ChoiceController
- FeedbackLayer
- MotionSystem
- HapticSoundHooks
- MasteryState
- DiagnosticEngine
- ReviewScheduler
- ContentLoader
- ReducedMotionAdapter
- PerformanceTierAdapter

CONTENT

Use data-driven content matching the JSON contract in the specification.
Create fixture content for at least:
- persistent / obstinate
- confident / arrogant
- assure / ensure
- frugal / thrifty / miserly

STATES TO IMPLEMENT

1. Home / Continue
2. Confusion-set intro
3. Cold diagnostic
4. Live Last Word round
5. Semantic flip
6. False-shift / hold-your-ground round
7. Feedback / explanation
8. Session recap
9. Mastery map
10. Review queue

MOTION QUALITY

Do not simply animate every component.
Define a coherent motion language:
- float = unresolved
- magnetic pull = selected
- snap = lock
- slip = switch
- depth emergence = new evidence
- settle = mastery
- recoil/recenter = correction

Prefer transform-based animation.
Avoid layout thrashing.
Keep expensive effects modular and capability-gated.

ACCESSIBILITY

- keyboard and pointer support;
- screen-reader labels for all choices;
- sufficient contrast after host theme injection;
- reduced-motion mode;
- no flashing effects;
- audio/haptics independently optional;
- no essential information communicated by color or motion alone.

DEVELOPMENT PROCESS

Before coding:
1. Convert the spec into a component/state architecture.
2. Identify reusable primitives.
3. Define data interfaces.
4. Produce one vertical slice: tutorial → diagnostic → three-beat shifting round → feedback → mastery update.
5. Validate the learning logic before expanding visual effects.

Then build the complete MVP while preserving the architecture.

QUALITY BAR

The final result should be something a user would describe as a game they want to touch and explore, not an educational form with decorations.
At the same time, remove any visual effect that makes the learner slower because the sentence itself became difficult to read.
```

---

# 32. Adaptive session algorithm

Pseudo-logic:

```text
START SESSION

1. Fetch due retention edges.
2. Fetch current curriculum target edges.
3. Identify edges connected to already-mastered word nodes.
4. For unseen edges:
   run cold diagnostic.

FOR EACH EDGE:

if high-confidence mastery demonstrated:
    mark edge as provisionally mastered
    schedule delayed transfer check
    skip instruction

else if node meanings known but edge weak:
    skip definitions
    teach contrast only

else if node meaning weak:
    include anchor examples
    then contrast practice

choose next item based on:
    misconception priority
    recency
    content diversity
    difficulty fit
    transfer need
    review due date

avoid:
    same domain repeatedly
    same sentence template repeatedly
    same correct-word position pattern
    predictable flip frequency

END SESSION when:
    planned learning objective reached
    AND no urgent remediation chain is incomplete
```

---

# 33. Item selection rules

The scheduler should explicitly prevent pattern learning.

Do not allow:

- more than 3 flips in a row;
- the same word to be correct in the same UI position repeatedly;
- repeated character/domain patterns;
- repeated clue phrases;
- a sequence where every new beat changes the answer;
- an obvious alternation like A-B-A-B.

The learner should read meaning, not game patterns.

---

# 34. Hint system

Hints should preserve retrieval effort.

## Hint 1 — Attention cue

> “What changed about how she responded to evidence?”

## Hint 2 — Semantic axis

> “Focus on adaptability vs refusal to reconsider.”

## Hint 3 — Contrast

> “One word allows changing methods; the other suggests unreasonable refusal.”

Avoid immediately giving dictionary definitions.

---

# 35. Explanations as micro-learning

Feedback should use a consistent four-part structure internally:

```text
1. Verdict
2. Decisive clue
3. Contrast rule
4. Optional second example
```

Player sees only as much as needed.

Example:

> **OBSTINATE fits better.**  
> The key is that he *refused to reconsider after strong evidence*.  
> Persistence survives difficulty; obstinacy resists good reason.

Expandable:

> If he had changed his method but kept pursuing the goal, “persistent” would fit again.

This final counterfactual is especially valuable because it shows exactly what would have to change for the other word to become correct.

---

# 36. Counterfactual learning

For difficult distinctions, generate a **What Would Flip It?** interaction.

After a round:

> What single change would make **persistent** fit better than **obstinate**?

The player chooses among micro-edits to the scenario.

This should be an occasional advanced mechanic, not every round.

It directly teaches the semantic boundary.

---

# 37. Confidence input

Do not ask for confidence after every item.

Use it selectively in diagnostics and difficult reviews.

Options can be lightweight:

```text
Guessing
Pretty sure
Certain
```

High-confidence errors are pedagogically important and should trigger stronger misconception correction than low-confidence errors.

---

# 38. Mastery map visual model

The mastery map can become one of Last Word's signature surfaces.

Imagine a quiet navigable depth field:

- each word = luminous node;
- each meaningful distinction = connection;
- new nodes emerge as curriculum expands;
- mastered edges become stable, clean lines;
- weak edges shimmer or remain fragmented;
- due reviews produce a subtle pulse;
- selecting a node pulls connected words forward.

Example:

```text
                   economical
                       │
                       │
         thrifty ─── frugal ─── miserly
             │                     │
             └──────── cheap ──────┘
```

This visualization answers a student's natural question:

> “What exactly do I know now?”

without presenting a giant vocabulary percentage.

---

# 39. Rewards and progression

Rewards should expose meaningful achievement.

Good rewards:

- a newly stabilized distinction edge;
- a mastered semantic cluster;
- unlocking a harder precision tier;
- visual evolution of the mastery map;
- challenge runs;
- personal bests;
- “zero-hint” mastery;
- long-term retention milestones.

Weak rewards to avoid as the central system:

- meaningless coins;
- loot boxes;
- arbitrary energy timers;
- excessive streak anxiety;
- dozens of badges disconnected from learning.

A cosmetic/meta reward layer can exist later, but it should sit on top of genuine mastery rather than substitute for it.

---

# 40. Failure design

Wrong answers should feel like **information**, not punishment.

Visual sequence:

1. selected card briefly holds;
2. semantic field becomes unstable;
3. decisive clue highlights subtly;
4. correct/stronger word moves into relation with the clue;
5. scene recenters;
6. player continues quickly.

Never show a giant red X over the student's choice while sounding an alarm.

The emotional message should be:

> “Ah — *that* detail changes it.”

---

# 41. Accessibility and readability rules

The app can look exotic without making reading exotic.

Non-negotiables:

- sentence text does not rotate while being read;
- body text is never placed on visually noisy particles;
- line length remains comfortable;
- motion pauses or settles while a new context beat is being read;
- text contrast is independent of bloom/glow;
- the player can extend or remove timers in learning mode;
- no meaning depends only on color;
- reduced motion is available;
- screen-reader order follows logical content order;
- touch targets remain comfortably large;
- haptics/audio are optional.

---

# 42. Performance tiers

The same interaction should work across hardware.

## Tier A — Full

- shallow real-time 3D;
- particles;
- refraction/glass treatment;
- dynamic shadows where inexpensive;
- richer post-processing;
- full parallax.

## Tier B — Standard

- limited 3D;
- baked/cheap shadows;
- fewer particles;
- minimal post-processing;
- transform-based depth illusion.

## Tier C — Lite

- 2.5D cards;
- no expensive blur/refraction;
- texture-based glow;
- simplified transitions;
- same learning interaction and hierarchy.

**Never remove learning information when reducing visual quality.**

---

# 43. Data captured per decision

```yaml
user_id:
session_id:
set_id:
edge_id:
scenario_id:
beat_id:
presented_words:
selected_word:
best_word:
semantic_fit:
reaction_time_ms:
changed_selection:
previous_selection:
hint_level:
confidence:
misconception_tag:
content_difficulty:
review_interval_days:
```

This powers adaptation and content QA.

---

# 44. Analytics that matter

Learning metrics:

- first-attempt edge accuracy;
- shift accuracy;
- false-shift resistance;
- transfer accuracy;
- delayed retention;
- misconception recurrence;
- time-to-mastery;
- percentage of content skipped due to demonstrated knowledge;
- mastery decay/recovery.

Product metrics:

- session starts/completions;
- voluntary replay;
- average rounds per session;
- tutorial completion;
- hint usage;
- abandonment at feedback vs reading vs challenge;
- device performance tier;
- reduced-motion adoption.

Content-quality metrics:

- item disagreement rate;
- near-answer frequency;
- unusual reaction-time spikes;
- repeated complaints/reports;
- items whose “correct” answer experienced users consistently reject;
- position bias;
- domain bias.

---

# 45. Content QA loop from live data

Flag an item for review if:

- high-mastery students disproportionately miss it;
- two answers split strongly despite similar mastery;
- users repeatedly select an answer the model rated as implausible;
- reaction time is abnormally high for its difficulty;
- explanation views are unusually frequent;
- report rate exceeds threshold.

An adaptive education product should treat learner behavior as evidence that **the item may be bad**, not automatically that the learner is wrong.

---

# 46. Teacher / curriculum import model

A curriculum author can provide only:

```csv
set_id,words,priority,notes
1,"assure|ensure|insure",high,"formal writing"
2,"imply|infer",high,"common exam error"
3,"frugal|thrifty|miserly",medium,"connotation"
```

The pipeline then generates the complete semantic package.

Teacher/editor workflow:

1. Import word list.
2. AI proposes normalized senses and boundaries.
3. Human optionally edits/approves boundary map.
4. AI generates chains.
5. Critic scores ambiguity/naturalness.
6. Low-confidence items remain draft.
7. Approved content enters game bank.
8. Live analytics can automatically flag items for re-review.

---

# 47. Content safety and cultural quality

Scenario generation should avoid turning sensitive identities into semantic shortcuts.

Do not repeatedly associate negative words with particular:

- nationalities;
- religions;
- genders;
- disabilities;
- socioeconomic groups;
- occupations;
- family structures.

Avoid moral judgment that is irrelevant to the vocabulary distinction.

Use broad, ordinary contexts unless the curriculum specifically requires otherwise.

---

# 48. MVP definition

The MVP should **not** attempt the entire dream at once.

A strong MVP includes:

1. 2–3 word confusion sets.
2. 3-beat evolving scenarios.
3. Stay, flip, and false-shift rounds.
4. Best / acceptable / incorrect scoring.
5. Diagnostic skip logic.
6. Node + edge mastery.
7. Short explanations with decisive clues.
8. Adaptive review queue.
9. Premium shallow-3D word cards and context panel.
10. Motion + haptic hooks.
11. Reduced-motion mode.
12. Session recap.
13. Basic mastery map.
14. AI generation + critic pipeline.

## Do not require for MVP

- multiplayer;
- public leaderboards;
- avatars;
- complex currencies;
- user-generated content;
- full 3D worlds;
- voice acting;
- hundreds of achievements;
- elaborate narrative campaign.

Get the semantic loop perfect first.

---

# 49. Phase 2 possibilities

Once the core is validated:

- 4–5 word semantic clusters;
- counterfactual “What Would Flip It?” rounds;
- dialogue/audio contexts;
- pronunciation + usage if relevant;
- Daily Chain;
- asynchronous friend challenges;
- teacher-authored sets;
- class dashboards;
- collaborative “argue your answer” mode;
- advanced nuance mode where multiple answers receive graded semantic fit;
- generative personal-context practice with privacy protections;
- richer mastery-map exploration.

---

# 50. Acceptance criteria for a good Last Word round

A round is publishable only when all are true:

- [ ] The confusion set represents a real semantic confusion.
- [ ] Every word is used in the intended sense.
- [ ] The situation sounds natural.
- [ ] The first beat can be judged without hidden information.
- [ ] Every later beat adds meaningful evidence.
- [ ] If the answer flips, a specific semantic clue causes the flip.
- [ ] If the answer stays, the new information is plausibly distracting without being deceptive.
- [ ] The best answer is genuinely more precise than alternatives.
- [ ] Defensible alternatives are credited appropriately.
- [ ] No outside factual knowledge is required.
- [ ] The context does not reveal the answer through obvious lexical overlap.
- [ ] Feedback names the decisive clue.
- [ ] The example does not reinforce a harmful stereotype.
- [ ] The item adds evidence about an actual mastery edge.
- [ ] The animation does not reveal the answer.

---

# 51. Acceptance criteria for the product experience

The product is working when:

- [ ] A new user understands the mechanic in under two minutes.
- [ ] A student who already knows a set can prove it and skip teaching.
- [ ] A student who knows one word but not its boundary receives contrast practice rather than redundant definitions.
- [ ] Context can change the correct answer without confusing the player about why.
- [ ] The student can reverse a choice naturally as evidence evolves.
- [ ] Feedback consistently explains meaning, not just correctness.
- [ ] Replay uses novel contexts rather than rote sentence repetition.
- [ ] The mastery map reflects words and distinctions separately.
- [ ] Reviews test delayed retrieval and transfer.
- [ ] The game looks and feels premium without sacrificing text readability.
- [ ] Reduced-motion and low-performance modes preserve the complete learning interaction.
- [ ] Content analytics can detect potentially bad questions.

---

# 52. Example end-to-end learner journey

Consider a student encountering:

```text
CONFIDENT / ASSERTIVE / ARROGANT / AGGRESSIVE
```

## Step 1 — Existing knowledge lookup

Backend sees:

```text
confident node = Stable
arrogant node = Stable
confident ↔ arrogant = Fluent
assertive node = Recognized
aggressive node = Stable
assertive ↔ aggressive = Unseen
confident ↔ assertive = Unseen
```

## Step 2 — Do not reteach known material

No definitions for **confident** or **arrogant**.

## Step 3 — Diagnostic on new edges

Two short contexts test:

```text
assertive ↔ aggressive
confident ↔ assertive
```

## Step 4 — Detect misconception

Student repeatedly selects **aggressive** when someone communicates a boundary firmly.

Misconception inferred:

> “firm/direct communication = aggression.”

## Step 5 — Targeted contrast

Game produces contexts where tone and respect are the decisive axes.

Beat 1:

> “Mina told her teammate clearly that she could not take on another task.”

Best: **ASSERTIVE**

Beat 2:

> “She listened to his response and repeated her boundary calmly.”

Still: **ASSERTIVE**

Beat 3 in another round:

> “She then mocked him and threatened to make him regret asking.”

Flip: **AGGRESSIVE**

## Step 6 — Feedback

> **Firmness wasn't the problem.** The disrespect and threat changed assertiveness into aggression.

## Step 7 — Fresh transfer

Later context occurs in sports rather than work.

## Step 8 — Delayed review

Several days later, new contexts verify retention.

## Step 9 — Mastery graph updates

```text
assertive ↔ aggressive → Reliable
confident ↔ assertive → Distinguishing
confident ↔ arrogant → remains Fluent
```

This is the intended intelligence of the system.

---

# 53. What makes Last Word distinctive

The product should defend these five ideas even if everything else changes:

### 1. Context is revealed over time

The question itself evolves.

### 2. The correct word can legitimately change

The player is rewarded for updating judgment.

### 3. New information can also be irrelevant

The player is rewarded for *not* switching when meaning has not changed.

### 4. Mastery lives on semantic edges

The system understands the difference between knowing a word and distinguishing it from a neighbor.

### 5. Every mistake should reveal a boundary

The app should leave the learner thinking:

> “Oh. **That** is when the other word becomes right.”

If those five properties survive, the game remains Last Word even if the visual skin, curriculum, progression, or technology changes.

---

# 54. Learning-science rationale

Last Word deliberately combines several established learning ideas:

- **Retrieval practice:** learners make a judgment before seeing the explanation.
- **Corrective feedback:** retrieval is paired with immediate, clue-specific feedback.
- **Spaced practice:** mastered distinctions return after expanding intervals rather than being drilled continuously.
- **Transfer:** later examples use new domains and wording.
- **Adaptive difficulty:** difficulty is adjusted based on demonstrated performance and misconceptions.
- **Mastery learning:** learners who demonstrate mastery move on; learners who have not receive targeted corrective practice and re-testing.

The design intentionally avoids assuming that retrieval alone is magic. Recent review evidence suggests retrieval benefits are especially dependent on good implementation and feedback, and adaptive systems vary in effectiveness depending on what is actually adapted.

---

# 55. Motion/accessibility rationale

The premium visual direction must respect accessibility and performance constraints.

Design implications:

- provide a reduced-motion path;
- avoid flashing effects;
- keep motion short and state-driven;
- limit simultaneous animation;
- prefer transform-based animation over expensive layout recalculation;
- scale effects based on device capability;
- test on low/mid-range devices, not only development hardware.

The goal is **cinematic tactility**, not visual overload.

---

# 56. Research references informing the system

1. Gonçalves, A., Muniz, B. F. B., & Jaeger, A. (2025). *Retrieval Practice Versus Elaborative Encoding: A Systematic and Meta-analytic Review.* Educational Psychology Review, 37, 100. https://doi.org/10.1007/s10648-025-10076-6
2. Agarwal, P. K., Nunes, L. D., & Blunt, J. R. (2021). *Retrieval Practice Consistently Benefits Student Learning: a Systematic Review of Applied Research in Schools and Classrooms.* Educational Psychology Review, 33, 1409–1453. https://doi.org/10.1007/s10648-021-09595-9
3. Teymouri, R. (2024). *Recent developments in mobile-assisted vocabulary learning: a mini review of published studies focusing on digital flashcards.* Frontiers in Education, 9, 1496578. https://doi.org/10.3389/feduc.2024.1496578
4. *Effects of retrieval practice on retention and application of complex educational concepts.* Learning and Instruction, 100 (2025), 102219. https://doi.org/10.1016/j.learninstruc.2025.102219
5. *Adaptive training instructional interventions: A meta-analysis.* Evidence summarized in PubMed Central: https://pmc.ncbi.nlm.nih.gov/articles/PMC12413037/
6. W3C Web Accessibility Initiative guidance on animation/motion and WCAG applicability to web/mobile software: https://www.w3.org/WAI/standards-guidelines/wcag/
7. Unity UI and mobile performance guidance informing the general implementation principles around transform animation, concurrent animation, frame budgets, and device profiling: https://docs.unity.com/ and https://unity.com/how-to/

---

# 57. Final build philosophy

Last Word should feel as though the learner is **holding a living meaning in their hands**.

The words are stable objects.  
The world supplies evidence.  
The meaning shifts.  
The player updates their judgment.  
The system remembers exactly which distinctions they already own.  
And every time they get something wrong, the experience makes the border between the words a little sharper.

That is the entire product in one loop:

```text
READ → JUDGE → CONTEXT SHIFTS → REJUDGE → UNDERSTAND WHY → REMEMBER THE BOUNDARY
```

The visual ambition should make that loop irresistible to touch.  
The learning system should make repetition feel unnecessary whenever the student has already proved mastery.  
And the content system should make every new round test **meaning**, not pattern recognition.

**That is Last Word.**
