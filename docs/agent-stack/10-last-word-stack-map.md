# Last Word stack map

Product authority: [complete specification](../last-word-complete-game-design.md), read in full during bootstrap. This document assigns technical responsibility; it does not finalize gameplay implementation.

**Game state drives animation. Animation never drives game state.**

## System ownership

| Spec system | Technology / boundary |
| --- | --- |
| SemanticChamber, Atmosphere, SemanticField, CameraRig (§17) | R3F + Three; reuse Drei helpers; visuals observe state |
| WordObject (§17.2) | R3F/Drei geometry + Spring motion; accessible DOM choice owns focus/input semantics |
| ContextCard and clause reveal (§6, §17.3) | DOM + Motion; stable readable text alongside the Canvas |
| Magnetic selection, inertial tilt (§7) | Use Gesture reads movement; Spring gives visual response; XState owns accepted choice |
| Swipe switching (§7) | Gesture → semantic selection event → XState guard/context → Spring response |
| BeatController, ChoiceController (§6–7) | XState; selection reversible while active; semantic lock/deadline independent of effects |
| Semantic flip / false shift (§8.3, §10.6) | Content + XState evidence transition; presentation never leaks whether the answer changed |
| Last Word lock (§6) | XState commits decision; Spring snap and Howler cue respond independently |
| FeedbackLayer (§9, §35, §40) | XState phase/fit class + DOM/Motion explanation of decisive clue |
| MasteryState / diagnostics / review (§4–5, §12–16, §32) | Future domain/backend logic and XState orchestration; Zustand carries client projections |
| Mastery Map (§22.7, §38) | R3F graph, accessible DOM equivalent; optional UIkit for spatial inspection |
| ContentLoader (§10, §26–30) | Future server/API contract; actor invokes loading; Zustand may cache validated content |
| ReducedMotionAdapter (§18.4, §41) | System preference + Zustand override; Spring immediate/minimal motion, Motion reduced transitions |
| PerformanceTierAdapter (§42) | Presentation capability/measurement → Zustand tier; renderer can be replaced without recreating actor |
| HapticSoundHooks (§20) | Howler audio; host Capacitor haptics where appropriate; independently optional |

## State ownership table

| Data/state | Owner |
| --- | --- |
| Current round phase, beat, whether choice is open | XState |
| Selected semantic choice, committed choices, pause state | XState context |
| Semantic deadline/remaining reading time, if enabled | Domain/XState clock; explicit pause/resume semantics |
| Correctness/fit, decisive clue, misconception tags | Validated content + future domain rules; not derived from graphics |
| Word/node and distinction/edge mastery history | Backend persistence; separate client projections in Zustand |
| Player preferences, sound/haptics settings | Scoped Zustand store with deliberate persistence |
| Reduced-motion override and effective preference | Zustand override + observed system preference |
| Presentation tier | Zustand/device capability and measured performance |
| Session metadata, curriculum/content cache | Zustand; actor owns active round state |
| Drag samples, mesh positions, visual spring values | Gesture refs / Spring / R3F presentation |
| Text transition progress | Motion presentation |
| Sound playback and audio resource lifecycle | Howler presentation |

No duplicate `currentBeat`, `selectedWord`, or `isLocked` store fields outside the actor. Backend validation/persistence remains authoritative; a Zustand cache is not durable learning evidence.

## Motion ownership map

| Meaning / motion (§18) | Technical owner |
| --- | --- |
| Available / soft float | Spring/R3F; optional separate Drei Float wrapper for ambient motion |
| Selected / magnetic pull | Spring target from XState choice |
| Locked / tight snap | XState commits first; Spring responds |
| Switching / lateral slip | Spring response to accepted choice event |
| New evidence / depth emergence | Motion DOM transition; restrained R3F background response |
| Semantic relationship / connection pulse | R3F/Drei lines/particles, bounded and optional |
| Rejected interpretation / dissolve | Optional R3F material or Motion opacity, after judgment |
| Mastery / settle | Spring + stable non-motion status |
| Incorrect confidence / recoil and recenter | Spring presentation after feedback state |
| Screen transition | Motion; navigation/game progress does not wait for an exit callback |

One writer per property. If Float owns a parent group's ambient offset, Spring owns a separate child's selection transform. No physical simulation engine is required.

## PRIMARY TEXT IS DOM-FIRST

Context sentences, explanations, feedback, instructions, menus, settings, recap, and accessibility controls use standard HTML. The Canvas sits around/behind/alongside that layer. Text stays selectable, scalable, crisp, logically ordered, and screen-reader compatible. Projected `Html` can support a short label; essential paragraphs must not depend on mesh visibility, occlusion, bloom, or canvas availability.

Buttons and keyboard input use the same semantic events as gestures. Keep motion settled during reading; never communicate correctness solely with position, color, audio, or haptics. Learning timers remain extendable/removable per §41.

## Performance and reduced motion

| Presentation | Allowed approach | Invariant |
| --- | --- | --- |
| Tier A | Shallow R3F, bounded particles, carefully profiled glass/shadows/parallax | Same actor, content, accepted input semantics, learning evidence |
| Tier B | Cheaper materials/shadows, fewer particles, bounded DPR, minimal effects | Same invariant |
| Tier C | DOM/CSS 2.5D, no required WebGL | Same invariant |
| Reduced motion | No particles/parallax; minimal or instant object movement; stable text/fades | Same invariant |

The actor lives above the renderer boundary. A tier change must not reset choices or timers. Measure on target devices later; Chromium software rendering is integration evidence, not a mobile frame-budget certification. Keep DPR/material/shadow/particle choices inside the presentation adapter. Quality callbacks must never change question difficulty or learning rules.

## Content source of truth and future ingestion

The user designated `vocab_word_contrasts` as the source of truth on 2026-10-04: **888 records for 888 source words**, all `draft`; 430 overlapping, 429 paronym, 29 misuse. Fields include `id`, `word_id`, `contrast_word`, `contrast_gloss`, `confusion_type`, `status`, `created_at`. `word_id` joins `vocab_words`; `contrast_word` is text, not a second word foreign key. Preserve these source records exactly. This bootstrap performs no migration, write, approval, enrichment, or content export.

The source list seeds curriculum; it is not yet a playable bank. §10/§26 require sense normalization, boundary rules, evolving scenarios, fit scores, decisive clues, critic review, and publish gating. Future derived content must retain source provenance and remain separate from the preserved seeds. Do not silently mark draft rows approved. Student mistake records in `vocab_confusion_pairs` may inform later evidence; they do not replace the curated curriculum or prove edge mastery.

## Issues to resolve during implementation, without changing the specification

1. §9's fit scale reserves 1.00 for “best”, while §28's example calls 0.94/0.96 best. Define how explicit best/acceptable labels and numeric fit determine scoring before implementing it.
2. §6's second illustrative beat shows contrary evidence without explicitly stating refusal; the critic must enforce §9/§50's fairness requirements when authoring actual content.
3. §17.5's flip effects must also support answer-stays evidence transitions, otherwise they leak the flip and undermine false-shift resistance.
4. Exact reading deadlines, pause/resume bookkeeping, schema for edge mastery, and normalization of textual contrast words remain design/implementation decisions. Do not infer these from animation durations or existing per-word SRS fields.

These are documented open details, not bootstrap blockers and not changes to product behavior. No final game machine, scoring, adaptation, scenes, curriculum generation, or audio design was implemented.
