# Continuation — LexiCore UI Rebuild Session
# Read this file at the start of the next session to resume exactly where we left off.

---

## STATUS: ✅ ALL 5 COMPONENTS COMPLETE — TypeScript clean (npx tsc --noEmit = 0 errors)

## SESSION GOAL
Rebuild the 5 subpar LexiCore vocab app components to "best of the best" quality.
Using: frontend-design skill + ui-ux-pro-max skill + magic-ui skill + 21st.dev MCP tools.
User said: "don't rebuild all, only rebuild the ones that are subpar."

---

## DESIGN SYSTEM (LexiCore)
- **Style**: Modern Dark Cinema Mobile
- **Base bg**: `#0F0F0F` (`--color-lx-base`)
- **Surface**: `#1A1A1A`, Elevated: `#242424`, Border: `#2A2A2A`
- **Accent Red**: `#E63946` (`--color-lx-accent-red`)
- **Accent Gold**: `#F4A828` (`--color-lx-accent-gold`)
- **Text**: Primary `#F5F5F5`, Secondary `#9A9A9A`, Muted `#555555`
- **Success**: `#2ECC71`, Warning: `#F39C12`, Danger: `#E63946`
- **Fonts**: `Cormorant Garamond` (italic serif, for headings/words) + `Sora` (sans, for UI)
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) for all transitions
- **Spring**: `type: 'spring', stiffness: 340, damping: 28` for card entries
- **Glow classes** (defined in globals.css):
  - `.lx-glow-red`    → `box-shadow: 0 0 16px rgba(230,57,70,0.4)`
  - `.lx-glow-gold`   → `box-shadow: 0 0 14px rgba(244,168,40,0.45)`
  - `.lx-glow-silver` → `box-shadow: 0 0 12px rgba(168,168,168,0.35)`
  - `.lx-glow-bronze` → `box-shadow: 0 0 12px rgba(205,127,50,0.35)`
  - `.lx-glow-success`→ `box-shadow: 0 0 12px rgba(46,204,113,0.35)`
- **CSS classes** (globals.css): `.preserve-3d`, `.backface-hidden` — both work fine
- **No emoji as icons** — use Lucide icons only
- **Gradient CTA**: `linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)`
- Ambient blobs: `radial-gradient(circle, rgba(230,57,70,0.18) 0%, transparent 70%)` + motion drift

---

## PROGRESS STATUS

### ✅ DONE — Already rebuilt this session:

**1. `src/app/vocab/onboarding/steps/StepWelcome.tsx`** ✅ REBUILT
- Cinematic dark welcome screen
- Animated SVG "Lx" path-draw logo (L in red, x in gold, pathLength animation)
- 3 ambient blobs (red drift + gold pulse)
- Glow halo behind logo icon
- Cormorant Garamond italic headline: "Welcome, {firstName}."
- Sora body copy about 800+ words / IBA BUP DU
- Pulsing glow backdrop div behind CTA button
- `lx-glow-red` on button
- Grain overlay (SVG fractalNoise, opacity 0.015)
- Easing: `[0.16, 1, 0.3, 1]` throughout, staggered delays

**2. `src/app/vocab/onboarding/steps/StepTutorial.tsx`** ✅ REBUILT
- Replaced emoji `🔥` with `<Flame>` Lucide icon + red glow ring + animated backdrop
- Replaced emoji tab labels `🏃` / `🏛` (these were in Leaderboard, not Tutorial — see note)
- Cormorant Garamond italic section header "Your learning journey"
- Slide icon badges (BookOpen / Sparkles / Flame) with `rgba(230,57,70,0.12)` bg
- FlipCardDemo: gradient front/back, Cormorant italic word, proper 3D flip using `.preserve-3d` / `.backface-hidden` classes
- QuizDemo: Cormorant italic question text, same green/red feedback logic
- StreakDemo: Flame icon in glowing rounded container, Cormorant "7" numeral, no emoji
- Better demo area: `h-52`, gradient bg, `rounded-2xl`
- Gradient CTA button with `lx-glow-red`

---

### ❌ NOT YET DONE — Must rebuild in next session:

**3. `src/components/vocab/ProgressRing.tsx`** ❌ PENDING
- **Current problem**: flat solid red stroke, no gradient, no glow, just shows `{percentage}%` with no label
- **What to build**:
  - SVG `<defs>` with `<linearGradient>` (id: `lx-ring-gradient`) from `--color-lx-accent-red` to `--color-lx-accent-gold`
  - SVG `<filter>` with `feGaussianBlur` for glow effect on the arc
  - `stroke="url(#lx-ring-gradient)"` on the fill circle
  - Add optional `label?: string` prop — shown below percentage in small Sora text
  - Keep existing Props (`percentage`, `size`, `strokeWidth`) — just add optional `label`
  - Track: remains `--color-lx-elevated`
  - Keep existing `useEffect`-based offset animation (it's fine)
  - Center text: `{percentage}%` in Cormorant Garamond bold, label in Sora muted text below
  - File is small (60 lines) — full rewrite

**4. `src/app/vocab/(shell)/study/StudyScreen.tsx`** ❌ PENDING
- **Current problem**: flat accordion cards, no visual depth, text-only unit progress, no ambient
- **What to build**:
  - Add header gradient strip: `linear-gradient(180deg, rgba(230,57,70,0.06) 0%, transparent 60%)` behind h1
  - Unit accordion header: add a thin progress bar strip (`h-1`) below the title/subtitle row
    - Track: `rgba(255,255,255,0.06)`, fill: `linear-gradient(90deg, var(--color-lx-accent-red), var(--color-lx-accent-gold))`
    - Animate width from 0 to `{unit.completePct}%` with 0.8s ease
  - Unit card bg: `linear-gradient(135deg, var(--color-lx-surface) 0%, rgba(26,26,26,0.8) 100%)` instead of flat surface
  - Theme cards: add left border accent for resume card instead of full border
    - Resume: `borderLeft: '3px solid var(--color-lx-accent-red)'`, `borderRadius: '0 12px 12px 0'`
  - Status chips: keep existing STATUS_CONFIG but remove border (border+bg+color is too cluttered), just bg + color
  - Add a small "phase badge" if unit is Phase 2: subtle `rgba(244,168,40,0.08)` tint + lock icon in unit header
  - Imports: keep all existing (`ChevronDown`, `Lock`, `CheckCircle`, `Clock`, `BookOpen`, `Circle`)

**5. `src/app/vocab/(shell)/leaderboard/LeaderboardScreen.tsx`** ❌ PENDING
- **Current problem**: tab buttons use emoji (`🏃 This Week`, `🏛 Hall of Fame`), top-3 rank badges are small plain circles, no cinematic feel
- **What to build**:
  - Remove emoji from tab labels → use `Timer` + `Trophy` Lucide icons instead, or just text: "This Week" / "Hall of Fame"
  - Top-3 rank treatment: make `RankBadge` for rank 1/2/3 bigger (`h-10 w-10`) with glow class:
    - Rank 1: `.lx-glow-gold` + gold Crown icon (size 16)
    - Rank 2: `.lx-glow-silver` + silver Medal icon
    - Rank 3: `.lx-glow-bronze` + bronze Medal icon
  - Top-3 list entries: gradient bg
    - Rank 1: `linear-gradient(135deg, rgba(244,168,40,0.15) 0%, rgba(244,168,40,0.04) 100%)`
    - Rank 2: `linear-gradient(135deg, rgba(192,192,192,0.12) 0%, rgba(192,192,192,0.03) 100%)`
    - Rank 3: `linear-gradient(135deg, rgba(205,127,50,0.10) 0%, rgba(205,127,50,0.02) 100%)`
  - Add ambient red blob behind header (subtle, `pointer-events-none absolute`)
  - Keep all existing data types (`LeaderboardData`) and logic unchanged

---

## KEY FILE PATHS
```
src/app/vocab/onboarding/steps/StepWelcome.tsx   ← ✅ done
src/app/vocab/onboarding/steps/StepTutorial.tsx  ← ✅ done
src/components/vocab/ProgressRing.tsx            ← ❌ next
src/app/vocab/(shell)/study/StudyScreen.tsx      ← ❌ next
src/app/vocab/(shell)/leaderboard/LeaderboardScreen.tsx  ← ❌ next
```

---

## IMPORTANT TECHNICAL NOTES

1. **Framer Motion types**: Always use `type Variants` import. Inside `transition` objects, use `type: 'spring' as const` (not just `type: 'spring'`).
2. **`.preserve-3d` and `.backface-hidden`** — defined in globals.css line 203-204, work as Tailwind classes.
3. **No `type: any`** — strict TypeScript, use proper types everywhere.
4. **No emoji as icons** — user confirmed this as a design violation. Always use Lucide.
5. **Fonts in inline styles** — always specify `fontFamily: "'Cormorant Garamond', Georgia, serif"` or `"'Sora', sans-serif"` via inline style, not Tailwind classes.
6. **Dev server**: `npm run dev` on port 6960.
7. **Typecheck after changes**: `npx tsc --noEmit`

---

## COMPONENTS ASSESSED AS GOOD (DO NOT TOUCH)
- `src/components/vocab/BottomNav.tsx` ✅
- `src/app/vocab/(shell)/home/HomeScreen.tsx` ✅
- `src/app/vocab/(shell)/study/[themeId]/FlashcardScreen.tsx` ✅
- `src/app/vocab/(shell)/profile/ProfileScreen.tsx` ✅
- `src/app/vocab/onboarding/steps/StepDeadline.tsx` ✅

---

## HOW TO RESUME NEXT SESSION

1. Read this file (`continuation.md`)
2. Read `vocab game/CLAUDE.md` for project rules
3. Start with `ProgressRing.tsx` (smallest, ~60 lines, easy win)
4. Then `StudyScreen.tsx`
5. Then `LeaderboardScreen.tsx`
6. Run `npx tsc --noEmit` after all 3 are done to verify no type errors
7. Delete or archive this file when all 5 are confirmed complete
