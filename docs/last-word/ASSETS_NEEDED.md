# Last Word — assets needed

**Status:** all 52 assets produced and validated. **Part I** is the visual specification (how the game looks, moment by moment, and its three signature elements). **Part II** lists every file to make: 52 assets, 12 of them must-have. The game is built to run with **zero** of these files: every asset has a procedural or code-drawn placeholder. When you drop in a real file, it replaces the placeholder with **no code change**.

- **Source of truth:** [`src/features/last-word/assets/asset-manifest.json`](../../src/features/last-word/assets/asset-manifest.json). This document mirrors it. If they ever disagree, the manifest wins (the validator reads it).
- **Where files go:** `public/last-word/assets/<folder>/<filename>`, with the exact names below.
- **How to check:** `npm run last-word:validate-assets` (report) or `npm run last-word:validate-assets -- --write` (also publishes the list the game loads). The production build runs the `--write` step automatically, so a deploy picks up new files.
- **What the game does with a bad file:** the validator leaves it out of `available.json`, so the game keeps the placeholder. A bad asset can never break play.

---

# Part I — Visual specification: how Last Word looks and feels

This part is the art direction every asset in Part II must serve. It is checked line by line against the design spec (§6–7, §17–22, §38, §40–42, §50–53) in A12. If an asset you make doesn't fit a frame described here, it doesn't belong in the game.

## A1. The idea in one picture

> **A dark, quiet chamber. Two or three dark tiles hang in it, each holding one word. Above them, a pane of glass carries the situation. Between the words, a single hair of light balances on a jewel, and it leans toward whichever word you choose. When new evidence arrives, the old pane sinks back into the dark, a ripple passes through the room, and the light lets go. You decide again. When you have the Last Word, a fine seal closes around your choice.**

Everything follows from that picture:

- **Words are objects** (§17.2): heavy, calm, dark tiles. The word is printed on them as live text, never painted into the art.
- **Context is a pane of evidence** (§17.3): clear, readable and frontal. Earlier panes stay visible as receding history.
- **Judgment is a balance** (§17.4, §18): the player's choice physically tilts the scene, and the scene never tilts toward the answer.
- **Commitment is a seal** (§6 "Last Word moment", §18 "tight snap").
- **Knowledge is a sky** (§22.7, §38): the mastery map is an observatory of word-stars joined by distinctions.

**Mood words:** *nocturnal, archival, precise, hushed, tactile, earned.*
**Never:** *neon, arcade, fantasy, cute, glossy, busy, triumphant.*

## A2. The three signature elements (what makes Last Word exclusive)

These three elements are what someone will remember and describe. They are also the premium layer: each costs very little to render and carries meaning, not decoration.

### Signature 1 — The Fulcrum (`models/fulcrum.glb`)

A filament of ivory light, about 3 m long and only 4–6 mm thick, hangs horizontally just below the context pane. At its centre sits a small faceted **pivot jewel** of smoky quartz with a faint warm core. The filament's two ends point at the outermost word tiles.

| Moment | What the Fulcrum does | Why |
|---|---|---|
| Nothing selected | Level. A barely visible breathing glow (2 s period, ±6% intensity) | "Unresolved" (§18.1 soft float) |
| Player selects a word | Tilts **toward the selected tile** by 3–4°, with a spring (tension 290, friction 26). The jewel's core warms slightly | "Magnetic pull = selected" (§18.1). It shows *your* judgment |
| Player switches | Slips across to the other side, overshooting by 0.5° (lateral slip) | "Lateral slip = switching" |
| New beat arrives (stay **or** flip) | Releases to level over 450 ms; a low ripple runs along the filament from the jewel outward; the jewel dims, then glows | "The old selection loosens magnetically" (§17.5). **Identical for stay and flip** |
| Lock | Snaps rigid, 160–240 ms. The filament brightens once along its length (a single 300 ms light-sweep) | "Tight snap = locked" |
| Feedback | Stays where the player put it. Never moves toward the best word | The correction is told by the tiles and text (A6), not by the balance |
| Mastery moment | Filament turns faint gold for 900 ms, then settles | "Stable glow / settle = mastery" |

For three-word sets the Fulcrum becomes a shallow **arc** through all three tiles, and the jewel slides along it toward the chosen tile instead of tilting.

### Signature 2 — Evidence Strata (`models/evidence-pane.glb`)

The context card is live HTML text on a glass panel. Behind it, inside the 3D scene, every **earlier beat** is a thin smoked-glass pane (1.6 × 0.9 m, 3 cm deep) that has stepped back:

```text
   z = -0.9   beat 1 pane   (opacity 0.30, 4% smaller, 6 cm higher)
   z = -0.6   beat 2 pane   (opacity 0.45)
   z =  0     LIVE pane     (DOM text, crisp)
```

When a new beat arrives, the current pane slides back one step (350–650 ms, eased, never bouncing) as the new text fades up in front. The player can *see* the situation accumulating. The previous beat's sentence is also printed, dimmed, above the live sentence in DOM for reading and screen readers. The 3D panes carry no text and are atmosphere only.

### Signature 3 — The Seal (`models/lock-ring.glb` + code)

When the player has the Last Word on the final beat:

1. The scene compresses inward: camera dolly of 2–3 cm and a vignette tighten (§6 "the environment compresses inward").
2. The **lock ring** closes around the chosen tile, scaling from 112% to 100% with a 200 ms snap.
3. A **hairline gold underline** draws once beneath the live word (SVG stroke in DOM, 400 ms). This is the only gold in the round until feedback, and it marks *commitment*, not correctness.
4. The `lock` sound and a medium haptic land on the same frame as the snap.

The Seal is the game's "chord". It should feel like closing a well-made box.

### Bonus — The Lexicon Observatory (mastery map, `models/mastery-node.glb` + `textures/star-dust.webp`)

The mastery map is a slow, navigable sky (§38). Each **word is a crystal seed** (node) and each **distinction is a filament** (edge), drawn in code:

| Edge state (§22.7) | Filament look |
|---|---|
| Unseen | Not drawn; region veiled in dust |
| Developing (Exploring / Distinguishing) | Broken dashes that shimmer slowly |
| Reliable / Fluent | Continuous ivory line, steady |
| Mastered | Clean line with a thin gold core |
| Review due | Gentle pulse (1.6 s) travelling along the line |

Node seeds glow in the LexiCore mastery colours (new gray → learning orange → familiar blue → strong teal → mastered green) **plus** a shape glyph and a text label, so no state relies on colour. Selecting a node pulls its neighbours forward (§38) and opens a DOM panel listing its distinctions.

## A3. Spatial composition

### Depth layers (§17.1), world units in metres, camera at +z looking toward −z

```text
side view (x →, z ↓ toward the camera)

 z -4.0 ┆ ░░ Layer 0  chamber shell, fog, dust              (chamber-shell.*.glb, env)
 z -1.7 ┆  ▭ Layer 1  evidence strata (oldest)               (evidence-pane.glb)
 z -0.9 ┆   ▭         evidence strata
 z  0.0 ┆ ▮   ▮ Layer 2  word tiles at rest                  (word-tile.*.glb)
 z +0.35┆  ▮     selected tile pulls forward
 z +0.65┆  ▮     locked tile                                 (lock-ring.glb around it)
 z +0.1 ┆ ━━◆━━ Layer 3  the Fulcrum under the context pane   (fulcrum.glb)
 DOM    ┆ ▓▓▓▓▓ Layer 3  context card — live HTML over the canvas
 z 0…0.2┆ · ✦ · Layer 4  halo sprites, bridge particles       (soft-glow, spark)
 DOM    ┆ ═════ Layer 5  HUD, beat dots, buttons — live HTML
```

### Camera

- Perspective, **28° vertical FOV**, at z = 10, aimed at the origin. A narrow FOV keeps depth gentle and the tiles undistorted.
- Ambient drift follows pointer or device tilt: at most **±1.5° yaw and ±1° pitch**, with 1.2 s easing. Drift is frozen while a new beat is being read (first 1.2 s after arrival) and fully off in reduced motion (§41: "motion pauses while a new context beat is being read").
- "Compression" on the Last Word: dolly of 0.25 m over 600 ms, and back after feedback.

### Screen layout

```text
Phone portrait (390 × 844)                Desktop (1440 × 900)
┌──────────────────────────┐              ┌──────────────────────────────────────────┐
│ ‹  LAST WORD     ●●○  ⏸ ?│ 56 px HUD     │ ‹ LAST WORD          ●●○      ? ⏸  ⚙    │
│                          │               │                                          │
│  (earlier beat, dimmed)  │               │        ┌──────────────────────────┐      │
│ ┌──────────────────────┐ │               │        │ earlier beat (dimmed)    │      │
│ │ Live context sentence│ │ ~36%          │        │ LIVE CONTEXT SENTENCE    │ 640  │
│ │ on the glass pane    │ │               │        └──────────────────────────┘ max  │
│ └──────────────────────┘ │               │      ────────────◆────────────          │
│   ─────────◆─────────    │ Fulcrum       │   ┌────────┐            ┌────────┐       │
│ ┌────────┐  ┌────────┐   │               │   │PERSIST-│            │OBSTIN- │       │
│ │PERSIST-│  │OBSTIN- │   │ tiles in      │   │  ENT   │            │  ATE   │       │
│ │  ENT   │  │  ATE   │   │ thumb zone    │   └────────┘            └────────┘       │
│ └────────┘  └────────┘   │               │                                          │
│ [   Lock this reading  ] │ 52 px CTA     │          [ Lock this reading ]           │
└──────────────────────────┘ safe area     └──────────────────────────────────────────┘
```

- Tiles always sit in the lower third on phones (one-handed reach, LexiCore §6). Touch targets cover the whole tile, at least 120 × 96 px.
- The context pane never overlaps a tile, and no particle ever crosses the text.
- Three-word sets: tiles sit on a shallow arc, with the middle tile 0.15 m deeper.

## A4. Light

| Light | Setup | Purpose |
|---|---|---|
| Key | Large soft ivory `#F5F5F5` area/softbox upper-left at 45°, intensity so bevels peak at ~85% white | Reveals tile form; reads as "studio quiet" |
| Fill | None. Darkness is the fill | Keeps contrast for text |
| Environment | `chamber-env.hdr` (Full) / code lightformers | Bevel and edge reflections only |
| Selection | **Emissive** on `tile_rim` (crimson `#E63946` at 35%), **not** a scene light | Shows the player's choice without lighting the other tile (no hint) |
| Mastery | Emissive gold `#F4A828` on rim, filament or node | Earned value only |
| Fog | Linear `#0F0F0F` from z −1 to −5 | Depth falloff; removes shell detail behind text |
| Exposure | ACES filmic, slightly under. Blacks stay `#0F0F0F`, never crushed to pure black | Premium, not murky |

## A5. Material guide

| Surface | Base colour | Metal | Rough | Extras | Feel |
|---|---|---|---|---|---|
| Tile body | `#1A1A1A` | 0.55 | 0.42 | Fine grain normal (0.15) · Full: clearcoat 0.6 / 0.25 | Blackened metal block |
| Tile bevel | `#242424` | 0.7 | 0.3 | Catches the key light as a 1–2 px ivory line | Machined edge |
| Tile rim (`tile_rim`) | `#111111` | 0.4 | 0.5 | Emissive slot (runtime colour) | Dormant filament |
| Tile face (`tile_face`) | `#161616` | 0.1 | 0.85 | Flat and matte | A calm page for the word |
| Evidence pane | `#20262A` @ 35% | 0 | 0.15 | Full: clearcoat 1.0; edges 1 px ivory | Smoked glass |
| Fulcrum beam | ivory emissive 0.6 | — | — | Unlit core + soft halo sprite | Hair of light |
| Pivot jewel | smoky `#3A3530` | 0 | 0.1 | Inner emissive warm `#F4A828` at 15% | Smoky quartz |
| Lock ring | `#2A2A2A` | 0.85 | 0.35 | Brushed (anisotropic look in the texture) + emissive inner edge | Jeweller's bezel |
| Chamber shell | `#121212`–`#1E1E1E` | 0.3 | 0.7 | Grain; ribs catch the key light | Stone and metal nave |
| Mastery node | `#2B2B30` glass | 0 | 0.08 | Emissive core (runtime) | Crystal seed |

## A6. Every state, frame by frame

Timing tokens are the spec's (§18.2): micro 80–140 · snap 160–240 · card 240–420 · context 350–650 · flip 450–750 · mastery 700–1300 · scene 500–900 ms.

| State | Tiles | Fulcrum | Context / strata | Effects | Sound · haptic |
|---|---|---|---|---|---|
| **Launch** | Two blank tiles drift in a slow orbit (Full); `launch-sculpture.webp` (Lite) | Level, breathing | — | Dust | `review-due` if reviews are due |
| **Set intro** (§22.2) | Tiles for the set fly into their spatial arrangement (scene 700 ms), labelled with the words. No definitions | Appears last, level | — | — | `reveal` |
| **Reading, unresolved** | Soft float ±1.5 cm, 4 s period, all identical | Level, breathing | New text fades up (context 480 ms); strata step back | Ambient only | `arrival` · light tick |
| **Selected** | Chosen tile pulls forward 0.35 m and turns 3° toward the centre; rim crimson 35%; halo sprite 40% | Tilts 3–4° toward it | — | Bridge particles drift toward the chosen tile (Full) | `select` · light |
| **Switching** | Old tile releases (card 320 ms); new tile pulls with a 0.5 cm lateral overshoot | Slips across | — | Faint 200 ms trail on the jewel | `switch` · double tick |
| **Locked (mid-chain)** | Chosen tile snaps to z +0.65 (snap 200 ms), float stops | Rigid, light-sweep once | — | — | `lock` · medium |
| **New evidence** (stay *and* flip, identical) | Locked tile drifts back to "selected" depth; rim fades to 15% (still visibly yours) | Releases to level over 450 ms | Pane steps back into the strata; new text fades up; ripple ring passes once (flip 600 ms) | Ripple only | `arrival` · light tick |
| **Last Word** | Seal closes; camera compresses | Rigid | Pane holds | Vignette +10% | `lock` · medium |
| **Feedback: best** | Chosen tile settles forward, rim → soft ivory; the other tile dims to 60% | Stays where it is | Decisive clue highlighted in the sentence (DOM `mark`) | One soft glow pulse (300 ms) | `best` · success |
| **Feedback: defensible** | Chosen tile stays; best tile rises 4 cm beside it and both rims glow ivory | Stays | Clue highlighted; "fits more precisely" copy | — | `defensible` · light |
| **Feedback: incorrect** (§40) | Chosen tile *holds* 250 ms, then a short recoil (−6 cm); fracture dissolve to 35% (Full) or fade (others); best tile moves 4 cm toward the clue; scene re-centres | Stays | Clue highlighted; contrast line | Field unsteady for 300 ms, then calm | `incorrect` · warning |
| **Hold Your Ground** | As "best", plus a tiny anchor icon on the tile | — | — | — | `hold` |
| **Perfect Read** (§8.4) | The best-word path replays as a light thread tracing tile → tile across beats (900 ms) | Gold filament | — | Spark trail (Full) | `perfect-read` · success |
| **Diagnosis result** | Tiles settle side by side; a calm gold seam between them if "you already own this" | Gold if skipped (A), ivory otherwise | — | — | `mastery` (A) / `reveal` |
| **Paused** | Everything freezes; 40% darken | Freeze | Text unchanged | — | — |
| **Hint open** (§34) | No tile change (a hint never points at a tile) | — | Hint text slides under the pane | — | `hint` |
| **Recap** (§22.6) | Each improved distinction shows as two mini tiles joined by its filament, brightening in turn (mastery 900 ms each, skippable) | — | — | — | `reveal`, then `mastery` per status rise |
| **Mastery map** | Observatory (A2 bonus) | — | — | Star dust parallax ±1° | `reveal` |

## A7. Rules against revealing the answer (§17.3, §17.5, §50)

1. Before judgment, **every word tile is pixel-identical** except for the player's own selection state.
2. Stay and flip transitions are **the same animation, sound and haptic**. The QA test is to record both and diff them; they must match.
3. The Fulcrum tracks the **player**, never the content.
4. No colour on any tile means "right" or "wrong" before feedback. Crimson means "your choice", gold means "earned".
5. After feedback, correctness is always told in **words** as well (verdict line), never by motion or colour alone (§41).

## A8. Tiers side by side (§42)

| | **Full** | **Standard** | **Lite** | **Reduced motion** (any tier) |
|---|---|---|---|---|
| Tiles | `word-tile.full.glb`, clearcoat, env reflections | `word-tile.standard.glb`, no clearcoat | CSS 2.5D card on `tile-surface.lite.webp`, `perspective` tilt | Same objects, no float or tilt |
| Fulcrum | `fulcrum.glb` + halo | `fulcrum.glb`, no halo | CSS hairline with a rotating jewel glyph | Tilt shown as a static angle, no spring |
| Strata | 2 glass panes | 1 pane | Dimmed DOM previous beat | Same |
| Chamber | `chamber-shell.full.glb`, fog, dust, env | `chamber-shell.standard.glb`, fog | `chamber-backdrop.*.webp` | Static backdrop / no dust |
| Seal | Ring snap + light-sweep + dolly | Ring snap | CSS ring + underline | Instant ring + underline |
| Particles | ≤ 24 bridge, mastery spark burst | ≤ 8 | none | none |
| Ripple | Shader ring | Shader ring | CSS ring fade | 150 ms opacity pulse |
| Learning info | **Identical** | **Identical** | **Identical** | **Identical** |

## A9. Typography inside the scene

- **The word on a tile:** Cormorant Garamond 700, 30–40 px (clamped to tile width), tracking −0.01 em, ivory `#F5F5F5`, centred on `tile_face`. Long words (≥ 11 letters) drop to 26 px rather than wrap. Never all-caps; the serif carries the elegance.
- **Context sentence:** Cormorant Garamond 500, 22–26 px, line-height 1.45, max 34 em per line, ivory. Previous beat 17 px at 55% opacity.
- **Decisive clue in feedback:** the same text with a soft gold underline-highlight (not a box). It reads like a scholar's annotation.
- **HUD, buttons, eyebrows:** Sora (LexiCore rules): eyebrows 11 px uppercase, tracking 0.14 em.
- **Verdicts:** Cormorant 700 italic, 28–34 px ("Obstinate fits better.").

## A10. What makes it premium (and what would cheapen it)

**Do:**
- One dominant light, deep blacks and fine grain: the restraint *is* the luxury.
- Every motion means something (A6). Nothing loops for decoration except the faint breathing.
- Micro-details: a 1 px ivory bevel highlight on tiles, a single light-sweep on lock, the gold underline drawn once, sound and haptic landing on the same frame as the snap.
- Sounds in one family (felt, glass, wood, air) in one key, so the whole game sounds like one instrument.
- Text that is crisper than anything else on screen.

**Don't:**
- Bloom on text, chromatic aberration, lens flares, screen shake or confetti.
- Saturated gradients, rainbow particles, or glassmorphism on everything.
- Long unskippable celebrations (§18.2). A mastery moment stays under 1.3 s.
- 3D text, or words engraved into geometry.

## A11. Moodboard in words (for briefing artists and AI tools)

> *A museum of language at night.* Think: an obsidian monolith in a dark gallery; a jeweller's loupe and a single hair of light; smoked glass panes stacked in an archive; a planetarium dome dimmed to its faintest stars; Japanese-minimal stagecraft; Dieter Rams precision. Matte charcoal, blackened steel, smoky quartz, ivory light, one crimson thread, a rare gold seam.

## A12. Check against the design spec

| Spec | Requirement | How it is visualised | Assets |
|---|---|---|---|
| §6 | Last Word moment: environment compresses, chosen word comes forward | The Seal (A2) | lock-ring, word-tile |
| §7.1 | Drag/tilt the context toward a word; swipe to switch; tap to magnetise | Drag tilts the Fulcrum; release beyond threshold selects; tap selects | fulcrum |
| §7.3 | Selection reversible until the beat closes | Switching state, A6 | — |
| §8.3–8.4 | Hold Your Ground; Perfect Read replays the path | A6 rows | hold, perfect-read sfx, spark |
| §17.1 | Six depth layers | A3 | shell, strata, tiles, fulcrum |
| §17.2 | Word objects with depth, edge light, tilt, inertia, halo; crisp frontal type | A5, A9 | word-tile, soft-glow |
| §17.3 | Context revealed into the scene; never reveals the answer | Evidence Strata + A7 | evidence-pane |
| §17.4 | Context hovers between contenders; faint particle bridge; no colour coding | Fulcrum + bridge particles | fulcrum, spark |
| §17.5 | Flip: ripple, card shifts, old selection loosens, field live again, haptic tick | New-evidence row (identical for stay) | — |
| §18 | Motion grammar and timing tokens | A2 tables, A6 | — |
| §18.4 / §41 | Reduced motion keeps all meaning; text stable while reading | A8 column; drift frozen on arrival | — |
| §19 | Sparse premium effects; composition over cost; degrade by device | A8, A10 | all textures |
| §20 | Sound families and haptics, independently optional | Part II §5–§7 | sfx, haptics |
| §22.1–22.7 | Launch, set intro, live round, feedback, recap, mastery map | A6, Observatory | launch-sculpture, star-dust, mastery-node |
| §38 | Mastery map as a navigable depth field with luminous nodes and edge states | Observatory table | mastery-node, star-dust |
| §40 | Failure: hold, unstable, clue highlight, stronger word relates to clue, recentre | Incorrect row | fracture-mask |
| §42 | Full / Standard / Lite | A8 | per-tier files |
| §50 | "The animation does not reveal the answer" | A7 | — |

---

# Part II — Asset production spec

## 0. Ground rules for every asset

### Visual language

Last Word lives inside LexiCore, so it uses the LexiCore palette and tone from [`DESIGN.md`](../../DESIGN.md) and [`LEXICORE_VISUAL_ASSET_BRIEF.md`](../../LEXICORE_VISUAL_ASSET_BRIEF.md). The setting is the **Semantic Chamber** of the design spec (§17): a dark, shallow, quiet space with floating word tiles and one evolving context panel.

| Role | Colour | Where it may appear |
|---|---|---|
| Base black | `#0F0F0F` | Chamber void, backdrops |
| Surface charcoal | `#1A1A1A` | Tile bodies, panels |
| Elevated charcoal | `#242424` | Tile bevels, raised edges |
| Ivory | `#F5F5F5` | Key light, highlights (never large fills) |
| Secondary gray | `#B0B0B0` | Secondary light, fine lines |
| Crimson | `#E63946` | **Selection / active** rim light only |
| Gold | `#F4A828` | **Earned mastery** glow only |

- **Matte first.** Blackened metal, charcoal enamel, smoked glass and fine grain. Highlights are earned, not everywhere.
- **No colour implies correctness.** Per §17.4 and §17.3, nothing in the art may show which word is right before the player decides. Tiles are identical; the game tints rims at runtime.
- **No text baked in.** Words, sentences, numbers and labels are always live DOM (accessibility rule §41). Leave a calm, flat front face on tiles for the live word.
- **Calm centre.** Backdrops keep the middle 60% dark and low-contrast, because body text sits there.
- **Restraint.** One dominant accent per asset. No neon, no fantasy props, no mascots, no glossy mobile-game look (see LexiCore anti-references).

### 3D export rules (all `.glb`)

1. **glTF 2.0 binary (`.glb`)**, everything embedded (geometry, materials, textures). No external `.bin` or image files.
2. **No mesh or texture compression.** No Draco, no meshopt, no KTX2/Basis. The site's security policy blocks the decoders' worker scripts. The validator rejects these extensions.
3. **Textures:** WebP (preferred) or PNG, power-of-two, embedded. Metal-roughness PBR (`baseColor`, `metallicRoughness`, `normal`, optional `emissive`).
4. **Units and axes:** metres, **Y-up**, front faces toward **+Z** (the camera). Apply all transforms before export (Blender: *Apply → All Transforms*).
5. **Origin:** at the visual centre unless a section says otherwise.
6. **Node/mesh names are required** where listed. The game finds parts by name (for example, it re-tints `tile_rim` for selection).
7. Keep materials few. Each extra material is an extra draw call on phones.

From a text-to-3D tool (Meshy, Tripo, Rodin and similar), import into Blender, then: decimate or retopologise to the triangle budget, rename nodes, set the origin, scale to the exact size, rebake textures at the target resolution, and export with *glTF Binary → Images: WebP*, *Compression: off*.

### Audio rules

- **Primary file:** `.mp3`, 44.1 or 48 kHz. Sound effects are **mono**, 96–128 kbps. Music is stereo, 128 kbps.
- **Optional twin:** the same sound as `.webm` (Opus) next to it, for smaller downloads. Validated if present; never required.
- **Loudness:** effects peak at −1 dBTP, around −20 LUFS integrated for short cues. Music beds sit around −28 LUFS so they never compete with reading.
- **Edges:** no silence padding longer than 10 ms at the start (cues must feel instant). Fade tails naturally; no clicks.
- **Loops** must be sample-accurate and seamless (match start and end phase). Test by looping 3× in an editor.
- **Character:** soft, physical, dimensional. Felt keys, glass, low wood, brushed metal, muted mallets, airy pads. Never a game-show buzzer, laser, coin or fanfare. Incorrect must feel like *information*, not punishment (§40).

### Tiers

| Tier | Who gets it | Asset load budget (first entry) |
|---|---|---|
| **Full** | Capable devices with WebGL2 | ≤ 2.6 MB |
| **Standard** | Mid-range phones/tablets | ≤ 1.1 MB |
| **Lite** | No WebGL, low-end, or the player's choice | ≤ 0.5 MB |

Reduced motion uses whichever tier is active but freezes ambient motion. Music is excluded from the budgets: it streams after the player turns it on.

---

## 1. 3D models

### 1.1 Word tile — Full · `must-have`

| | |
|---|---|
| **File** | `public/last-word/assets/models/word-tile.full.glb` |
| **Purpose** | The physical word object of §17.2. Each candidate word floats on one. The live DOM word is aligned over its front face. The game moves, tilts, pulls and snaps it according to game state. |
| **Format** | glTF 2.0 binary, embedded WebP textures ≤ 1024 px |
| **Size** | **1.0 m wide × 1.4 m tall × ≤ 0.2 m deep**, centred on the origin, front face +Z |
| **Budget** | ≤ 6,000 triangles · ≤ 420 KB · ≤ 3 materials · ≤ 4 meshes |
| **Required nodes** | `tile_body` (the slab). Optional: `tile_rim` (a thin separate edge/bezel mesh the game tints crimson when selected and gold on mastery; give it a dark emissive-ready material), `tile_face` (a flat front plane marking where the word sits; may be invisible) |
| **Material** | Body: charcoal `#1A1A1A` blackened metal / dense smoked glass, roughness 0.35–0.55, subtle grain. Bevel catches an ivory key light. Rim: near-black with an emissive channel (the runtime sets the colour). Front face: flat, matte and calm, so DOM text reads crisply on top |
| **If missing** | A procedural rounded box with a physical material, same size and motion |

**Prompt (text-to-3D):**
> A minimalist floating monolith tile for a premium vocabulary game, portrait proportion 1 : 1.4, about 0.2 deep. Softly bevelled rounded-rectangle slab with a thin separate inset bezel around the front edge. Material: matte charcoal blackened metal with faint fine grain and a slightly smoked-glass edge, colour #1A1A1A, bevel highlights in soft ivory. Flat, perfectly calm front face with no engraving, no text, no symbols. Elegant, architectural, quiet, museum-object quality. No neon, no gems, no ornament. Clean topology, centred pivot, PBR metal-roughness.

### 1.2 Word tile — Standard · `must-have`

| | |
|---|---|
| **File** | `public/last-word/assets/models/word-tile.standard.glb` |
| **Purpose** | The same tile at a cost mid-range phones can afford |
| **Format / size** | As 1.1, textures ≤ 512 px, **no clearcoat or transmission extensions** |
| **Budget** | ≤ 1,500 triangles · ≤ 160 KB · ≤ 2 materials · ≤ 3 meshes |
| **Required nodes** | `tile_body`; optional `tile_rim`, `tile_face` |
| **Style** | A decimated twin of 1.1 with the same silhouette. Bake bevel detail into the normal map |
| **If missing** | Procedural rounded box with a standard material |

**Prompt:** use 1.1's prompt, then decimate. Do not regenerate: the silhouette must match the Full tile exactly.

### 1.3 Chamber shell — Full · `nice-to-have`

| | |
|---|---|
| **File** | `public/last-word/assets/models/chamber-shell.full.glb` |
| **Purpose** | Layers 0–1 of the Semantic Chamber (§17.1): a shallow architectural space behind the word field, giving depth and parallax without competing with text |
| **Format** | glTF binary, textures ≤ 1024 px |
| **Volume** | All geometry inside **x −7…7, y −4…4, z −4…−0.6** (behind the tiles; the camera sits at +z) |
| **Budget** | ≤ 12,000 triangles · ≤ 700 KB · ≤ 3 materials · ≤ 6 meshes |
| **Required nodes** | `shell`; optional `floor` (receives a soft reflection), `arches` |
| **Style** | A concave, curved rear wall built from tall shallow arches or ribbed panels, fading into black. Charcoal stone/metal with fine grain, almost invisible except where an ivory key light grazes the ribs. A faint crimson glow can pool low on the floor. Must read as *depth*, not as a room with furniture |
| **If missing** | Layered gradients and a faint procedural ring field |

**Prompt:**
> A shallow, concave architectural backdrop for a dark game scene: a gently curved rear wall of tall slender arches and vertical ribbed panels, receding into black. Matte charcoal stone and blackened metal, colour #0F0F0F to #242424, very fine grain, edges catching a soft ivory side light, a faint crimson glow pooling near the floor. Calm, cathedral-quiet, minimal, no statues, no windows, no text, no props. Low-poly friendly, wide and shallow, viewed straight on.

### 1.4 Chamber shell — Standard · `nice-to-have`

| | |
|---|---|
| **File** | `public/last-word/assets/models/chamber-shell.standard.glb` |
| **Budget** | ≤ 3,000 triangles · ≤ 250 KB · textures ≤ 512 px · ≤ 2 materials · ≤ 4 meshes · no clearcoat/transmission |
| **Volume / nodes** | As 1.3 |
| **Style** | Decimated twin of 1.3 |
| **If missing** | Layered CSS gradients |

### 1.5 Lock ring · `nice-to-have`

| | |
|---|---|
| **File** | `public/last-word/assets/models/lock-ring.glb` (shared by Full and Standard) |
| **Purpose** | The "tight snap" of §18.1: a thin seal that closes around the chosen tile when the player commits the Last Word |
| **Size** | **1.3 × 1.7 m frame, ≤ 0.12 m deep**, centred. It must surround a 1.0 × 1.4 tile with clearance |
| **Budget** | ≤ 1,500 triangles · ≤ 120 KB · textures ≤ 512 px · ≤ 2 materials · ≤ 2 meshes |
| **Required nodes** | `ring` |
| **Style** | A fine rounded-rectangle bracket/frame, like a jeweller's bezel or an archival seal. Brushed dark metal with an emissive inner edge the runtime lights (crimson on lock, gold on mastery). Thin and precise |
| **If missing** | Procedural rounded-rectangle line loop |

**Prompt:**
> A thin, precise rounded-rectangle frame, portrait 1.3 by 1.7, very shallow (0.1), like a jeweller's bezel or an archival seal setting. Brushed blackened metal with a slim inner edge that can glow. Minimal, elegant, no ornaments, no text. Centred pivot, clean low-poly topology.

### 1.6 Mastery node · `nice-to-have`

| | |
|---|---|
| **File** | `public/last-word/assets/models/mastery-node.glb` (Full and Standard, instanced) |
| **Purpose** | One word on the 3D mastery map (§22.7, §38). Edges (distinctions) are drawn as lines in code; the runtime colours nodes by word status |
| **Size** | Fits a **1 m cube**, centred |
| **Budget** | ≤ 600 triangles · ≤ 80 KB · 1 material · 1 mesh · texture ≤ 256 px |
| **Required nodes** | `node` |
| **Style** | A faceted glass/stone seed or softly cut polyhedron. Neutral charcoal with an emissive core the runtime tints (gray new → orange → blue → teal → green mastered, per the LexiCore mastery mapping) |
| **If missing** | Low-poly icosphere |

**Prompt:**
> A small softly faceted crystal seed, like a cut smoky-quartz pebble, neutral charcoal glass with an inner core that can glow. Minimal, elegant, no text. Under 600 triangles, centred pivot.

### 1.7 The Fulcrum — signature element · `nice-to-have`

| | |
|---|---|
| **File** | `public/last-word/assets/models/fulcrum.glb` (Full and Standard) |
| **Purpose** | Signature 1 (Part I, A2): a hair of light balanced on a pivot jewel between the words. It tilts toward the player's selection, releases on each new beat, and goes rigid on lock |
| **Size** | **3.0 m long × ≤ 0.16 m × ≤ 0.16 m**, centred, beam along **X**. The runtime stretches only the `beam` node to the distance between tiles, so keep the beam a plain cylinder whose length is along X |
| **Budget** | ≤ 1,200 triangles · ≤ 90 KB · ≤ 2 materials · ≤ 2 meshes · texture ≤ 256 px |
| **Required nodes** | `beam` (thin cylinder, 4–6 mm radius, ivory emissive-ready material), `pivot` (faceted jewel, ~0.14 m, at the origin) |
| **Material** | Beam: unlit/emissive ivory. Pivot: smoky quartz `#3A3530`, roughness 0.1, with an inner emissive core the runtime warms to gold |
| **If missing** | Procedural emissive cylinder + octahedron (same behaviour) |

**Prompt (text-to-3D):**
> A minimalist balance element: an extremely thin, perfectly straight horizontal rod of light, 3 units long, with a small faceted smoky-quartz jewel at its exact centre acting as a pivot. The jewel is a softly cut octahedral gem, dark smoky brown-gray, translucent, with a faint warm glow deep inside. Precise, jewellery-grade, minimal, no ornaments, no supports, no text. Under 1,200 triangles. Separate objects for the rod and the jewel, pivot at the jewel's centre.

### 1.8 Evidence pane — signature element · `nice-to-have`

| | |
|---|---|
| **File** | `public/last-word/assets/models/evidence-pane.glb` (Full and Standard) |
| **Purpose** | Signature 2 (Part I, A2): earlier context beats recede behind the live context card as stacked smoked-glass panes. The panes carry **no text** |
| **Size** | **1.6 × 0.9 × 0.03 m**, centred, face toward +Z |
| **Budget** | ≤ 400 triangles · ≤ 60 KB · 1 material · 1 mesh · texture ≤ 512 px |
| **Required nodes** | `pane` |
| **Material** | Smoked glass `#20262A` at about 35% opacity (alpha blend), roughness 0.15, polished 1 px edges that catch the key light. Full may add `KHR_materials_clearcoat`; transmission is not allowed |
| **If missing** | Procedural rounded plane with a gradient and an edge highlight |

**Prompt (text-to-3D):**
> A single thin pane of smoked glass, 1.6 by 0.9 units, 3 cm thick, with softly rounded corners and finely polished edges that catch light. Dark smoky gray-blue tint, mostly transparent, completely blank surface, no text, no frame. Minimal, archival, precise. Under 400 triangles, centred pivot.

---

## 2. Textures and environment maps

Shaders (the semantic-flip ripple, rim lighting, grain and reject dissolve) are **written in code**. These textures are their optional inputs.

| # | File (`public/last-word/assets/…`) | Format & exact size | Budget | Tiers | Priority | Purpose | If missing |
|---|---|---|---|---|---|---|---|
| 2.1 | `textures/chamber-env.hdr` | Radiance HDR, equirect **512 × 256** | 400 KB | Full | nice | Soft reflections on tile bevels: dark room, ivory key softbox upper-left, faint crimson rim lower-right | Code-built lightformer rig |
| 2.2 | `textures/noise-grain.webp` | WebP **256 × 256**, grayscale, **seamless** | 60 KB | All | nice | Film grain for atmosphere and tile surfaces (LexiCore's 0.025 noise) | Generated canvas noise |
| 2.3 | `textures/soft-glow.webp` | WebP **256 × 256**, **alpha** | 30 KB | Full, Std | nice | Radial halo sprite: selection glow, particle bodies | Canvas radial gradient |
| 2.4 | `textures/spark.webp` | WebP **64 × 64**, **alpha** | 12 KB | Full | nice | Tiny particle for the semantic bridge and the mastery bloom | Canvas dot |
| 2.5 | `textures/fracture-mask.webp` | WebP **512 × 512**, grayscale | 90 KB | Full | nice | Dissolve mask for the "rejected interpretation" card fracture, used only *after* judgment | Opacity/scale fade |
| 2.6 | `textures/tile-surface.lite.webp` | WebP **512 × 720**, **alpha** | 70 KB | Lite | nice | A pre-rendered tile face (no text) so Lite's 2.5D CSS cards match the 3D family | CSS gradient tile |
| 2.7 | `textures/star-dust.webp` | WebP **1024 × 1024**, **seamless** | 160 KB | Full, Std | nice | Deep field behind the Lexicon Observatory mastery map (Part I, A2) | Procedural point field |

**Prompts:**

- **2.1 env map:** *"Equirectangular HDR studio environment, nearly black room, one large soft ivory rectangular softbox high on the left, a narrow faint crimson strip light low on the right, smooth falloff, no objects, no floor texture."* Generate it, or render it in Blender from two area lights. Export 512×256 Radiance `.hdr`.
- **2.2 grain:** *"Seamless tileable fine film grain, monochrome mid-gray, even density, no visible pattern or seams, 256 px."* Verify by tiling 4×4.
- **2.3 soft glow:** *"Soft radial light falloff, white centre fading smoothly to fully transparent edge, no rings, no banding, transparent PNG/WebP 256 px."* The runtime tints it.
- **2.4 spark:** *"Tiny soft four-point light spark, white on transparent, very subtle, 64 px."*
- **2.5 fracture mask:** *"Grayscale crack-propagation mask for a dissolve shader: fine branching fracture lines radiating from the centre, values from black (first to dissolve) to white (last), no text, 512 px seamless edges not required."*
- **2.7 star dust:** *"Seamless tileable deep-space dust field, nearly black #0F0F0F, very sparse faint ivory specks of varied size, two or three soft blurred points, faint warm haze in places, no nebula colours, no planets, calm and minimal, 1024 px."* Verify by tiling 2×2: no visible seams or repeated clusters.
- **2.6 Lite tile surface:** a render of the Full word tile (1.1) straight on, at 512×720 with a transparent background, no text, no selection glow. Render it from the GLB once it exists so the families match.

---

## 3. Images (Lite tier, launch and sharing)

| # | File | Format & exact size | Budget | Priority | Purpose | If missing |
|---|---|---|---|---|---|---|
| 3.1 | `images/chamber-backdrop.landscape.webp` | WebP **1920 × 1080**, opaque | 220 KB | **must** | Static Semantic Chamber backdrop for Lite, WebGL-off and reduced-motion desktop | CSS gradients |
| 3.2 | `images/chamber-backdrop.portrait.webp` | WebP **1080 × 1920**, opaque | 200 KB | **must** | Same, for phones | CSS gradients |
| 3.3 | `images/launch-sculpture.webp` | WebP **1200 × 800**, **alpha** | 120 KB | nice | Launch hero for Lite: two blank tiles facing each other with a faint orbit between | CSS mini tiles |
| 3.4 | `images/og-last-word.png` | PNG **1200 × 630** | 400 KB | nice | Social share card for `/last-word` | Host default image |

**Prompts:**

- **3.1 / 3.2 backdrop:** *"A dark, calm, shallow architectural space seen straight on: a gently curved rear wall of tall slender arches receding into black, matte charcoal stone and blackened metal (#0F0F0F–#242424), fine film grain, a soft ivory side light grazing the arches, a faint crimson glow pooling low near the floor. The centre of the frame is empty, dark and low-contrast for overlaid text. Cinematic, minimal, premium, no objects, no text, no people."* Generate 3.1 at 16:9. Re-compose 3.2 at 9:16 (do not crop 3.1; the arches must still frame a calm centre). If you produced the chamber shell (1.3), rendering it from the game camera is the most consistent route.
- **3.3 launch sculpture:** *"Two identical blank portrait tiles, matte charcoal blackened metal with soft bevels, floating and angled slightly toward each other, a faint thin ivory orbit line arcing between them, soft crimson rim light on the left tile, transparent background, no text, minimal, premium."*
- **3.4 OG image:** the launch-sculpture art on `#0F0F0F`, plus the LAST WORD wordmark set in Cormorant Garamond bold italic (this is the one place text may be baked in, because it is a share card, not UI). Leave 60 px safe margins.

---

## 4. Particles and shaders

| Effect | How it's built | Asset inputs |
|---|---|---|
| Semantic bridge between close contenders (§17.4) | Bounded instanced points in code (Full ≤ 24, Standard ≤ 8, Lite/reduced none) | `spark.webp`, `soft-glow.webp` |
| Evidence ripple on every new beat, the same for stay and flip (§17.5) | Shader ring in code | none |
| Selection halo / magnetic pull | Sprite + rim emissive | `soft-glow.webp`, `tile_rim` node |
| Reject dissolve after judgment (§18.1) | Shader using a mask | `fracture-mask.webp` |
| Mastery bloom (§18.1 settle) | Short particle burst + gold rim | `spark.webp` |
| Grain | CSS overlay + shader detail | `noise-grain.webp` |

You don't need to produce any shader files. If you want to tune a look, change the textures.

---

## 5. Sound effects

All files: `public/last-word/assets/audio/sfx/<name>.mp3` (optional `.webm` twin with the same name). Mono, 44.1/48 kHz. Durations are enforced by the validator.

| # | File | Duration | Budget | Priority | Moment (§20.1) | If missing |
|---|---|---|---|---|---|---|
| 5.1 | `arrival.mp3` | 250–500 ms | 40 KB | **must** | New context beat arrives. **Must sound identical for stay and flip.** | Synthesized cue |
| 5.2 | `select.mp3` | 50–140 ms | 20 KB | **must** | Word chosen | Synthesized cue |
| 5.3 | `switch.mp3` | 100–240 ms | 25 KB | **must** | Choice changed | Synthesized cue |
| 5.4 | `lock.mp3` | 140–320 ms | 30 KB | **must** | Beat locked / Last Word committed | Synthesized cue |
| 5.5 | `best.mp3` | 280–650 ms | 45 KB | **must** | Best answer | Synthesized cue |
| 5.6 | `defensible.mp3` | 280–650 ms | 45 KB | **must** | Defensible, less precise answer | Synthesized cue |
| 5.7 | `incorrect.mp3` | 220–550 ms | 40 KB | **must** | Incorrect answer, never a buzzer | Synthesized cue |
| 5.8 | `mastery.mp3` | 700–1400 ms | 80 KB | **must** | A distinction's status rises | Synthesized cue |
| 5.9 | `hold.mp3` | 300–650 ms | 45 KB | nice | Hold Your Ground bonus | Uses `best` |
| 5.10 | `perfect-read.mp3` | 600–1300 ms | 70 KB | nice | Perfect Read (every beat right) | Uses `best` |
| 5.11 | `review-due.mp3` | 200–550 ms | 35 KB | nice | Reviews due, on the launch screen | Synthesized cue |
| 5.12 | `hint.mp3` | 120–320 ms | 25 KB | nice | A hint level opens | Synthesized cue |
| 5.13 | `ui-tap.mp3` | 30–110 ms | 15 KB | nice | Menus and settings | Synthesized cue |
| 5.14 | `reveal.mp3` | 400–900 ms | 55 KB | nice | Recap / mastery map opens | Synthesized cue |

**Shared sound palette:** one family. Felt-piano and muted-mallet tones, soft glass, low wood knocks, airy pads, gentle granular shimmer. Key centre D (Dorian works well: resolved but unsentimental). Every cue is short and dry, with a tiny bit of room.

**Prompts (ElevenLabs Sound Effects, Stable Audio or similar):**

- **arrival:** *"A soft dimensional whoosh-tick, like a sheet of thin glass sliding into place in a quiet room, airy, 0.35 seconds, mono, no reverb tail, subtle and premium."*
- **select:** *"A low, soft magnetic click, felt-covered wooden key pressed gently, very short 0.08 seconds, dry, mono."*
- **switch:** *"A fast soft sliding tone, a muted mallet glissando of two notes moving sideways, 0.18 seconds, mono, gentle."*
- **lock:** *"A short resolved impact, a soft felt mallet on a low wooden block with a faint metallic seal click, 0.22 seconds, mono, satisfying, not loud."*
- **best:** *"A clear gentle tonal resolution, two felt-piano notes rising a fifth and settling on D, warm, 0.45 seconds, mono, understated."*
- **defensible:** *"An unresolved partial cadence, two soft felt-piano notes that stop on a suspended interval, curious not negative, 0.45 seconds, mono."*
- **incorrect:** *"A dampened soft displacement, a muted low wooden knock with a short downward breath of air, informative and kind, not a buzzer, 0.35 seconds, mono."*
- **mastery:** *"A wider harmonic bloom, a soft felt-piano chord in D Dorian opening with a faint airy glass shimmer, 1.1 seconds, mono, warm, restrained celebration."*
- **hold:** *"A steady grounded tone, a single low felt note with a soft sustained warmth, quietly confident, 0.45 seconds, mono."*
- **perfect-read:** *"A clean ascending three-note felt-piano line resolving on D with a faint glass sparkle, 0.9 seconds, mono, elegant, not a fanfare."*
- **review-due:** *"An understated notification cue, one soft glass tone with a gentle echo, 0.35 seconds, mono, calm."*
- **hint:** *"A soft paper-page turn with a tiny bright tone, 0.2 seconds, mono, gentle."*
- **ui-tap:** *"A very short, soft, neutral tap, felt on wood, 0.05 seconds, mono."*
- **reveal:** *"A soft rising airy pad swell into a single warm felt note, 0.7 seconds, mono, calm."*

## 6. Music

| # | File | Spec | Budget | Priority | Purpose | If missing |
|---|---|---|---|---|---|---|
| 6.1 | `audio/music/chamber-ambience.mp3` | Stereo, 128 kbps, **45–95 s, seamless loop** | 1.7 MB | nice | Optional bed under play. Off by default, separate Music toggle, ducks during feedback | Silence |
| 6.2 | `audio/music/map-ambience.mp3` | Stereo, 128 kbps, **30–75 s, seamless loop** | 1.2 MB | nice | Quieter bed for the mastery map and recap | Silence |

**Prompts:**

- **6.1:** *"Minimal ambient loop for focused reading inside a dark, quiet architectural space. Slow evolving airy pads in D Dorian, distant soft felt-piano notes every few bars, very subtle granular glass shimmer, no drums, no melody hooks, no build-ups, steady low intensity, 70 seconds, seamless loop."*
- **6.2:** *"Even calmer ambient loop, sparse warm pads and occasional soft glass tones, a sense of stars and connection, no rhythm, 50 seconds, seamless loop."*

---

## 7. Haptic patterns

Defaults are built in, so this file is optional. Supply it only to tune the feel.

| | |
|---|---|
| **File** | `public/last-word/assets/haptics/patterns.json` |
| **Format** | JSON object keyed by event. `web` = vibration ms or an array of ≤ 9 values (0–400 ms). `native` = the Android app's Capacitor style: `light`, `medium`, `heavy`, `success`, `warning`, `error` or `none` |
| **Events** | `select`, `switch`, `lock`, `best`, `defensible`, `incorrect`, `hold`, `mastery`, `arrival`, `hint` |
| **Rule** | Haptics are independently switchable (§20.2). Patterns must be short; nothing longer than 400 ms |

Built-in defaults (copy and edit):

```json
{
  "select":     { "web": 6,              "native": "light" },
  "switch":     { "web": [6, 12, 6],     "native": "light" },
  "lock":       { "web": 18,             "native": "medium" },
  "arrival":    { "web": 4,              "native": "light" },
  "best":       { "web": [12, 40, 12],   "native": "success" },
  "defensible": { "web": [10, 50, 6],    "native": "light" },
  "incorrect":  { "web": [24, 60, 16],   "native": "warning" },
  "hold":       { "web": [18, 30, 18],   "native": "success" },
  "mastery":    { "web": [20, 50, 20, 50, 60], "native": "success" },
  "hint":       { "web": 5,              "native": "light" }
}
```

---

## 8. Icons

All files: `public/last-word/assets/icons/<name>.svg`. **24 × 24 viewBox**, 1.5 px strokes, rounded caps and joins, **`currentColor` only** (the game colours them), no `<text>`, no embedded images, no scripts. They must be readable at 20 px. Match the LexiCore icon family. If you have produced LexiCore's custom navigation icons, use the same line language. Each icon falls back to its Lucide equivalent, so all are `nice-to-have`.

| File | Meaning | Lucide fallback |
|---|---|---|
| `hint.svg` | Hint (an opening lantern/eye) | Lightbulb |
| `lock.svg` | Locked decision | Lock |
| `switch.svg` | Switched judgment | ArrowLeftRight |
| `hold.svg` | Held your ground | Anchor |
| `perfect-read.svg` | Perfect Read | Sparkles |
| `review.svg` | Review due | RotateCcw |
| `mastery-map.svg` | Mastery Map (linked nodes) | Network |
| `quick-run.svg` | Quick Run | Zap |
| `continue.svg` | Continue path | Play |
| `status-new.svg` | NEW (hollow node) | CSS glyph |
| `status-getting-it.svg` | GETTING IT (half node) | CSS glyph |
| `status-reliable.svg` | RELIABLE (node + one edge) | CSS glyph |
| `status-fluent.svg` | FLUENT (node + two edges) | CSS glyph |
| `status-mastered.svg` | MASTERED (closed, settled ring) | CSS glyph |
| `status-review-due.svg` | REVIEW DUE (node with a small pulse arc) | CSS glyph |
| `last-word-wordmark.svg` | LAST WORD wordmark (may use fixed colours, outlined lettering, ≤ 12 KB) | Live text |

**Icon prompt (vector/AI icon tools):** *"A set of 24px line icons, 1.5px stroke, rounded caps, single colour, minimal and precise, scholarly and quiet, matching a dark editorial vocabulary app; motifs of nodes, edges, seals and pages; no fills except tiny dots, no text."* Then clean each in a vector editor: outline strokes only if you need to, and set every colour to `currentColor`.

The status icons carry meaning in **shape**, not colour (§41: no meaning by colour alone). The game also prints the status word next to them.

---

## 9. Fonts

**Nothing to produce.** Last Word uses LexiCore's two families, already self-hosted by the site at build time: **Cormorant Garamond** for words, verdicts and titles, and **Sora** for interface text. All game text is live DOM, so no 3D/MSDF font atlas is needed. The only place lettering is drawn as art is the optional wordmark (8) and the share card (3.4).

---

## 10. How to deliver

1. Save files to the exact paths above (create the folders under `public/last-word/assets/` if needed).
2. Run `npm run last-word:validate-assets`. Each line shows `✓` (accepted), `·` (still using the placeholder) or `✗` (rejected, with the reason: wrong size, too many triangles, missing node name, wrong duration, compression used, and so on).
3. Fix anything marked `✗`, then run `npm run last-word:validate-assets -- --write` and reload `/last-word`. In production, the build does this step for you.
4. `npm run last-word:validate-assets -- --strict` fails while any must-have is still a placeholder, for a pre-launch gate.
5. Commit the assets. Do not commit `available.json`; it is generated.

---

## 11. Checklist

### Must-have (12)
- [x] `models/word-tile.full.glb`
- [x] `models/word-tile.standard.glb`
- [x] `images/chamber-backdrop.landscape.webp`
- [x] `images/chamber-backdrop.portrait.webp`
- [x] `audio/sfx/arrival.mp3`
- [x] `audio/sfx/select.mp3`
- [x] `audio/sfx/switch.mp3`
- [x] `audio/sfx/lock.mp3`
- [x] `audio/sfx/best.mp3`
- [x] `audio/sfx/defensible.mp3`
- [x] `audio/sfx/incorrect.mp3`
- [x] `audio/sfx/mastery.mp3`

### Nice-to-have — 3D and visuals (17)
- [x] `models/fulcrum.glb` *(signature)*
- [x] `models/evidence-pane.glb` *(signature)*
- [x] `models/chamber-shell.full.glb`
- [x] `models/chamber-shell.standard.glb`
- [x] `models/lock-ring.glb`
- [x] `models/mastery-node.glb`
- [x] `textures/chamber-env.hdr`
- [x] `textures/noise-grain.webp`
- [x] `textures/soft-glow.webp`
- [x] `textures/spark.webp`
- [x] `textures/fracture-mask.webp`
- [x] `textures/tile-surface.lite.webp`
- [x] `textures/star-dust.webp`
- [x] `images/launch-sculpture.webp`
- [x] `images/og-last-word.png`
- [x] `icons/last-word-wordmark.svg`
- [x] `haptics/patterns.json` (only to tune the defaults)

### Nice-to-have — audio (8)
- [x] `audio/sfx/hold.mp3`
- [x] `audio/sfx/perfect-read.mp3`
- [x] `audio/sfx/review-due.mp3`
- [x] `audio/sfx/hint.mp3`
- [x] `audio/sfx/ui-tap.mp3`
- [x] `audio/sfx/reveal.mp3`
- [x] `audio/music/chamber-ambience.mp3`
- [x] `audio/music/map-ambience.mp3`

### Nice-to-have — icons (15)
- [x] `icons/hint.svg`
- [x] `icons/lock.svg`
- [x] `icons/switch.svg`
- [x] `icons/hold.svg`
- [x] `icons/perfect-read.svg`
- [x] `icons/review.svg`
- [x] `icons/mastery-map.svg`
- [x] `icons/quick-run.svg`
- [x] `icons/continue.svg`
- [x] `icons/status-new.svg`
- [x] `icons/status-getting-it.svg`
- [x] `icons/status-reliable.svg`
- [x] `icons/status-fluent.svg`
- [x] `icons/status-mastered.svg`
- [x] `icons/status-review-due.svg`

Optional `.webm` (Opus) twins of any audio file are welcome and are validated when present.

**Suggested order:** word tiles (1.1, 1.2) and the eight must-have sound effects first. They define how the game *feels*. Then the backdrops (3.1, 3.2). Then the signature pieces, which carry the premium identity: the Fulcrum (1.7), the Evidence pane (1.8) and the lock ring (1.5). Then everything else.
