# UI_SPEC.md — LexiCore Vocabulary App
# Design Reference: Spotify (dark, minimal, content-first)
# Animations: Framer Motion throughout — mandatory

---

## 1. DESIGN SYSTEM

### Dark Mode (default)
| Token | Hex | Usage |
|---|---|---|
| bg-base | #0F0F0F | App background |
| bg-surface | #1A1A1A | Cards, bottom nav, sheets |
| bg-elevated | #242424 | Inputs, hover states |
| accent-red | #E63946 | CTAs, active states — use sparingly |
| accent-gold | #F4A828 | 1st place, achievements |
| accent-silver | #A8A8A8 | 2nd place |
| accent-bronze | #CD7F32 | 3rd place |
| text-primary | #F5F5F5 | Headings, main content |
| text-secondary | #9A9A9A | Subtitles, labels |
| text-muted | #555555 | Disabled, placeholders |
| success | #2ECC71 | Got it, correct, mastered |
| warning | #F39C12 | Unsure, review state |
| danger | #E63946 | Missed it, wrong answer |
| border-subtle | #2A2A2A | Card borders, dividers |

### Light Mode (toggled in Settings, stored in localStorage, applied as .light on <html>)
| Token | Hex |
|---|---|
| bg-base | #F7F7F8 |
| bg-surface | #FFFFFF |
| bg-elevated | #EFEFEF |
| accent-red | #D62B38 |
| accent-gold | #D4920A |
| accent-silver | #7A7A7A |
| accent-bronze | #A0622A |
| text-primary | #111111 |
| text-secondary | #555555 |
| text-muted | #AAAAAA |
| success | #1EA85A |
| warning | #D4840A |
| danger | #D62B38 |
| border-subtle | #E0E0E0 |

### Typography: Inter (Google Fonts, preloaded)
| Scale | Size | Weight | Usage |
|---|---|---|---|
| text-xs | 11px | Medium | Labels, metadata |
| text-sm | 13px | Regular | Secondary content |
| text-base | 15px | Regular | Body, options |
| text-lg | 18px | SemiBold | Card titles |
| text-xl | 22px | Bold | Screen headings |
| text-2xl | 28px | Bold | Flashcard word |
| text-3xl | 36px | Bold | Big stats, streak |

### Shape & Spacing
- Base unit: 4px. Card radius: 12px. Button radius: 10px. Chip radius: 20px.
- Page padding: 20px horizontal. Bottom nav: 64px + iOS safe area.

### Shadows & Glows
- card-shadow-dark: 0 4px 24px rgba(0,0,0,0.5)
- card-shadow-light: 0 2px 12px rgba(0,0,0,0.08)
- glow-red: 0 0 16px rgba(230,57,70,0.4)
- glow-gold: 0 0 14px rgba(244,168,40,0.45)
- glow-silver: 0 0 12px rgba(168,168,168,0.35)
- glow-bronze: 0 0 12px rgba(205,127,50,0.35)
- glow-success: 0 0 12px rgba(46,204,113,0.35)

### Animation Principles (Framer Motion — always use, never raw CSS for complex animations)
- Page enter: opacity 0->1, x 20->0, 300ms ease
- Page exit: opacity 1->0, x 0->-20, 200ms ease
- Card mount: opacity 0->1, scale 0.95->1, 200ms ease
- List stagger: children 50ms apart
- whileTap scale 0.97 on ALL tappable elements
- whileHover scale 1.02 on cards (desktop)
- Number counters: 0->value on first mount, 800ms ease-out
- Skeletons: pulse on all loading states

---

## 2. BOTTOM NAVIGATION BAR

Fixed bottom, bg-surface, 1px top border-subtle, 64px + safe area.
5 icons ONLY, no labels: Home (house) / Study (book) / Practice (lightning) / Leaderboard (trophy) / Profile (person).
Active: icon accent-red + 4px red dot below (fade-in).
Inactive: text-muted.
Dot transitions: slides horizontally (Framer Motion layoutId), 250ms spring.
Icon on activate: scale 1->1.2->1 pulse, 150ms.

---

## 3. SPLASH / WELCOME SCREEN

Pure bg-base. Framer Motion orchestrated sequence:
1. t=0ms: screen bg-base, everything hidden
2. t=200ms: VH logo fades in + slides y:20->0, opacity 0->1, 400ms ease
3. t=700ms: tagline fades in below logo. "Master 1000 words through smart flashcards, AI-powered quizzes, and daily practice." text-secondary text-sm centered, 300ms
4. t=1100ms: "Lets Get Started" button fades in + slides up, 300ms

Button style: full-width, accent-red bg, white text, text-lg, 10px radius, red glow.

---

## 4. REGISTRATION & LOGIN

bg-base background. VH logo 56px centered top, fade-in on mount.
Form card: bg-surface, 12px radius, 24px padding, card-mount animation on enter.
Fields: bg-elevated bg, border-subtle 1px border, 10px radius.
  On focus: border transitions to accent-red 150ms, label floats up (animated).
  On error: border -> danger, error message slides down from field 200ms.
CTA button: full-width accent-red, white text, red glow on hover/focus.
Terms/Privacy: accent-red underlined text links.
Verification pending: envelope icon bounces gently (Framer Motion keyframes loop). Heading + instructions + resend link accent-red.
Suspended screen: lock icon, danger-tinted card, support contact link.

---

## 5. ONBOARDING FLOW (runs once after first login)

Step 1 — Welcome:
Same as splash but inside app shell.

Step 2 — Set Deadline:
Title: "When do you want to be done?" text-xl Bold.
Default date: shown as accent-red pill, date picker opens on tap.
Live calc below: "~X words/day" — number animates on date change (Framer Motion animate).
"Confirm Deadline" accent-red full-width button.

Step 3 — Tutorial (3 swipeable screens):
Horizontal swipe with dot indicators. Active dot: accent-red. Inactive: text-muted. Dots have scale animation on active.
Screen 1: animated card flip demo — auto-plays on mount, loops every 3s.
Screen 2: sample fill-in-blank question fades in letter by letter.
Screen 3: streak counter counts 0->7 (Framer Motion animate), badge icon pulses with glow.
"Skip" top-right, text-secondary text-sm, always visible.

---

## 6. HOME SCREEN

All items card-mount animated with 50ms stagger from top.

Header row:
Left: "Good [morning/afternoon/evening], [Name]" text-lg SemiBold.
Right: points badge pill — bg-elevated, "star [points] pts" text-sm Medium. Number animates up when earned.

Stats row (two equal-width cards, gap 12px):
Streak card: fire emoji + streak number text-3xl Bold + "day streak" text-xs text-secondary below. If streak=0: "Start today!" text-sm text-secondary.
Due words card: number text-3xl Bold accent-red + "words due" text-xs text-secondary. Subtle pulse animation if >0. Full card is tappable -> Practice mode.

Progress ring (centered below stats row, 160px diameter):
SVG circular progress ring. stroke-dashoffset animates on mount, 800ms ease-out.
Track: bg-elevated, 10px stroke width.
Fill: accent-red, 10px stroke width, round linecap.
Center text: percentage text-2xl Bold. "of today's goal" text-xs text-secondary below.

Continue Studying card (full-width):
bg-surface card, 4px left border accent-red, red glow box-shadow.
Left: "Continue Studying" text-lg SemiBold + last study position text-sm text-secondary (e.g. "Unit 3, Theme 2").
Right: arrow icon accent-red.
whileHover scale 1.01, whileTap scale 0.98.

---

## 7. STUDY TAB

Title: "Study" text-xl Bold top left.
Units as accordion list, stagger-animated on mount.

Collapsed unit row: bg-surface full-width card, 16px padding.
Left: unit name text-lg SemiBold. Right: "X% done" text-sm text-secondary + chevron.
Chevron rotates 180 degrees on expand (Framer Motion, 250ms).
Theme cards: slide down with AnimatePresence, 300ms ease.

Theme card (bg-elevated, 12px radius, 14px padding):
Theme name text-base SemiBold. Word count text-sm text-secondary.
Status chip top-right corner (pill shape):
  Not Started: border-subtle border, text-muted text.
  Flashcards Done: warning low-opacity bg, warning text.
  Quiz Pending: warning border + subtle pulse animation.
  Complete: success low-opacity bg, success text + checkmark icon.
Locked (Phase 2): full card desaturated + lock icon overlay. Tap shows toast "Full access required."
Card tap: scale 0.97 feedback -> navigate with page slide animation.

---

## 8. FLASHCARD SCREEN

bg-base background.
Top bar: back arrow (left) / "Card 4 of 15" text-sm text-secondary (center) / X exit (right).
Progress bar: 3px height, accent-red fill, bg-elevated track. Width animates on each card advance 300ms.

THE CARD (centered, ~60% screen height, full-width minus 40px):
bg-surface, 12px radius, card shadow.
3D flip: CSS transform-style: preserve-3d. Framer Motion rotateY: 0->180 degrees, 400ms ease-in-out.
Front AND back: backface-visibility: hidden.

Front face content:
- Word: text-2xl Bold, centered, text-primary
- Part of speech: text-sm text-secondary, below word
- "Tap to reveal": text-xs text-muted, bottom of card. Gentle fade-pulse loop animation.

Back face content:
- Definition: text-lg SemiBold, top
- Divider line: border-subtle 1px
- "Synonyms:" text-xs text-muted label + values text-sm text-secondary
- "Antonyms:" text-xs text-muted label + values text-sm text-secondary
- Example sentence: italics text-sm text-secondary

Self-assessment chips (below card, appear AFTER flip only):
Fade-in + slide-up animation, 200ms, stagger 50ms each.
Three pill chips in a row, centered, equal spacing:
  Got it: success text + success border on tap, bg-elevated default
  Unsure: warning text + warning border on tap
  Missed it: danger text + danger border on tap
Tap feedback: chip scale 0.95 briefly, then auto-advances to next card.
Back arrow: always visible in top bar, navigates previous card with reverse slide animation.

Session Complete screen:
Confetti burst (canvas-confetti) fires on mount.
Stats card slides up from bottom with spring animation.
Got it / Unsure / Missed it counts each animate 0->value with colored icons.
Encouragement message text-secondary.
"Start Quiz" accent-red full-width button.
"Do it later" text-secondary text-sm link below button.

---

## 9. QUIZ SCREEN

bg-base. Top bar: "Quiz - Q3 of 8" text-sm text-secondary center + X exit right.
Progress bar: 3px accent-red, animates on each question advance.
Loading state: shimmer skeleton cards + "Generating your quiz..." text + rotating gradient border animation on container.

Question display: bg-surface card, text-base Regular, 16px padding. AnimatePresence fade 200ms on each new question.

Answer options A through E (vertical stack):
Each option: full-width bg-surface card, 14px padding, 12px radius.
Left: letter circle (A/B/C/D/E) in bg-elevated, text-sm Medium.
Right: option text text-base Regular.
Options stagger-animate in: 50ms each on mount.

On tap (before confirm):
  Selected option: accent-red glow border 2px + subtle red-tint bg overlay.
  Other options: opacity drops to 0.5, 150ms transition.
  Confirm button: springs up from y:20->0 (Framer Motion spring, 300ms) via AnimatePresence.

After confirm:
  Correct: border -> success, bg -> success tint, scale 1->1.03->1 animation.
  Wrong: border -> danger. Correct option highlights success simultaneously.
  400ms pause. Next question slides in from right.

---

## 10. END-OF-QUIZ SUMMARY

Slides in from right after last question (page transition).
Score circle: large SVG ring, animates stroke to score% on mount, 1000ms ease-out.
  Pass (>=70%): success color ring + "Passed!" heading.
  Fail (<70%): danger color ring + "Keep going!" heading.
Score number and fraction animate up from 0.

Questions listed as expandable cards below:
  Correct: success left border 3px.
  Wrong: danger left border 3px + correct answer shown in success color + AI explanation in text-secondary text-sm.
Cards scroll-reveal (whileInView stagger).

"Continue" accent-red full-width button.
"Review Weak Words" button: bg-surface outlined, accent-red border. Slides in 300ms after summary renders (only if wrong answers exist).

---

## 11. PRACTICE TAB

Title: "Practice" text-xl Bold.

Unit selection list (same visual style as Study tab units but with checkboxes):
Each unit row has a checkbox right side.
On select: Framer Motion pathLength animation draws the checkmark, 200ms.
Selected unit card: accent-red left border 3px.
"Select All" toggle: accent-red text-sm top-right.
"Start Practice" button: sticky bottom, accent-red full-width. AnimatePresence slides up from bottom when >=1 unit selected. Disappears when deselected to 0.

Empty state (no themes studied yet): centered icon + "Complete a flashcard session first to unlock Practice mode." text-secondary + arrow pointing to Study tab.

---

## 12. LEADERBOARD SCREEN

Three tabs: This Week / All-Time / Hall of Fame.
Active tab indicator: underline that slides between tabs (Framer Motion layoutId), accent-red, 250ms spring.

Ranked list (stagger 30ms on mount):
Each entry: bg-surface card, 14px padding, 12px radius.
Left: rank number text-lg Bold text-secondary.
Center: display name text-base SemiBold.
Right: points text-base Bold.

Top 3 cards:
1st: accent-gold glow border + gold rank number.
2nd: accent-silver glow border + silver rank number.
3rd: accent-bronze glow border + bronze rank number.

Logged-in user row: accent-red left border 3px, always visible. Scroll to it on mount (smooth scroll).

Hall of Fame tab:
Session entries as cards with session label as header text-sm text-secondary.
Top 3 per session shown with medal emoji, name, points.
Entries scroll-reveal animation (whileInView, stagger 40ms).

---

## 13. PROFILE TAB

Header:
Initials avatar: circle, accent-red bg, white text-2xl Bold, 64px diameter.
Name: text-xl Bold, text-primary.
"Member since [date]": text-sm text-secondary.
Edit name: pencil icon, text-muted, tap opens inline edit field with accent-red focus border.

Stats row (3 cards, horizontal scroll, no scroll indicators):
Total points | Current streak | Longest streak.
Each in bg-surface card, value text-2xl Bold, label text-xs text-secondary.
Values animate 0->actual on first mount (800ms).

Word progress summary:
"X / 1000 mastered" text-base SemiBold.
Thin progress bar accent-red below.
5 level pills in a row: New (red) / Learning (orange) / Familiar (yellow) / Strong (blue) / Mastered (green). Each shows count.

Badge grid (4 columns, 12px gap):
Earned badge: full color icon, bg-surface card, success glow border.
Locked badge: same icon grayscale 40% opacity. Small accent-red progress bar below showing progress to unlock.
All badges scroll-reveal (whileInView, stagger 30ms).
Tap any badge: bottom sheet slides up with spring 400ms. Shows name, description, earned date (if earned) or "X / Y to unlock" progress.

Word progress list:
Search input: bg-elevated, magnifier icon left, accent-red border on focus.
Filter chips row: All / New / Learning / Familiar / Strong / Mastered. Horizontally scrollable.
Active filter: accent-red bg, white text, scale 1->1.05 on select.
Each row: word text-base SemiBold + colored dot (level color) + score text-sm text-secondary.
Virtualized list (react-virtual) for performance with 1000 words.

Settings section:
Change deadline: tap -> date picker bottom sheet.
Theme toggle: "Dark mode" label + switch. accent-red when ON.
Push notifications toggle.
Email summary toggle.
Log out: danger text-sm. Tap -> confirmation bottom sheet slides up "Are you sure?" with cancel + confirm danger button.

---

## 14. BADGE EARN CELEBRATION (full-screen overlay)

Triggered any time a badge or achievement is earned, even mid-session.
Uses React portal to render above everything.

Framer Motion orchestrated sequence:
1. Dark overlay: opacity 0->0.95 (bg-base), 200ms. z-index top.
2. Badge icon: scale 0.3->1.1->1.0, 600ms spring (stiffness 200, damping 15).
3. Badge name: opacity 0->1, y:10->0, 300ms, delay 400ms. text-xl Bold text-primary.
4. "You earned it!": opacity 0->1, 200ms, delay 600ms. text-secondary.
5. Confetti: canvas-confetti fires at badge position, 2 second burst, accent-red + accent-gold + white particles.
6. Gold glow: keyframe pulse animation around badge, 2 complete cycles.
7. "Awesome!" dismiss button: opacity 0->1 at 1000ms.
8. Auto-dismiss after 4 seconds with fade-out.

Ultimate Achievements: identical flow but badge is 20% larger. confetti uses red + gold + white. auto-dismiss 6s.

---

## 15. TOASTS & MICRO-NOTIFICATIONS

Position: top center, rendered in portal.
Enter: slides y:-60->0, opacity 0->1, 250ms spring.
Exit: slides y:0->-60, opacity 1->0, 200ms ease.
Auto-dismiss: 3 seconds.
Max 3 toasts visible at once, stack vertically with 8px gap.

Types:
Info: bg-surface card, text-primary.
Success: success left border 3px.
Error: danger left border 3px.
Badge earned: accent-gold left border + small badge icon left + name text.

---

## 16. ADMIN PANEL

Separate layout, ALWAYS light mode regardless of user preference.
Clean white bg, professional feel, not gamified.
Sidebar nav on desktop (240px). Bottom tab bar on mobile.

Tables: striped rows, sortable column headers, search input top-right of each table.
Action buttons: small, outlined style, 8px radius.
Danger actions (suspend user, reset leaderboard): danger color button, confirmation modal required before executing.
Modal: slides up from bottom on mobile, centered popup on desktop. Overlay backdrop.
Stat cards top of dashboard: count-up animation on mount (800ms).
Data exports: simple download button, no custom UI needed.

---

## 17. LOADING & EMPTY STATES

Skeleton loaders: every content area shows pulsing skeleton in exact shape of real content while loading. No spinners.
Quiz generating: shimmer skeleton + centered "Generating your quiz..." text-secondary + rotating gradient border on outer container card.
Empty states: always centered, relevant icon (64px), text-secondary message, CTA button if there is a relevant action.
Error states: danger-tinted card (danger color at 10% opacity bg), danger icon, "Something went wrong" text, Retry button.

---

## 18. RESPONSIVE & PWA

Primary target: 390px width (iPhone 14 Pro).
Minimum: 375px (iPhone SE). Maximum content width: 430px.
Desktop: content centered, max-width 430px, rest of viewport bg-base.
No horizontal scroll anywhere.
All tap targets minimum 44x44px.
PWA: manifest.json with app name, icons (192px + 512px), theme color matching bg-base.
Splash screens for iOS add-to-home-screen.
Android maskable icon.
