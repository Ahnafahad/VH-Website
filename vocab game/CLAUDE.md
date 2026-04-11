# CLAUDE.md — LexiCore Vocabulary App
# Read this at the start of every session.

---

## Project Overview
Mobile-first Progressive Web App (PWA) for vocabulary learning.
~1000 words, spaced repetition, AI-generated quizzes, gamification.
Organisation: VH Beyond the Horizon.

---

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript — strict mode, no `any`
- **Styling:** Tailwind CSS + shadcn/ui base components
- **Animations:** Framer Motion for ALL transitions, flips, celebrations
- **UI Components:** 21st.dev / Magic UI for premium components
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Custom JWT (access token 15min, refresh token 30 days) + email verification
- **Email:** Resend
- **AI:** Google Gemini Flash — server-side ONLY, API key never in client
- **File Storage:** Local filesystem or S3-compatible for word bank CSV/JSON uploads
- **PWA:** next-pwa

---

## Project Structure
```
/app                    → Next.js App Router pages
  /(auth)               → login, register, verify
  /(app)                → protected routes (home, study, practice, leaderboard, profile)
  /admin                → admin panel (separate layout)
  /api                  → all API routes
/components
  /ui                   → base shadcn components
  /shared               → reusable app components
  /screens              → full screen components
/lib
  /db                   → Prisma client
  /auth                 → JWT helpers
  /srs                  → SRS + scoring engine
  /ai                   → Gemini integration
  /email                → Resend templates
/prisma
  schema.prisma
/public
```

---

## ABSOLUTE RULES — Never violate these

1. **NEVER expose API keys to the client.** Gemini, email, DB — server-side only.
2. **NEVER calculate points or scores client-side.** All scoring happens in API routes.
3. **NEVER skip TypeScript types.** Every function, prop, and DB result must be typed.
4. **NEVER use `any`.** Use `unknown` and narrow, or define proper types.
5. **NEVER store plaintext passwords.** bcrypt with salt rounds ≥ 12.
6. **NEVER trust client input.** Validate everything with Zod on the server.
7. **NEVER put business logic in components.** Components render. API routes compute.
8. **NEVER use `useEffect` for data fetching.** Use React Server Components or SWR.

---

## Code Style
- ES modules (import/export) — no CommonJS require
- Destructure imports where possible
- Named exports for components, default export for pages
- Async/await — no .then() chains
- Error handling: try/catch in all API routes, return typed error responses
- Zod for all request body validation
- Prisma transactions for any multi-table writes

---

## Workflow Rules
1. After any schema change: run `npx prisma generate && npx prisma migrate dev`
2. After any component change: typecheck with `npx tsc --noEmit`
3. Run single test files, not the full suite: `npx jest path/to/test`
4. Before marking a task done: verify it works on a 390px wide viewport (iPhone SE)
5. All database queries go through `/lib/db` — never import Prisma client directly in components

---

## Animations — Framer Motion Rules
- Every page transition: slide left/right, 300ms ease
- Every card appearance: fade + scale from 0.95, 200ms
- Flashcard flip: rotateY 3D, 400ms ease-in-out, backface-visibility hidden
- Badge earn: full screen overlay, scale from 0.5 to 1.0, 600ms spring + confetti
- Progress ring: animate stroke-dashoffset on mount, 800ms ease
- Bottom nav tab switch: icon scale pulse 1→1.15→1, 150ms
- All hover states on desktop: subtle scale 1.02, 150ms
- Never use CSS transitions for complex animations — always Framer Motion

---

## Colour Tokens (Tailwind config)
Dark mode is default. Light mode applied via `.light` class on `<html>`.
All tokens defined in tailwind.config.ts — always use tokens, never hardcode hex.

---

## Environment Variables Required
```
DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
RESEND_API_KEY
GEMINI_API_KEY
NEXT_PUBLIC_APP_URL
ADMIN_EMAIL
```

---

## Key Business Logic Reminders
- Mastery score = Base Score × Recency Multiplier. Never store only one component.
- SRS scheduling and mastery score are SEPARATE systems — both update after every answer.
- Leaderboard data is server-authoritative — never accept point values from client.
- Weekly leaderboard resets every Sunday midnight UTC via cron job.
- Phase 1 cut-off date is stored in DB (configurable by Admin) — check it on every registration.
- Ultimate Achievements are invisible until Admin toggles them ON — never hint at them.
