# LexiCore Design System

## Direction

LexiCore uses a dark editorial product language: calm charcoal surfaces, crisp typography, crimson action, and gold reserved for earned value. The existing L identity remains unchanged.

## Typography

- UI: Sora, with system sans-serif fallback. Use for navigation, controls, labels, body copy, and data.
- Vocabulary: Cormorant Garamond, with Georgia fallback. Use for words, definitions, and rare milestone headings.
- Product type uses a fixed rem scale. Normal body text is at least 1rem.

## Color Roles

- Base `#0F0F0F`; surface `#1A1A1A`; elevated `#242424`.
- Primary text `#F5F5F5`; secondary `#B0B0B0`; muted `#858585`.
- Crimson `#E63946` is for primary actions, focus, and active state.
- Gold `#F4A828` is for earned value and significant milestones.
- Blue is study/review, teal is strong mastery, and green is success.
- Light mode keeps the same semantic roles and must meet WCAG 2.2 AA.

## Layout

- Use a 4px spacing foundation: 4, 8, 12, 16, 24, 32, 48, 64.
- Mobile prioritizes one-handed use and a stable bottom navigation.
- Desktop uses the existing navigation rail and purpose-built wider layouts.
- Cards represent distinct actionable objects; use spacing and dividers for ordinary grouping.

## Components

- All controls have default, hover, focus-visible, active, disabled, and loading states.
- Minimum interactive target is 44x44px.
- Sheets and dialogs manage focus, escape/back behavior, and screen-reader labelling.
- Loading states resemble incoming content. Errors explain what happened and offer a specific recovery action.

## Motion

- Press feedback: 100–150ms. State changes: 150–250ms. Sheets/dialogs: up to 350ms.
- Motion communicates state. Routine navigation never waits for choreography.
- Significant achievements may use richer motion, sound, and haptics.
- Every effect has a reduced-motion alternative.

## Voice

Be specific, concise, and encouraging. Explain why a word is due and what an action changed. Never blame users or use humor in error states.
