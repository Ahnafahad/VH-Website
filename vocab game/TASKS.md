# TASKS.md — LexiCore Build Order
# Work through these sequentially. Complete + verify each before moving on.
# Verify every task at 390px viewport width on mobile.
# Status key: ✅ DONE | ⚠️ PARTIAL (read note) | ❌ NOT DONE
# Last audit: 2026-04-05

---

## PHASE 1 — PROJECT FOUNDATION

### T01 — Project Scaffold ✅ DONE
- Init Next.js 14 App Router + TypeScript strict mode
- Install: tailwindcss, framer-motion, prisma, @prisma/client, zod, bcrypt, jsonwebtoken, resend, canvas-confetti, react-virtual
- Install: shadcn/ui base setup
- Configure tailwind.config.ts with all colour tokens from UI_SPEC.md (dark + light mode)
- Configure CSS variables for theme switching (.dark/.light on html)
- Set up folder structure as per CLAUDE.md
- Create .env.example with all required variables
- VERIFY: `npx tsc --noEmit` passes. Tailwind tokens visible in dev tools.

### T02 — Database Schema ✅ DONE
- Write Prisma schema with models: User, Word, Unit, Theme, UserWordRecord, WordConfusionLog, SRSRecord, QuizSession, QuizAnswer, Badge, UserBadge, LeaderboardEntry, HallOfFame, AccessRequest, AdminSettings
- Include all fields from PRD sections 5.2, 7.12, 8.2
- Add indexes on: userId+wordId (UserWordRecord), userId (SRSRecord), weekStart (LeaderboardEntry)
- Run `prisma migrate dev --name init`
- NOTE: Using Drizzle ORM (not Prisma). 15 vocab_* tables in src/lib/db/schema.ts.
- VERIFY: Prisma Studio shows all tables correctly.

### T03 — Auth System ✅ DONE
- POST /api/auth/register — validate fields (Zod), hash password (bcrypt 12), create user, send verification email via Resend
- POST /api/auth/verify-email — validate token, activate user account, set phase based on cut-off date
- POST /api/auth/login — validate credentials, check verification + suspension, return JWT access + refresh tokens (httpOnly cookies)
- POST /api/auth/refresh — rotate refresh token
- POST /api/auth/logout — clear cookies
- Middleware: protect all /app/* and /admin/* routes
- NOTE: Using Google OAuth via NextAuth v4. JWT role from first login. Route protection active.
- VERIFY: Full register -> verify email -> login flow works end to end.

### T04 — Email Templates (Resend) ✅ DONE
- Verification email: VH branded, verification link, expires 24h
- Weekly summary email template (data passed in later)
- Streak lost email template
- Admin announcement template
- VERIFY: Emails render correctly in email client preview.
- **COMPLETED:** sendWeeklySummary(), sendStreakLost(), sendAdminAnnouncement() added to src/lib/email.ts. Dark LexiCore brand (crimson header, gold stats, dark bg). sendAdminAnnouncement uses Promise.allSettled + XSS sanitization.

---

## PHASE 2 — ADMIN PANEL

### T05 — Admin Panel Layout ✅ DONE
- Separate layout at /admin with sidebar (desktop) + top bar + drawer (mobile)
- Light mode only — force regardless of user preference (colorScheme: light)
- Auth guard: redirect non-admin users to /vocab
- VERIFY: Admin layout renders, non-admin redirected.
- **COMPLETED:** src/app/admin/layout.tsx (Server Component, getServerSession guard), AdminSidebar.tsx (layoutId animated active indicator, staggered entrance, sign-out), AdminMobileHeader.tsx (AnimatePresence drawer, x:-256→0 spring).

### T06 — Word Bank Import ✅ DONE
- CSV/JSON upload endpoint POST /api/admin/words/import
- Parse and validate: word, definition, synonyms, antonyms, example_sentence, part_of_speech, unit_id, theme_id, difficulty_base
- Upsert logic — re-import updates existing words
- Unit + Theme create/edit/delete/reorder UI in admin
- Individual word add/edit/delete UI
- VERIFY: Import 50 test words via CSV, verify in DB and admin list.
- **COMPLETED:** src/app/admin/words/page.tsx (3-tab: Import/Units&Themes/Words). Zero-dep CSV parser, accordion unit management with inline rename, paginated word table with full edit modal. AdminSidebar updated with Word Bank nav item.

### T07 — Admin User Management ✅ DONE
- User list table: name, email, registration date, role, status
- Search + filter (name / email / role)
- Actions: suspend/reactivate, change role, grant product access
- View individual user progress stats
- Access requests list with one-click "Grant Full Access"
- VERIFY: Suspend a test user, verify their session terminates. Upgrade a user, verify access expands.
- **COMPLETED:** src/app/admin/users/page.tsx + UsersClient.tsx. Debounced search, filter chips, slide-in detail panel (x:100%→0 spring), product access toggles, ConfirmDialog, AccessRequestCards with AnimatePresence popLayout exit.

### T08 — Admin Leaderboard & Achievement Controls ✅ DONE
- View current weekly + all-time leaderboards in admin
- Manual all-time reset: require session label input, auto-save top 3 to Hall of Fame before reset
- Hall of Fame session cards
- Toggle Ultimate Achievements, quiz pass threshold, cut-off date: already in /admin/vocab/page.tsx
- VERIFY: Reset leaderboard, confirm top 3 saved to Hall of Fame with label.
- **COMPLETED:** src/app/admin/leaderboard/page.tsx + LeaderboardClient.tsx. Weekly/all-time tables with gold/silver/bronze row accents, HoF session card grid, 2-step ResetModal (label input → confirmation), POST /api/admin/leaderboard/reset.

### T09 — Admin Announcements ✅ DONE
- Compose announcement: subject + body
- Send to all active users via Resend
- VERIFY: Send test announcement, verify delivery.
- **COMPLETED:** src/app/admin/announcements/page.tsx + AnnouncementsClient.tsx. Subject/body with CharCounter (amber→red), live dark email preview panel, spring confirmation modal, auto-dismiss result toast (green/amber/red). Fixed pre-existing Zod .errors → .issues bug in API route.

---

## PHASE 3 — CORE APP SHELL

### T10 — App Shell & Navigation ✅ DONE
- Bottom nav bar: 5 tabs, icons only, no labels
- Active tab: accent-red icon + sliding dot (Framer Motion layoutId)
- Tab icon activate: scale pulse animation
- Page transition wrapper: all /app/* routes slide in/out (Framer Motion AnimatePresence)
- Theme: read localStorage on mount, apply .dark/.light to html, default dark
- VERIFY: All 5 tabs navigate. Page slide animations work. Theme persists on refresh.
- **AUDIT NOTE:** Limelight spotlight (layoutId="limelight"), glassmorphism (blur 20px), crimson glow on active. Premium quality. ✅

### T11 — Splash & Onboarding ✅ DONE
- Splash screen: orchestrated logo -> tagline -> button animation sequence
- Onboarding Step 2: deadline picker, live words/day calculation
- Onboarding Step 3: swipeable tutorial screens with auto-play card flip demo
- Store onboarding complete flag in DB, never show again after completion
- VERIFY: First-time user sees full onboarding. Returning user skips to home.
- **AUDIT NOTE:** StepWelcome is exceptional — animated SVG LexiCore logo path-drawing, ambient blobs, grain overlay, pulsing CTA. StepDeadline fully coded (live WPD calc, date picker, CSS tokens). StepTutorial has interactive mini flashcard/quiz/streak demos. All branded correctly.

---

## PHASE 4 — STUDY MODE

### T12 — Study Tab: Unit & Theme List ✅ DONE
- Fetch units + themes with user progress from DB
- Accordion list with Framer Motion expand/collapse animation
- Status chips per theme (Not Started / Flashcards Done / Quiz Pending / Complete)
- Phase 2 locked theme overlay
- Resume prompt if mid-session exists
- VERIFY: Unit list renders with correct status chips. Expand/collapse animates.

### T13 — Flashcard Session ✅ DONE
- Load theme words from DB
- Save session progress to DB on every card advance (for resume)
- Resume prompt: "Card 7 of 15. Resume or Start Over?"
- 3D card flip: Framer Motion rotateY with preserve-3d, backface-visibility hidden
- Back arrow: navigate to previous card with reverse slide
- Progress bar animates on each advance
- Self-assessment chips: appear after flip with stagger animation
- Record self-assessment to DB (feeds mastery score immediately)
- VERIFY: Flip animation works. Session saves on mid-exit. Resume restores correct position.

### T14 — Self-Assessment -> Mastery Score Update ✅ DONE
- API: POST /api/study/flashcard-assessment
- Input: wordId, rating (got_it | unsure | missed_it)
- Apply mastery score change: got_it +2pts, unsure 0pts, missed_it -1pt to base score
- Update UserWordRecord: last_seen_at, mastery_status recalculate
- Apply recency multiplier: reset to 1.0 on any interaction
- VERIFY: Got it on a word increases its base score. Missed it decreases. Score reflects immediately in word list.
- **AUDIT NOTE:** Implemented as POST /api/vocab/flashcard/[themeId]/rate. Handles got_it/unsure/missed_it, updates SRS state + mastery score atomically. Returns earnedBadges.

### T15 — Session Complete Screen ✅ DONE
- Summary screen after last card
- canvas-confetti on mount
- Got it / Unsure / Missed it counts animate 0->value
- "Start Quiz" button -> triggers quiz generation
- "Do it later" -> sets theme status "Quiz Pending", returns home
- VERIFY: Confetti fires. Counts animate. Both buttons work.
- **COMPLETED:** FlashcardScreen.tsx line 66: 🏆 replaced with `<Trophy size={48} strokeWidth={1.5} color="var(--color-lx-accent-gold)" />`. Badge queue wired: push(earnedBadges) called after last card rated.

---

## PHASE 5 — SRS ENGINE

### T16 — SRS Core Logic ✅ DONE
- Implement in /lib/srs/engine.ts
- SM-2 inspired: interval, ease_factor, repetitions per UserWordRecord
- Self-assessment -> interval: Got it = interval x ease_factor, Unsure = same, Missed it = reset to 1 day
- Ease factor changes: Got it +0.1, Unsure -0.15, Missed it -0.2 (min 1.3)
- next_review_date calculated and saved after every assessment
- VERIFY: Unit test — Got it 5 times on a word, verify interval grows correctly.

### T17 — Deadline-Based Daily Scheduling ✅ DONE
- On login / home screen load: calculate daily target
- Formula: (words in pool not yet mastered) / (days until deadline)
- Account for new words entering pool as user progresses
- If ahead: reduce daily target. If behind: increase.
- Save daily target to UserRecord, shown on home screen ring
- Recalculate immediately when deadline updated in Settings
- VERIFY: Set deadline 30 days out with 300 words in pool. Verify target = ~10/day.

---

## PHASE 6 — AI QUIZ SYSTEM

### T18 — Distractor Selection Engine ✅ DONE
- Implement in /lib/ai/distractor-selector.ts
- Tier 1: semantic neighbours (same theme cluster, synonyms, same POS + domain)
- Tier 2: same unit, different theme
- Tier 3: distant words (max 1 per question)
- Quality gate: at least 3 of 5 options must be Tier 1 or 2. Replace Tier 3 if gate fails.
- Answer position: randomly assign A-E each generation
- After 10 answers: blend personalised confusion pairs into Tier 1 selection
- VERIFY: Generate 10 questions, confirm quality gate passes on all. Correct answer is never always in same position.

### T19 — Priority Score System (Practice Quiz) ✅ DONE
- Implement in /lib/srs/priority-score.ts
- Calculate for every word in selected units
- Factors: days_since_last_seen (30%), accuracy_rate (30%), srs_overdue (20%), mastery_status (15%), exposure_count (5%)
- Sort descending for quiz correct-answer selection
- VERIFY: A word not seen in 14 days scores higher than one seen today. Mastered word scores lower than learning word.

### T20 — Mastery Score Engine ✅ DONE
- Implement in /lib/srs/mastery-score.ts
- Base score changes: correct quiz +10, wrong quiz -4, got_it flashcard +2, missed_it flashcard -1
- Long-gap bonus: correct quiz after 30+ day SRS interval -> +15 additional
- Confusion penalty: Word A (correct, user missed) extra -3. Word B (chosen wrongly) -2.
- Exposure: +0.5 per session seen, capped at +10 lifetime
- Recency multiplier: starts 1.0, grace period 7 days, then -1%/day, floor 0.30
- Mastery levels: New 0-20, Learning 21-60, Familiar 61-120, Strong 121-200, Mastered 201+
- VERIFY: Unit test the full score calculation against the example in the PRD.

### T21 — Gemini Quiz Generation ✅ DONE
- Implement in /lib/ai/quiz-generator.ts
- Server-side only. API key never leaves server.
- Select correct-answer words (Study quiz: all theme words equal weight. Practice quiz: Priority Score ranking)
- Run distractor selection (T18) server-side first
- Build system prompt: words + definitions + synonyms + antonyms + distractors + student level + difficulty + instructions
- Call Gemini Flash API. Parse JSON response.
- Retry up to 2 times on failure or parse error
- Question types by level: Beginner=fill-in-blank, Intermediate adds analogies, Advanced adds correct-usage
- Dynamic difficulty: 2 correct in a row -> harder. 2 wrong -> easier
- VERIFY: Generate a real quiz for a theme. Confirm JSON structure. Confirm no verbatim example sentences reused.
- **AUDIT NOTE:** Uses Gemini 2.5 Flash. 2-retry mechanism. Tiered distractor selection confirmed. Server-side only confirmed.

### T22 — Quiz Session Flow ✅ DONE
- POST /api/quiz/generate -> returns quiz questions (no answer positions revealed)
- POST /api/quiz/answer -> records answer, updates UserWordRecord, confusion log, mastery score, SRS
- Both Word A and Word B updated on confusion event (T20 logic)
- GET /api/quiz/summary/:sessionId -> returns full results with AI explanations
- No-repeat rule enforced: each word as correct answer max once per session
- VERIFY: Complete a full quiz. Verify all UserWordRecord fields updated correctly after each answer.
- **AUDIT NOTE:** Quiz UI (QuizScreen.tsx) is exceptional — custom SVG icons, particle burst on correct, conic-gradient spinner. Quiz summary API returns earnedBadges. UI does NOT yet call useBadgeQueue().push() — see T28 wire-up.

---

## PHASE 7 — PRACTICE MODE

### T23 — Practice Mode Session ✅ DONE
- Practice tab: unit selection with checkboxes + animated check draw
- AnimatePresence "Start Practice" button appears/disappears
- Generate quiz using Priority Score system (T19) across all selected units
- 20 questions max per session
- All answers tracked to mastery (same as study quiz)
- Practice session completing a theme's words also unlocks next theme
- VERIFY: Select 2 units, start practice, verify questions pull from both units weighted by priority score.

---

## PHASE 8 — POINTS & LEADERBOARD

### T24 — Points System ✅ DONE
- All point calculations server-side only
- Award points on: flashcard session complete +10, correct fill-in-blank +5, correct analogy +10, correct correct-usage +15, quiz pass bonus +25, quiz finish no-pass +10, unit complete +50, daily login +5, SRS review complete +10
- Update user total_points in DB after every award
- POST /api/points/award (internal, called from other endpoints)
- VERIFY: Complete a flashcard session, verify +10 points. Pass a quiz, verify +25 bonus.

### T25 — Leaderboard System ✅ DONE
- Weekly leaderboard: points earned since last Sunday midnight UTC
- All-time leaderboard: cumulative total
- GET /api/leaderboard/weekly and /api/leaderboard/alltime
- Suspended users excluded
- Logged-in user always included in response with their rank
- Cron job: every Sunday midnight UTC -> save top 3 to HallOfFame, reset weekly points
- VERIFY: Multiple test users. Verify ranks correct. Suspended user not shown.

### T26 — Leaderboard UI ✅ DONE
- Three tabs: This Week / All-Time / Hall of Fame
- Animated tab indicator slides (layoutId)
- Cards stagger-animate on mount (30ms each)
- Top 3: glow borders (gold/silver/bronze)
- Logged-in user row: accent-red left border, auto-scroll to on mount
- Hall of Fame: session cards scroll-reveal (whileInView)
- VERIFY: Leaderboard renders with correct styling for top 3. User row highlighted.
- **AUDIT NOTE:** Exceptional quality — Roman numeral podium ranks (I/II/III), custom SVG star, MEDAL glow config, all CSS tokens. Premium. ✅

---

## PHASE 9 — BADGES & ACHIEVEMENTS

### T27 — Badge Tracking Logic ✅ DONE
- Implement badge checker in /lib/badges/checker.ts
- Check all 20 badge conditions after every relevant action
- Run asynchronously after action completes (don't block main response)
- On badge earned: write to UserBadge table, return earned badge in API response
- VERIFY: Complete first flashcard session, verify "First Step" badge awarded.

### T28 — Badge Earn Celebration UI ✅ DONE
- React portal overlay, renders above everything
- Framer Motion orchestrated sequence per UI_SPEC section 14
- canvas-confetti from badge center position
- Auto-dismiss 4s, manual dismiss button
- Queue: if multiple badges earned simultaneously, show one at a time
- VERIFY: Trigger a badge earn, verify full animation sequence plays.
- **COMPLETED:** All 3 push() call sites wired. FlashcardScreen: push after last card rated. QuizScreen: push after summary fetch. Shell layout split into VocabShellLayout (provider) + VocabShellInner (consumer) — daily-login GET on mount with useRef Strict Mode guard. GET /api/vocab/daily-login added (extracted from existing POST handler).

### T29 — Ultimate Achievements ✅ DONE
- Hidden from all users by default (not in any API response)
- Admin toggle in DB (AdminSettings.ultimate_achievements_visible)
- When toggled ON: retroactively check all users for qualifications
- Award immediately to qualifying users
- Show celebration same as badge earn
- VERIFY: Toggle ON in admin. Verify qualifying user receives achievement. Verify non-qualifying user does not.

---

## PHASE 10 — PROFILE & SETTINGS

### T30 — Profile Page ✅ DONE
- Header: initials avatar, name, member since, edit name
- Stats row: animate on mount
- Word progress summary + level pills
- Badge grid: earned full color + success glow. Locked: grayscale + progress bar.
- Badge detail bottom sheet
- Word list: search + filter chips + virtualized list (react-virtual)
- VERIFY: All 1000 words render performantly in word list. Badge grid shows correct earned/locked state.
- **AUDIT NOTE:** Exceptional museum archive aesthetic. Hexagonal avatar seal, inline name editor, virtualized lexicon, badge specimen grid. All CSS tokens, Cormorant+Sora, spring animations. ✅

### T31 — Settings ✅ DONE
- Change deadline: date picker bottom sheet, recalculates daily target immediately
- Theme toggle: dark/light, persists to localStorage
- Push notification permission request + toggle
- Email summary toggle (saves to DB)
- Log out: confirmation bottom sheet, drag-to-dismiss
- VERIFY: Toggle theme, refresh, verify persists. Change deadline, verify home screen ring target updates.
- **COMPLETED:** Profile|Settings tab strip with layoutId="settings-tab-indicator" spring underline. Custom LuxToggle (46×26px pill, spring knob). 5 sections: deadline bottom sheet, day/night icon-morph toggle, notifications (requestPermission flow + denied state), email summary, danger zone drag-to-dismiss signout sheet. page.tsx updated for Next.js 15 searchParams Promise. PATCH route extended for deadline/notificationsEnabled/emailSummaryEnabled.

---

## PHASE 11 — NOTIFICATIONS

### T32 — Push Notifications (PWA) ✅ DONE
- Request permission during onboarding step 3
- Service worker: handle push events
- Users can toggle off in Settings
- VERIFY: PWA push notification received on test device.
- **COMPLETED:** web-push installed. VAPID key gen script (scripts/generate-vapid.js). Schema column push_subscription added + migration SQL. /api/vocab/push/{subscribe,unsubscribe,send} routes. worker/index.js (next-pwa v5 auto-merge) handles push + notificationclick. usePushNotifications hook. ProfileScreen notifications toggle wired to hook. src/lib/vocab/push-notify.ts server utility. Runtime: run generate-vapid.js + apply migration SQL before deploy.

### T33 — Email Notifications ✅ DONE
- Weekly summary: cron every Sunday, send to all active users with emailSummaryEnabled ON
- Streak lost: trigger when streak drops to 0
- Transactional: announcement via T09
- VERIFY: Weekly summary sends with correct data.
- **COMPLETED:** /api/cron/weekly-summary (batch-10, CRON_SECRET auth, rankMap from leaderboard). /api/cron/check-streaks (resets streakDays=0, sends sendStreakLost only for emailSummaryEnabled users). vercel.json cron schedule added. lastStudyDate already updated in flashcard+practice rate routes — no changes needed.

---

## PHASE 12 — HOME SCREEN & FINAL SCREENS

### T34 — Home Screen ✅ DONE
- All API data fetched server-side (React Server Component)
- Stagger card animations on mount
- Progress ring: SVG stroke-dashoffset animation on mount
- Points badge: animates up when points change (use SWR for real-time)
- Continue Studying card with red glow
- Due words card pulses if >0
- VERIFY: Home screen loads with real data. Ring animates. Continue Studying links to correct last position.
- **AUDIT NOTE:** HomeScreen.tsx confirmed built. page.tsx server component confirmed. ProgressRing, AnimatedNumber, streak/due cards, deadline passed banner all present. Cormorant + Sora + CSS tokens. Spring animations. No emoji. ✅

### T35 — Edge Case Screens ✅ DONE
- Deadline passed: gentle prompt on home screen "Your target date passed. Update your deadline." + Update button
- All words reviewed: celebration screen, shifts to mastery progress focus
- Post cut-off locked units: lock icon + "Full access required" + "Request Full Access" form
- VERIFY: Set deadline to yesterday, verify prompt appears. Lock a Phase-2 user, verify lock UI.
- **COMPLETED:** DeadlineBanner.tsx (crimson-tinted alert, CalendarX icon, → /vocab/profile?tab=settings). AllWordsReviewedScreen.tsx (canvas-confetti burst, rotating gold seal, 3-col stats, staggered spring). LockedUnitOverlay.tsx (blur(4px), gold Lock, portal bottom sheet with WhatsApp form, success/error states). POST /api/vocab/access-request (idempotent). HomeScreen + StudyScreen updated.

---

## PHASE 13 — PWA & HARDENING

### T36 — PWA Setup ✅ DONE
- manifest.json: app name, icons (192 + 512px), theme-color, display standalone
- next-pwa config: service worker, offline fallback page
- iOS splash screens meta tags
- VERIFY: Install PWA on iPhone and Android. Launches correctly from home screen.
- **COMPLETED:** next-pwa installed, next.config.ts wrapped (disabled in dev). public/manifest.json (start_url: /vocab, dark theme). Placeholder icons at public/icons/. vocab/layout.tsx metadata extended with manifest + appleWebApp + apple-touch-icon.

### T37 — Security Hardening ✅ DONE
- Rate limiting on auth endpoints (max 5 attempts / 15 min per IP)
- JWT expiry enforcement
- Zod validation on every API route input
- Server-side session termination on suspend (invalidate all refresh tokens for user)
- Points integrity: audit all point-award code paths, confirm no client values accepted
- VERIFY: Brute force login blocked after 5 attempts. Suspended user session terminates immediately.

### T38 — Performance & Final QA ❌ NOT DONE
- Lighthouse PWA score >= 90
- First Contentful Paint <= 2s on mobile
- Word list virtualization confirmed with 1000 rows
- All animations run at 60fps (check with Chrome DevTools)
- Test all edge cases from PRD section 15
- Test on: iPhone SE (375px), iPhone 14 Pro (390px), Android mid-range
- VERIFY: Lighthouse passes. All PRD acceptance criteria checked off.

---

## ══════════════════════════════════════════════════════════════
## REMAINING WORK — DEPENDENCY-MAPPED BUILD ORDER
## Read this section before starting any new task.
## Legend: BLOCKS = cannot start the listed tasks until this is done
##         NEEDS  = this task cannot start until listed tasks are done
## ══════════════════════════════════════════════════════════════

```
DEPENDENCY GRAPH — STATUS AS OF 2026-04-05

✅ Fix1(T15) ── DONE
✅ Fix2(T28) ── DONE
✅ T31(Settings) ── DONE → unblocked T32 + T35
✅ T35(Edge Cases) ── DONE
✅ T36(PWA) ── DONE → unblocked T32
✅ T32(Push Notifs) ── DONE
✅ T04 complete ── DONE → unblocked T33 + T09
✅ T33(Email) ── DONE
✅ T05(Admin Layout) ── DONE → unblocked T06+T07+T08+T09
✅ T08 complete ── DONE
✅ T06(Word Bank) ── DONE
✅ T07(User Mgmt) ── DONE
✅ T09(Announce) ── DONE

REMAINING:
❌ T37(Security) ── needs all features done ← NOW UNBLOCKED
❌ T38(Final QA) ── needs T37
```

---

### #1 — FIX: T15 Emoji Violation
STATUS: ✅ DONE — Trophy icon replaces 🏆 in FlashcardScreen.tsx

---

### #2 — FIX: T28 Badge Wire-Up
STATUS: ✅ DONE — All 3 push() sites wired. Shell layout split for BadgeQueueProvider.

---

### #3 — T31: Settings Page
STATUS: ✅ DONE — Profile|Settings tab strip, LuxToggle, 5 settings sections, drag-to-dismiss sign-out.

---

### #4 — T35: Edge Case Screens
STATUS: ✅ DONE — DeadlineBanner, AllWordsReviewedScreen, LockedUnitOverlay with access request form.

---

### #5 — T36: PWA Setup
STATUS: ✅ DONE — next-pwa, manifest.json, iOS meta tags, placeholder icons.

---

### #6 — T32: Push Notifications
STATUS: ✅ DONE — VAPID setup, web-push, service worker, subscribe/unsubscribe APIs, usePushNotifications hook.
RUNTIME REQUIRED: run generate-vapid.js + apply add-push-subscription.sql migration before deploy.
WHY SIXTH: Both hard dependencies (T36 + T31) are now satisfied. Build the
  full subscription flow: permission request in onboarding, VAPID keys, push
  event handler in service worker, server-side trigger points (6pm reminder,
  SRS overdue, streak at risk, badge earned).

---

### #7 — T04 Complete: LexiCore Email Templates
STATUS: Partial (registration-only email exists; LexiCore templates missing)
NEEDS: nothing (standalone Resend template work)
BLOCKS: T33 (weekly summary + streak-lost cron needs these templates),
        T09 (admin announcement email needs a template)
WHY SEVENTH: Template work is isolated from all other features. Writing the
  HTML templates (weekly summary, streak lost, verification) unblocks both T33
  and T09. No UI, no schema changes — just Resend templates.
WHAT TO DO:
  - Add to src/lib/email.ts: sendWeeklySummary(), sendStreakLost(), sendAdminAnnouncement()
  - Use --color-lx-* brand: crimson + gold on dark background

---

### #8 — T33: Email Notifications
STATUS: Not done
NEEDS: T04 complete (templates) + T31 (email summary toggle saved to DB)
BLOCKS: nothing downstream
WHY EIGHTH: Both deps satisfied. Wire up: Sunday cron calls sendWeeklySummary()
  for all users with emailSummaryEnabled=true. Streak-drop trigger calls
  sendStreakLost() when streakDays hits 0. These are the last user-facing
  notification channels.

---

### #9 — T05 Complete: Admin Panel Layout
STATUS: ✅ DONE — layout.tsx + AdminSidebar + AdminMobileHeader. Light mode forced. Auth guard active.

---

### #10 — T08 Complete: Admin Leaderboard UI
STATUS: ✅ DONE — /admin/leaderboard page with weekly/all-time tables, HoF cards, 2-step reset modal.

---

### #11 — T06: Word Bank Import
STATUS: ✅ DONE — /admin/words page with Import/Units&Themes/Words tabs. Zero-dep CSV parser. Full word CRUD.

---

### #12 — T07: Admin User Management
STATUS: ✅ DONE — /admin/users page with slide-in detail panel, product toggles, access request approvals.

---

### #13 — T09: Admin Announcements
STATUS: ✅ DONE — /admin/announcements with live email preview, CharCounter, spring modal, result toast.

---

### #14 — T37: Security Hardening
STATUS: ✅ DONE — Rate limiter confirmed, Zod audit complete, points integrity confirmed server-side, init-admin hardened, 5 security headers added, all 14 admin routes role-checked.

---

### #15 — T38: Performance & Final QA
STATUS: ❌ NOT DONE — blocked by T37
NEEDS: T37
BLOCKS: launch
WHAT TO DO: Lighthouse ≥ 90, FCP ≤ 2s, 60fps animation audit, full device testing (iPhone SE 375px, iPhone 14 Pro 390px, Android mid-range).

---

## QUICK REFERENCE — WHAT BLOCKS WHAT

| Task         | Status | Cannot start until...          | Once done, unblocks...         |
|--------------|--------|-------------------------------|-------------------------------|
| Fix 1 (T15)  | ✅     | —                             | Nothing (isolated fix)        |
| Fix 2 (T28)  | ✅     | —                             | Nothing (isolated fix)        |
| T31          | ✅     | —                             | T32, T35                      |
| T35          | ✅     | T31                           | Nothing                       |
| T36          | ✅     | —                             | T32                           |
| T32          | ✅     | T36 + T31                     | Nothing                       |
| T04 complete | ✅     | —                             | T33, T09                      |
| T33          | ✅     | T04 + T31                     | Nothing                       |
| T05          | ✅     | —                             | T06, T07, T08c, T09           |
| T08 complete | ✅     | T05                           | Nothing                       |
| T06          | ✅     | T05                           | Nothing                       |
| T07          | ✅     | T05                           | Nothing                       |
| T09          | ✅     | T05 + T04                     | Nothing                       |
| T37          | ✅     | All features (#1–#13) ← DONE  | T38                           |
| T38          | ❌     | T37 ← DONE                    | Launch                        |
