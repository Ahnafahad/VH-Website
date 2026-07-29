# LexiCore — Replica Design Specification

This document describes the current LexiCore vocabulary product closely enough to recreate its interface, behavior, and visual character in another codebase. It covers the authenticated web/PWA/Android experience at `/vocab`, not the surrounding VH marketing site or the LexiCore admin panels.

The implementation in `src/app/vocab`, `src/components/vocab`, and the LexiCore section of `src/app/globals.css` remains the final source of truth if this document and the product ever diverge.

## 1. Product definition

LexiCore is a focused English-vocabulary learning app for admission preparation and general learning. It turns a library of roughly 900 words into short learning sessions using flashcards, active-recall quizzes, spaced repetition, targeted practice, daily games, streaks, points, badges, and rankings.

Its central promise is not merely to expose the learner to words, but to make those words durable. The app therefore emphasizes a single recommended next action, short resumable sessions, immediate explanatory feedback, and visible movement through five mastery states.

The core loop is:

1. Learn a small set of words from a theme or letter.
2. Reveal each card and rate recall honestly.
3. Complete an active-recall quiz.
4. Revisit due or weak words through spaced repetition.
5. Earn points, maintain a streak, fill mastery progress, and compete on the leaderboard.

The product is authenticated. A new user is sent through onboarding; a returning user enters the Home screen. It works as a responsive website, an installable PWA, and a Capacitor-based Android app.

## 2. Experience principles

- **Editorial, not childish.** LexiCore feels like a premium dark reading instrument, not a colorful classroom game.
- **Action first.** Home always gives one clear next action with a reason, duration, and expected outcome.
- **Words are the heroes.** Vocabulary terms, definitions, milestone messages, and large numbers use an expressive serif face. Interface mechanics stay in a restrained sans serif.
- **Crimson means action.** Red identifies the current route, the primary CTA, focus, urgency, and incorrect answers. It should not wash entire screens.
- **Gold means value earned.** Gold is used for points, rewards, important progress, podium positions, and dossier details—not ordinary navigation.
- **Feedback is immediate.** Taps compress, cards flip, answers change state, progress advances, and successful milestones may add sound, haptics, glow, or confetti.
- **Mobile is the primary composition.** The 430 px mobile canvas is deliberate, with a fixed bottom navigation and safe-area handling. Desktop expands the content; it is not a giant phone mockup.

## 3. Brand identity

### Name and mark

The product name is **LexiCore**. Render it in Cormorant Garamond, bold italic, with tight tracking. The descriptor is **Vocabulary Engine**, rendered in tiny uppercase Sora with wide tracking.

The approved product mark is `public/lexicore-logo.png`: a standalone stylized **L**. On dark surfaces it is normally shown around 36–96 px with a soft crimson radial halo and a restrained red drop shadow. Do not redraw, recolor, outline, or place the mark inside a new container.

### Personality

LexiCore is precise, calm, intelligent, quietly competitive, and slightly mysterious. Its daily-message feature is framed as a dossier from “L,” which adds personality without turning the whole product into a character-driven game.

### Voice

Copy is short, specific, and encouraging:

- Prefer “8 words are due. Review them now to protect your streak.”
- Avoid generic enthusiasm such as “Awesome job!!!”
- Explain what changed after an action.
- Never blame the learner in errors or wrong-answer feedback.
- Use restrained labels such as “Today’s goal,” “SRS Review,” “First recall complete,” and “Past rounds.”

## 4. Design tokens

Use semantic variables throughout. Do not hard-code near-duplicate colors into new components.

### Dark theme — default

| Role | Token | Value | Use |
|---|---|---:|---|
| App base | `--color-lx-base` | `#0F0F0F` | Page and sidebar background |
| Surface | `--color-lx-surface` | `#1A1A1A` | Cards, sheets, active nav |
| Elevated | `--color-lx-elevated` | `#242424` | Inputs, segmented controls, icon wells |
| Border | `--color-lx-border` | `#363636` | Hairlines and card outlines |
| Primary text | `--color-lx-text-primary` | `#F5F5F5` | Headings and important values |
| Secondary text | `--color-lx-text-secondary` | `#B0B0B0` | Body and supporting copy |
| Muted text | `--color-lx-text-muted` | `#858585` | Eyebrows, metadata, inactive nav |
| Placeholder | `--color-lx-text-placeholder` | `#7A7A7A` | Form placeholders |
| Disabled | `--color-lx-text-disabled` | `#737373` | Unavailable UI |
| Crimson | `--color-lx-accent-red` | `#E63946` | Primary actions and active state |
| Gold | `--color-lx-accent-gold` | `#F4A828` | Points, value, milestones |
| Silver | `--color-lx-accent-silver` | `#A8A8A8` | Rank/achievement accent |
| Bronze | `--color-lx-accent-bronze` | `#CD7F32` | Third-place accent |
| Success | `--color-lx-success` | `#2ECC71` | Correct/mastered |
| Warning | `--color-lx-warning` | `#F39C12` | Caution/offline |
| Danger | `--color-lx-danger` | `#E63946` | Wrong/destructive |
| Learning | `--color-lx-mastery-learning` | `#F97316` | Early mastery |
| Familiar | `--color-lx-mastery-familiar` | `#5BA3F5` | Mid mastery/study |
| Strong | `--color-lx-mastery-strong` | `#2DD4BF` | High mastery |

Dark cards often add a 4–10% tinted background and a 18–30% tinted border instead of a fully saturated fill. Examples: success cards use `rgba(46,204,113,.08)` with a roughly `.2` green border; gold cards use `rgba(244,168,40,.08)` with a roughly `.25` gold border.

### Light theme

Light mode is a true token swap, not color inversion.

| Role | Value |
|---|---:|
| Base / surface / elevated | `#F7F7F8` / `#FFFFFF` / `#EFEFEF` |
| Border | `#E0E0E0` |
| Primary / secondary / muted text | `#111111` / `#555555` / `#666666` |
| Crimson / gold | `#D62B38` / `#D4920A` |
| Success / warning | `#1EA85A` / `#D4840A` |
| Learning / familiar / strong | `#EA6A0A` / `#2563EB` / `#0D9488` |

In light mode, shadows should be softer and borders should do more of the separation work. Never retain hard-coded white text except on saturated CTA buttons.

### Mastery mapping

The fixed sequence is:

`New (muted gray) → Learning (orange) → Familiar (blue) → Strong (teal) → Mastered (green)`

Use this mapping in progress charts, badges, word rows, and card labels.

## 5. Typography

LexiCore uses only two primary type families:

- **Sora** (`400, 500, 600, 700`) for navigation, labels, controls, body copy, metadata, forms, and explanations.
- **Cormorant Garamond** (`400, 600, 700`, normal and italic) for vocabulary words, definitions, names, large values, product wordmark, major headings, and achievement moments.

Fallbacks are `system-ui, sans-serif` and `Georgia, serif` respectively.

### Working type scale

| Element | Typical specification |
|---|---|
| Screen eyebrow | Sora 9.5–12 px, 600, uppercase, `0.14–0.16em` tracking |
| Body | Sora 13–15 px, 400–500, `1.5–1.6` line height |
| Metadata | Sora 10–12 px, muted, often uppercase |
| Button | Sora 14–16 px, 600–650 |
| Screen title | Cormorant 30–44 px, 700 italic, near `1.05` line height |
| Card word | Cormorant 32–45 px, 700, near `1.0` line height |
| Definition/example | Cormorant 15–18 px, `1.55–1.65`; examples often italic |
| Large metric | Cormorant 28–48 px, 700 |

Use tabular numerals where changing values would otherwise jump. Preserve generous line height in definitions. Avoid using the serif for long instructional paragraphs or button labels.

## 6. Global layout

### Mobile

- Viewport target: `360–430 px` wide, with 390 px as the main QA reference.
- The shell fills at least `100dvh` and handles top/bottom safe-area insets.
- Content is centered inside a maximum width of `430 px`.
- Standard horizontal page padding is `20 px`; dense screens may use `16 px`.
- Typical top padding is `32–40 px`.
- Reserve `72 px + safe-area` below content for bottom navigation.
- Primary controls near the bottom must remain reachable one-handed.

### Tablet and desktop

- At `768 px`, hide the bottom nav and reveal a fixed `220 px` sidebar.
- Shift the main region right by `220 px`.
- Remove the 430 px cap; individual pages control their own useful widths.
- Standard desktop horizontal padding is `32 px`.
- Reading/task screens usually cap at `640–720 px` and center in the available area.
- Home can expand to approximately `940 px`, becoming a two-column grid: metrics/progress on the left and session actions in a roughly `300 px` rail on the right.

### Spacing and shape

Use a 4 px spacing foundation: `4, 8, 12, 16, 20, 24, 28, 32, 48, 64`.

- Small pills: `6–8 px` radius.
- Buttons/inputs: `10–16 px` radius.
- Standard cards: `14–16 px` radius.
- Hero/flashcards/sheets: `16–20 px` radius.
- Circles are reserved for avatars, progress rings, status icons, and compact icon controls.

Borders are normally 1 px. Use cards for distinct, actionable objects; use whitespace and dividers for ordinary grouping.

### Texture and atmosphere

The shell has a fixed monochrome fractal-noise texture at only `0.025` opacity, tiled at `128 px`. Important screens may add one restrained radial glow: crimson around the active/competitive region, gold around rewards, or blue around study. Ambient glows should fade to transparent and never reduce text contrast.

## 7. Navigation shell

### Mobile bottom navigation

The fixed navigation occupies a 64 px visual bar plus safe-area padding. Its background is translucent surface (`rgba(26,26,26,.85)`) with `20 px` backdrop blur and a faint top border.

Five destinations appear in this order:

1. Home — house icon
2. Study — open-book icon
3. Practice — lightning icon
4. Board — trophy icon
5. Games — gamepad icon

Each item has at least a 44 × 52 px target. Icons are 22 px. Inactive items are muted, slightly smaller, and use a lighter stroke. The active item is crimson with a soft glow, a 2 px luminous top bar, and a subtle radial “limelight” behind it. Labels are 10 px Sora with `0.04em` tracking.

Profile is intentionally not a sixth tab. Open it from the user name/avatar on Home or the user footer in the desktop sidebar.

### Desktop sidebar

The 220 px sidebar uses the base background and a right border. It contains:

- Header: 36 px L mark with crimson halo; “LexiCore” serif wordmark; tiny “Vocabulary Engine” descriptor.
- Navigation: the same five destinations in a vertical list. The active route uses a surface fill, a 3 px crimson left border, crimson icon glow, and primary text.
- “VH Website” back link separated by a top border.
- User footer with a 32 px circular image or serif initials; clicking opens Profile.

## 8. Shared components and states

### Buttons

- **Primary:** crimson fill, white Sora semibold, 48–52 px minimum height, 10–16 px radius, optional soft red shadow.
- **Secondary:** elevated fill, 1 px border, primary text.
- **Tonal:** 8–12% semantic tint with a 20–30% semantic border and matching text.
- **Text:** transparent with crimson or secondary text; still maintain a 44 px target.
- **Disabled:** no motion, disabled text color, visibly lower contrast, and no pointer behavior.

Tap feedback is usually `scale(.94–.98)`. Keyboard focus uses a 2 px crimson outline with 2 px offset. Do not remove focus indicators.

### Cards

Standard cards use surface, a 1 px border, and 14–20 px radius. Premium or recommended cards may add a faint semantic border, ambient glow, and one-time sheen. Card shadows stay broad and dark (`0 16px 44px rgba(0,0,0,.16–.38)`), never sharp.

### Segmented controls

Use an elevated rounded track with 4 px inner padding and a surface active pill. The pill moves with a spring. Every tab is at least 44 px tall.

### Progress

- Thin task bars are 3 px high with rounded ends and a semantic glow.
- The Home goal uses a 116 px circular progress ring with an 8 px stroke.
- Small status rings may frame avatars or icons.
- Progress animates to the new value but becomes instant when reduced motion is active.

### Sheets and dialogs

On mobile, configuration and detail views rise as rounded top-corner sheets from a darkened backdrop. On desktop they may center as dialogs. Include a drag handle when the sheet is draggable, an explicit close control, Escape/back dismissal, focus management, and safe-area bottom padding.

### Loading, empty, offline, and error states

- Skeletons match the geometry of incoming content and use a surface/elevated shimmer.
- Empty states use one icon or simple outlined illustration, a serif headline, one explanatory sentence, and one useful action.
- The connection banner is fixed near the top, up to 480 px wide, with a surface fill, warning border, concise status, and retry button.
- Full error states vertically center a 56 px semantic icon tile, a large serif title, short explanation, and primary/secondary recovery actions.

### Notifications and overlays

- **Daily brief:** compact surface card above the bottom nav; gold icon, “L” message excerpt in italic serif, Open label, and separate dismiss control.
- **Daily dossier:** full-screen narrative overlay the first time; afterwards it collapses to the compact brief.
- **Badge celebration:** high-priority overlay with badge art, earned-value colors, haptic/sound feedback, and optional confetti.
- **Update prompt:** centered surface modal on an 82% black backdrop, gold icon tile, large title, full-width primary action, and “Later” option when permitted.

## 9. Screen specifications

### 9.1 Authentication and route entry

`/vocab` requires a session. Unauthenticated users are redirected to sign-in with a callback to LexiCore. Authenticated first-time users go to onboarding; completed users go to Home.

The PWA metadata uses the LexiCore title, L icon, a `#0F0F0F` theme color, and black-translucent status bar treatment.

### 9.2 Onboarding

Onboarding is a standalone full-height flow without the normal navigation shell. A narrow centered panel is vertically balanced on the base background. At the top, four small progress segments and a label show:

`Welcome → Your goal → Your pace → First recall`

The four active screens are:

1. **Welcome.** Large glowing L mark, spaced uppercase product label, personalized serif greeting, short promise, and one full-width crimson CTA. Large blurred red/gold ambient circles sit behind the content.
2. **Goal.** Eyebrow “Make it yours,” serif question “What should your vocabulary help you do?”, then a vertical list of large outlined choice rows. Each row has a tonal icon well, title/description, and arrow.
3. **Pace/deadline.** A date choice and derived words-per-day pace. Present the recommended choice prominently, allow a date input, summarize the calculated pace in a surface card, then continue with a full-width CTA.
4. **Learning sprint and recall.** Teach three real words one at a time. The starter card first shows the word; tapping reveals its definition/example. A separate speaker control plays pronunciation. After word three, show a definition and three word options. Correct selection turns success green and leads to “You remembered [word].” Wrong selection turns red, explains briefly, and allows retry.

Transitions slide/fade left between stages in roughly 220 ms. Onboarding must deliver a real successful recall before completion; a decorative feature tour is not part of this gate.

### 9.3 Home

Home is the product’s command center.

Top to bottom on mobile:

1. Tiny “VH Website” back link.
2. Large italic first name with circular profile icon.
3. Right-aligned Help icon and gold total-points value.
4. Hairline rule.
5. **Recommended next action** card: crimson eyebrow, duration with clock, serif task title, explanation, expected outcome separated by a rule, and a full-width crimson action button.
6. Daily message from L, initially shown as a compact dossier-style object.
7. Optional free-tier unlock banner or deadline banner.
8. Session/task area and progress metrics.

The recommendation priority is: interrupted quiz, due review, interrupted learning, prepared recall quiz, weak-word repair, then new learning. It must say why this action is recommended and approximately how long it will take.

The metrics region includes:

- A three-column strip for Streak, Due words, and This week’s points, separated by vertical rules.
- A goal card with a 116 px progress ring, daily target count, and mastery histogram.
- Session rows for available study/review work with colored dot or pulse, title, subtitle, and arrow.
- Weekly challenge/progress where applicable.

On desktop, recommendation and daily message stay prominent, while the lower content becomes a broad left metrics column and a 300 px right session column.

### 9.4 Study library

The Study screen is a catalog, not a dashboard. It has a small uppercase eyebrow, a large italic serif title, supporting counts, and a segmented switch between **By Unit** and **By Letter**. A review tab/entry may expose due SRS items.

**By Unit** uses accordion cards. Each unit header shows sequence/label, title, total or completed words, mastery/progress, and an expand chevron. Expanded units reveal theme cards. Theme cards show name, word count, completion state, a small progress indicator, and lock treatment when inaccessible. Paid-only content receives a visible lock/overlay and an upgrade path rather than silently failing.

**By Letter** uses a responsive grid of compact letter tiles. A tile contains a large serif letter, word count, and a slim progress indication. Mobile columns remain large enough for 44 px targets; desktop uses auto-fill rather than over-stretching tiles.

### 9.5 Theme flashcards

The learning session removes ordinary page clutter and centers a card workflow up to about 680 px wide.

- Header: back/close action, theme or session label, `current / total` count.
- Progress: thin study-blue or gold line.
- Card front: surface fill, 20 px radius, level/POS metadata, very large serif word, pronunciation control, and “tap to reveal” hint.
- Card back: definition, italic example sentence with a left rule, synonyms/antonyms or memory support where available.
- A subtle ambient glow and one-time diagonal light-catching sheen make the card feel tactile.

Tapping or pressing Space/Enter flips/reveals. After reveal, show three bottom actions: **Missed** in red, **Unsure** in gold, and a wider **Got it** in green. Each has an icon, tonal fill, semantic border, and at least a 44 px height.

The completion state centers a semantic circular icon, an italic success title, session statistics, a primary next action (usually Quiz), and a quieter path back to Study/Home. Celebration effects are reserved for this terminal state.

### 9.6 Review

Review visually resembles flashcards but is explicitly marked **SRS Review** and usually uses gold progress. It presents due words one at a time, reveals the definition, and records Missed/Unsure/Got it. The completion view reports reviewed, known, and missed counts. If nothing is due, show a green check icon, “All caught up,” a one-sentence explanation, and a back action.

### 9.7 Practice builder

Practice begins with a small eyebrow and a large italic title. A segmented switch chooses **By Unit** or **By Letter**.

- Unit mode shows a global Select all/Deselect all action, then expandable unit cards containing checkable theme rows.
- Letter mode shows selectable letter tiles in an auto-fill grid.
- Checked states use crimson outline/fill and an animated check.
- Partial unit selections show an indeterminate checkbox.
- An Exam Mode card can appear as a distinct high-stakes option with locked/unlocked treatment.

Once anything is selected, a floating CTA appears above the nav: **Start Practice**, followed by a live summary such as “3 themes selected · up to 20 questions.” It is crimson, wide, 16 px rounded, and has a right arrow.

### 9.8 Quiz

Quiz is a focused, single-question screen with no competing content.

- Top row: close control, session label, question number, and earned points.
- Thin timer/progress bar changes urgency as time runs down.
- Prompt: a serif word, definition, sentence, or question depending on type.
- Options: stacked surface cards, each with a small letter key and serif answer text.
- Keyboard shortcuts `1–4`/letter keys select options; Enter advances when appropriate.

Option states:

- Default: surface, border, primary text.
- Selected: stronger border/elevated fill.
- Correct: green tint/border, confirmation icon.
- Incorrect: red tint/border, close icon; also expose the correct option in green.

After answer confirmation, reveal a compact explanation/example panel and a crimson **Next question** action. Do not rely on color alone.

The summary shows a large circular score, italic pass/fail message, correct count, points earned, mastery changes, review of missed questions, and a clear continue/retry action. Loading uses rotating useful word hints rather than a blank spinner. Sessions are resumable for several hours after interruption.

### 9.9 Leaderboard

The screen begins with a faint crimson ambient glow, eyebrow **Rankings**, and italic title **Leaderboard**. A three-part segmented control switches between:

- Weekly
- All-Time
- Hall of Fame

Weekly and All-Time show a “my rank” banner, then a top-three podium and ranked rows. First place uses gold, second silver, third bronze. The current user’s row is visibly highlighted. Rows contain rank, avatar/initials, name, points, and optional current-user label. Clicking a person opens a public-profile sheet.

Hall of Fame groups winners by session/week. Its empty state uses a floating outlined gold star, “No champions yet.” and a restrained explanation.

### 9.10 Games hub

The Games screen uses eyebrow **Games** and title **Daily challenges**. It contains:

- A large daily **Word Hunt** hero card with current state, streak/reward information, and a strong play/resume action.
- A **Quick play** section with the Word Charge card.
- A **Past rounds** archive of compact dated rows with outcome/points and arrow.

Both game cards retain the core surface/border language but can use more gold, crimson glow, and energetic motion than study screens.

**Word Hunt** is a daily deduction game: show clue dossier/feed, attempt tracker, previous guesses, input/submit action, and a final reveal card. Maintain the “classified dossier” tone—small uppercase metadata, rules, monospaced-like alignment where useful, and gold evidence accents.

**Word Charge** is a quicker points game: intro, central charge card, timed/attempt feedback, explanation sheet, and result view. It uses lightning/energy motifs, gold charge, and crimson danger while keeping the same typography and surfaces.

### 9.11 Profile

Profile uses a two-tab layout: **Profile** and **Settings**, with a spring-animated indicator.

Profile tab:

- Large hexagonal/ornamental avatar or initials treatment.
- Name and identity metadata.
- Statistics including points, streak, best streak, mastered/seen words, quiz accuracy, and sessions.
- Word Progress with mastery-colored distribution.
- **Distinctions** badge gallery; locked badges are subdued, earned badges use premium metallic/semantic accents.
- **The Lexicon**, a searchable/filterable, virtualized list of learned words with mastery and detail access.

Settings tab:

- Study Deadline with large serif formatted date and a bottom-sheet date editor.
- Appearance: dark/light selection.
- Notifications and reminder controls.
- Sound Effects and haptic-related preferences.
- Accessibility: Reduce Motion and Larger Text toggles.
- Email/account information and external links.
- Danger Zone and Sign out, visually separated and confirmed before action.

Toggles are compact premium switches with semantic accent, visible knob travel, and disabled state. Setting rows use an icon, label, smaller descriptive sublabel, and right-side control.

### 9.12 Help and product tour

Help is accessible from Home. It explains how points, streaks, sessions, themes, letters, flashcards, review, quiz scoring, and mastery work. The non-blocking feature tour/demo lives here so users can revisit it without repeating onboarding. Use the same cards, serif demonstration words, and progress treatment as the actual product.

## 10. Motion, sound, and haptics

The motion language is springy but controlled:

- Tap compression: `100–150 ms` or spring equivalent.
- Content/state transition: `150–250 ms`.
- Sheet/modal entrance: up to `350 ms`.
- Common spring: stiffness around `320–440`, damping around `26–34`.
- Route content typically fades and moves `8–16 px` vertically.
- Tab pills and active navigation indicators use shared-layout spring motion.
- Flashcards use flip/reveal plus one compositor-driven sheen lasting about `900 ms`.

Routine navigation never waits for animation. Confetti, richer glow, and stronger sound/haptics are limited to earned badges, successful session completion, meaningful streaks, or game results.

Respect system `prefers-reduced-motion` and the in-app Reduce Motion toggle. In reduced mode, replace translation/flip/sweep with near-instant fades, stop infinite float/rotate effects, and never remove information.

Sound/haptic vocabulary includes tap, flip, correct/got-it, unsure, missed/wrong, and completion. Feedback preferences persist. The app first unlocks browser audio after a user gesture and uses native haptics where available.

## 11. Responsive behavior

| Width | Behavior |
|---|---|
| `< 360 px` | Preserve 16 px gutters, wrap metadata, keep all targets 44 px; never horizontally scroll the shell |
| `360–430 px` | Canonical mobile design; fixed five-item bottom nav |
| `431–767 px` | Content remains capped at 430 px and centered |
| `≥ 768 px` | 220 px sidebar, no bottom nav, page-specific wider content and 32 px gutters |
| `≥ 1024 px` | Home becomes two-column; catalog grids add columns; focused reading/task flows remain capped |

Do not simply scale font sizes with viewport width. The serif screen titles may use `clamp`, but body/control sizes stay stable. Sheets should become centered dialogs only when that improves use; flashcards and quiz content should not stretch across the entire desktop.

## 12. Accessibility requirements

- Meet WCAG 2.2 AA contrast in both themes.
- All interactive targets are at least 44 × 44 px.
- Maintain visible `:focus-visible` treatment.
- Support keyboard navigation and quiz shortcuts without trapping focus.
- Use real buttons/links and semantic heading order.
- Label icon-only controls and expose current page/tab with ARIA.
- Announce answer feedback, loading, connection, and completion changes appropriately.
- Do not encode mastery, correctness, or lock state by color alone; pair with text, icon, shape, or pattern.
- Preserve zoom. The 430 px canvas is a maximum width, not a fixed viewport.
- Safe areas must work on notched phones and the Android status/navigation bars.
- Larger Text increases interface text while layouts reflow rather than clipping.
- Reduced Motion applies to CSS and JavaScript-driven animation.

## 13. Data and behavior required for a convincing replica

A visual clone will feel incomplete unless it reproduces these state transitions:

- Authentication and first-run onboarding gate.
- Free versus paid word access and visible locked states.
- Theme/letter library progress.
- Five-stage word mastery.
- Flashcard exposure and self-rating.
- Active-recall quiz with timed questions, explanatory feedback, and persisted/resumable sessions.
- SRS due queue and next-due state.
- Daily/weekly points, current and longest streaks, and daily goal progress.
- Adaptive Home recommendation.
- Badges and achievement celebration.
- Weekly/all-time leaderboard and Hall of Fame.
- Daily Word Hunt plus archive; replayable Word Charge.
- Dark/light theme, sound, notification, reduced-motion, and larger-text preferences.
- Offline/degraded status, retry, skeleton, empty, and error states.

## 14. Suggested component inventory

Build the replica from these reusable pieces:

- `LexiShell`, `MobileBottomNav`, `DesktopSidebar`, `PageTransition`
- `ScreenHeader`, `Eyebrow`, `SerifTitle`, `Rule`
- `PrimaryButton`, `SecondaryButton`, `TonalButton`, `IconButton`
- `SurfaceCard`, `Metric`, `ProgressRing`, `ProgressBar`, `MasteryHistogram`
- `SegmentedControl`, `Toggle`, `SettingRow`
- `UnitAccordion`, `ThemeCard`, `LetterTile`, `LockedOverlay`
- `Flashcard`, `RatingButtons`, `QuizOption`, `TimerBar`, `AnswerExplanation`
- `RankBanner`, `Podium`, `LeaderboardRow`, `PublicProfileSheet`
- `GameHero`, `ArchiveRow`, `ClueDossier`, `AttemptTracker`, `ResultCard`
- `BottomSheet`, `Dialog`, `Toast`, `ConnectionBanner`, `Skeleton`, `ErrorState`
- `DailyBrief`, `DailyDossier`, `BadgeCelebration`, `UpdatePrompt`

## 15. Replica acceptance checklist

A high-fidelity replica should pass all of the following:

- The first impression is charcoal editorial luxury, not generic Tailwind dark mode.
- Sora handles the interface; Cormorant Garamond gives words and milestones their identity.
- Mobile content is comfortable at 390 × 844 and never hides behind the bottom nav.
- Desktop uses a fixed 220 px sidebar and genuinely wider layouts.
- Crimson is the consistent action/active color; gold is reserved for earned value.
- Home’s recommended action is visually dominant and includes reason, duration, and outcome.
- Flashcard, review, and quiz flows each have distinct but related progress and feedback states.
- Every major screen has loading, empty, error, and locked variants where relevant.
- Light mode is designed, not inverted.
- Tap, keyboard, reduced-motion, larger-text, and safe-area behavior all work.
- The UI remains usable with realistic long words, names, definitions, zero progress, very high point values, and weak/offline network conditions.
