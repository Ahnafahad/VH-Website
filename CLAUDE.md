# VH Website — Claude Context

## What This Project Is
An educational coaching platform for Bangladesh university admissions (IBA DU, BUP, FBS).
Built with Next.js 15, React 19, TypeScript, Tailwind CSS, Turso (libSQL) via Drizzle ORM, and NextAuth v4.

## Most Important Files (start here when looking for anything)
- src/lib/db/index.ts — database client, used by every API route
- src/lib/api-utils.ts — safeApiHandler, validateAuth, ApiException
- src/lib/auth.ts — NextAuth config and getServerSession
- src/lib/db/schema.ts — all 21 database tables defined here
- src/lib/utils.ts — cn() utility for class merging
- src/lib/db-access-control.ts — access control and role checks
- src/middleware.ts — route protection

## Project Structure Summary
- src/app/api/ — 65 API routes organized by feature (vocab, math, admin, workbook, etc.)
- src/app/vocab/ — main vocab module with study, practice, leaderboard, profile, onboarding
- src/app/admin/ — 6 admin pages
- src/components/ — organized by feature (math, vocab, landing, admin, ui)
- src/lib/ — all shared logic, database, utilities
- public/data/ — large JSON files for mock tests and accounting questions

## Modules
- LexiCore (vocab game) — study, flashcards, practice, quiz, leaderboard, badges, SRS engine
- Mental Math game
- FBS Accounting game
- Mock Tests (IBA, BUP, FBS)
- Workbook
- Admin panel
- Eligibility checker

## Database
Turso (libSQL) with Drizzle ORM. Schema is in src/lib/db/schema.ts — 21 tables.

## When I ask about a feature, check these folders first
- API logic → src/app/api/[feature]/
- UI → src/components/[feature]/
- Shared logic → src/lib/[feature]/
- Pages → src/app/[feature]/

## Architecture Graph
A knowledge graph of this codebase lives at:
- graphify-out/GRAPH_REPORT.md — read this first to understand the architecture
- graphify-out/graph.json — full graph data if you need specific connections

Before exploring files, read graphify-out/GRAPH_REPORT.md to orient yourself.
When asked about a feature, check the graph first before opening files.
