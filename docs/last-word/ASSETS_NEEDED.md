# Last Word — assets needed

**Status:** spec ready for production. The game is built to run with **zero** of these files: every asset has a procedural or code-drawn placeholder. When you drop in a real file, it replaces the placeholder with **no code change**.

- **Source of truth:** [`src/features/last-word/assets/asset-manifest.json`](../../src/features/last-word/assets/asset-manifest.json). This document mirrors it. If they ever disagree, the manifest wins (the validator reads it).
- **Where files go:** `public/last-word/assets/<folder>/<filename>`, with the exact names below.
- **How to check:** `npm run last-word:validate-assets` (report) or `npm run last-word:validate-assets -- --write` (also publishes the list the game loads). The production build runs the `--write` step automatically, so a deploy picks up new files.
- **What the game does with a bad file:** the validator leaves it out of `available.json`, so the game keeps the placeholder. A bad asset can never break play.

---

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

**Prompts:**

- **2.1 env map:** *"Equirectangular HDR studio environment, nearly black room, one large soft ivory rectangular softbox high on the left, a narrow faint crimson strip light low on the right, smooth falloff, no objects, no floor texture."* Generate it, or render it in Blender from two area lights. Export 512×256 Radiance `.hdr`.
- **2.2 grain:** *"Seamless tileable fine film grain, monochrome mid-gray, even density, no visible pattern or seams, 256 px."* Verify by tiling 4×4.
- **2.3 soft glow:** *"Soft radial light falloff, white centre fading smoothly to fully transparent edge, no rings, no banding, transparent PNG/WebP 256 px."* The runtime tints it.
- **2.4 spark:** *"Tiny soft four-point light spark, white on transparent, very subtle, 64 px."*
- **2.5 fracture mask:** *"Grayscale crack-propagation mask for a dissolve shader: fine branching fracture lines radiating from the centre, values from black (first to dissolve) to white (last), no text, 512 px seamless edges not required."*
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
- [ ] `models/word-tile.full.glb`
- [ ] `models/word-tile.standard.glb`
- [ ] `images/chamber-backdrop.landscape.webp`
- [ ] `images/chamber-backdrop.portrait.webp`
- [ ] `audio/sfx/arrival.mp3`
- [ ] `audio/sfx/select.mp3`
- [ ] `audio/sfx/switch.mp3`
- [ ] `audio/sfx/lock.mp3`
- [ ] `audio/sfx/best.mp3`
- [ ] `audio/sfx/defensible.mp3`
- [ ] `audio/sfx/incorrect.mp3`
- [ ] `audio/sfx/mastery.mp3`

### Nice-to-have — 3D and visuals (14)
- [ ] `models/chamber-shell.full.glb`
- [ ] `models/chamber-shell.standard.glb`
- [ ] `models/lock-ring.glb`
- [ ] `models/mastery-node.glb`
- [ ] `textures/chamber-env.hdr`
- [ ] `textures/noise-grain.webp`
- [ ] `textures/soft-glow.webp`
- [ ] `textures/spark.webp`
- [ ] `textures/fracture-mask.webp`
- [ ] `textures/tile-surface.lite.webp`
- [ ] `images/launch-sculpture.webp`
- [ ] `images/og-last-word.png`
- [ ] `icons/last-word-wordmark.svg`
- [ ] `haptics/patterns.json` (only to tune the defaults)

### Nice-to-have — audio (8)
- [ ] `audio/sfx/hold.mp3`
- [ ] `audio/sfx/perfect-read.mp3`
- [ ] `audio/sfx/review-due.mp3`
- [ ] `audio/sfx/hint.mp3`
- [ ] `audio/sfx/ui-tap.mp3`
- [ ] `audio/sfx/reveal.mp3`
- [ ] `audio/music/chamber-ambience.mp3`
- [ ] `audio/music/map-ambience.mp3`

### Nice-to-have — icons (15)
- [ ] `icons/hint.svg`
- [ ] `icons/lock.svg`
- [ ] `icons/switch.svg`
- [ ] `icons/hold.svg`
- [ ] `icons/perfect-read.svg`
- [ ] `icons/review.svg`
- [ ] `icons/mastery-map.svg`
- [ ] `icons/quick-run.svg`
- [ ] `icons/continue.svg`
- [ ] `icons/status-new.svg`
- [ ] `icons/status-getting-it.svg`
- [ ] `icons/status-reliable.svg`
- [ ] `icons/status-fluent.svg`
- [ ] `icons/status-mastered.svg`
- [ ] `icons/status-review-due.svg`

Optional `.webm` (Opus) twins of any audio file are welcome and are validated when present.

**Suggested order:** word tiles (1.1, 1.2) and the eight must-have sound effects first. They define how the game *feels*. Then the backdrops (3.1, 3.2), then everything else.
