# LexiCore Build — Session Handoff
_Last updated: 2026-04-04_

## What Was Completed This Session

| Task | Status | Key Files |
|------|--------|-----------|
| T27 — Badge Tracking Logic | ✅ Done | `src/lib/vocab/badges/definitions.ts`, `src/lib/vocab/badges/checker.ts`; updated `daily-login`, `flashcard/rate`, `quiz/summary`, `cron/weekly-reset` |
| T28 — Badge Earn Celebration UI | ✅ Done | `src/lib/vocab/badges/queue.tsx` (BadgeQueueProvider + useBadgeQueue), `src/components/vocab/BadgeCelebration.tsx` |
| T29 — Ultimate Achievements | ✅ Done | `src/app/api/vocab/admin/settings/route.ts`, `src/app/api/vocab/admin/ultimate-toggle/route.ts`, `src/app/admin/vocab/page.tsx` |
| T30 — Profile Page | ✅ Done | `src/app/vocab/(shell)/profile/page.tsx` (Server Component + data fetch), `src/app/vocab/(shell)/profile/ProfileScreen.tsx` (full UI), `src/app/api/vocab/profile/route.ts` (PATCH name) |

**TypeScript: 0 errors** after all changes.

---

## Critical Integration Points

### Using Badge Celebrations
Any page inside `/vocab/(shell)/` can trigger a badge celebration:
```tsx
import { useBadgeQueue } from '@/lib/vocab/badges/queue';

const { push } = useBadgeQueue();
// After an API call that returns earnedBadges:
push(earnedBadges); // EarnedBadge[] with id, name, description, category
```

The `BadgeQueueProvider` is already wrapping the vocab shell layout (`src/app/vocab/(shell)/layout.tsx`). All API routes that can earn badges (`daily-login`, `flashcard/rate`, `quiz/summary`) return `earnedBadges[]` — the client pages need to call `push()` with that array. **This wire-up is pending** — the APIs return the data but the client pages (flashcard session complete, quiz summary) don't call `push()` yet.

### Ultimate Achievements Admin Toggle
- URL: `/admin/vocab`
- API: `POST /api/vocab/admin/ultimate-toggle` with body `{ enable: boolean }`
- When enabled: retroactively checks ALL active vocab users for the 4 ultimate badges

### Profile Page Data
`page.tsx` fetches all data server-side:
- `levelStats`: counts per mastery level + total word count
- `badges`: all badge definitions filtered by `ultimateVisible`, merged with user earned/progress data
- `words`: ALL vocab words + user mastery records (left join) — sorted alphabetically
- `ultimateVisible`: from `vocab_admin_settings` table

---

## Next Tasks (from `vocab game/TASKS.md`)

### T31 — Settings Page
Path: `/vocab/profile/settings` (new page inside shell) OR inline settings section on profile page.
Requirements:
- Change deadline: date picker bottom sheet → saves to `vocabUserProgress.deadline`, recalculates `dailyTarget`
- Theme toggle: dark/light → saves to localStorage as `lx-theme`
- Push notifications toggle → saves to `vocabUserProgress.notificationsEnabled`
- Email summary toggle → saves to `vocabUserProgress.emailSummaryEnabled`
- Log out: confirmation bottom sheet → `signOut()`

Note: The profile page currently has a sign-out button but no settings page yet. The deadline card was intentionally removed from the profile page per UI_SPEC §13.

### T32 — Push Notifications (PWA)
- Service worker at `public/sw.js`
- Permission request + subscribe to push
- Triggers: not studied by 6pm, SRS overdue, badge earned, streak at risk

### T33 — Email Notifications
- Weekly summary cron (Sunday)
- Streak lost trigger when `streakDays` drops to 0

### T34 — Home Screen
- SERVER COMPONENT (React Server Component)
- Progress ring SVG with stroke-dashoffset animation on mount
- SWR for real-time points update
- "Continue Studying" card linking to last position

### T35 — Edge Case Screens
- Deadline passed: prompt on home screen
- All words reviewed: celebration screen
- Post cut-off locked units: lock overlay + "Request Full Access"

---

## Pending Wire-Up (NOT yet done)

1. **Badge `push()` calls from client pages**: The flashcard session complete screen and quiz summary screen receive `earnedBadges[]` from their APIs but do NOT yet call `useBadgeQueue().push()`. This needs to be added to:
   - `src/app/vocab/(shell)/study/[themeId]/` — session complete screen
   - `src/app/vocab/(shell)/practice/` — after each practice answer
   - The daily-login hook in home/layout

2. **Theme toggle in settings**: `lx-theme` localStorage key is read in the vocab shell layout but no settings UI exists to change it yet (T31).

---

## Design System Reminders

- **LexiCore aesthetic**: Dark editorial luxury. Cormorant Garamond (display/numbers) + Sora (UI).
- **Colors**: `--color-lx-*` CSS tokens. Crimson `#E63946`, Gold `#F4A828`.
- **No rounded cards** on profile page — sharp corners or `border-radius: 2px` max.
- **ALL UI tasks**: invoke ALL THREE skills (frontend-design + ui-ux-pro-max + magic-ui) + 21st.dev MCP BEFORE starting. Present design direction to user, wait for approval.
- **Framer Motion**: always `type: 'spring' as const` inside transition objects.
- **New packages installed this session**: `@tanstack/react-virtual`

---

## File Quick Reference

```
src/lib/vocab/badges/
  definitions.ts         — 24 badge definitions (BADGE_DEFS, BADGE_MAP)
  checker.ts             — checkBadges(userId, trigger, ctx?) → EarnedBadge[]
  queue.tsx              — BadgeQueueProvider, useBadgeQueue

src/components/vocab/
  BadgeCelebration.tsx   — full-screen portal overlay with canvas-confetti

src/app/vocab/(shell)/
  layout.tsx             — wraps with BadgeQueueProvider
  profile/
    page.tsx             — Server Component, fetches all profile data
    ProfileScreen.tsx    — full client UI (hex avatar, ledger stats, badge grid, virtual lexicon)

src/app/api/vocab/
  profile/route.ts       — PATCH (update name)
  admin/
    settings/route.ts    — GET all settings, PATCH one setting
    ultimate-toggle/route.ts — POST (toggle + retroactive batch award)

src/app/admin/vocab/
  page.tsx               — Admin settings UI (light mode)
```
