/**
 * /admin/leaderboard — LexiCore Leaderboard Management
 *
 * Server Component. Fetches:
 *   - Weekly leaderboard from vocab_weekly_leaderboard joined with users
 *   - All-time leaderboard from vocab_user_progress ordered by totalPoints desc
 *   - Hall of Fame sessions from vocab_hall_of_fame grouped by sessionLabel
 *
 * Passes data to LeaderboardClient for interactive reset modal.
 * Admin layout.tsx provides auth guard + sidebar — no duplicate check needed.
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  users,
  vocabUserProgress,
  vocabWeeklyLeaderboard,
  vocabHallOfFame,
} from '@/lib/db/schema';
import LeaderboardClient from '@/components/admin/LeaderboardClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank:        number;
  userId:      number;
  displayName: string;
  email:       string;
  points:      number;
}

export interface HofSession {
  sessionLabel: string;
  weekEndDate:  string;   // ISO string
  createdAt:    string;   // ISO string for ordering
  entries: {
    rank:        number;
    displayName: string;
    points:      number;
  }[];
}

// ─── Data fetching helpers ────────────────────────────────────────────────────

async function fetchWeeklyLeaderboard(): Promise<LeaderboardEntry[]> {
  // Get the most recent week_start to show only the current week
  const rows = await db
    .select({
      userId:   vocabWeeklyLeaderboard.userId,
      points:   vocabWeeklyLeaderboard.points,
      name:     users.name,
      email:    users.email,
      weekStart: vocabWeeklyLeaderboard.weekStart,
    })
    .from(vocabWeeklyLeaderboard)
    .innerJoin(users, eq(vocabWeeklyLeaderboard.userId, users.id))
    .orderBy(desc(vocabWeeklyLeaderboard.points))
    .limit(50);

  // Group by most recent weekStart
  if (rows.length === 0) return [];

  const toMs = (d: Date | number): number =>
    d instanceof Date ? d.getTime() : (d as number) * 1000;

  const latestWeekStart = rows.reduce((max, r) => {
    const t = toMs(r.weekStart as Date | number);
    return t > max ? t : max;
  }, 0);

  const filtered = rows.filter(r => {
    return toMs(r.weekStart as Date | number) === latestWeekStart;
  });

  return filtered.map((r, i) => ({
    rank:        i + 1,
    userId:      r.userId,
    displayName: r.name,
    email:       r.email,
    points:      r.points ?? 0,
  }));
}

async function fetchAllTimeLeaderboard(): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      userId:      vocabUserProgress.userId,
      totalPoints: vocabUserProgress.totalPoints,
      name:        users.name,
      email:       users.email,
    })
    .from(vocabUserProgress)
    .innerJoin(users, eq(vocabUserProgress.userId, users.id))
    .orderBy(desc(vocabUserProgress.totalPoints))
    .limit(50);

  return rows.map((r, i) => ({
    rank:        i + 1,
    userId:      r.userId,
    displayName: r.name,
    email:       r.email,
    points:      r.totalPoints ?? 0,
  }));
}

function toIso(d: Date | number | null | undefined): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Date) return d.toISOString();
  // libSQL returns Unix epoch seconds for timestamp columns
  return new Date((d as number) * 1000).toISOString();
}

async function fetchHallOfFame(): Promise<HofSession[]> {
  const rows = await db
    .select({
      sessionLabel: vocabHallOfFame.sessionLabel,
      rank:         vocabHallOfFame.rank,
      displayName:  vocabHallOfFame.displayName,
      points:       vocabHallOfFame.points,
      weekEndDate:  vocabHallOfFame.weekEndDate,
      createdAt:    vocabHallOfFame.createdAt,
    })
    .from(vocabHallOfFame)
    .orderBy(desc(vocabHallOfFame.createdAt));

  // Group by sessionLabel, preserving most recent first
  const sessionMap = new Map<string, HofSession>();

  for (const row of rows) {
    const label = row.sessionLabel;
    if (!sessionMap.has(label)) {
      sessionMap.set(label, {
        sessionLabel: label,
        weekEndDate:  toIso(row.weekEndDate as Date | number),
        createdAt:    toIso(row.createdAt   as Date | number),
        entries: [],
      });
    }
    sessionMap.get(label)!.entries.push({
      rank:        row.rank,
      displayName: row.displayName,
      points:      row.points,
    });
  }

  // Sort entries within each session by rank
  for (const session of sessionMap.values()) {
    session.entries.sort((a, b) => a.rank - b.rank);
  }

  return Array.from(sessionMap.values());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminLeaderboardPage() {
  const [weeklyLeaderboard, allTimeLeaderboard, hallOfFame] = await Promise.all([
    fetchWeeklyLeaderboard(),
    fetchAllTimeLeaderboard(),
    fetchHallOfFame(),
  ]);

  return (
    <LeaderboardClient
      weeklyLeaderboard={weeklyLeaderboard}
      allTimeLeaderboard={allTimeLeaderboard}
      hallOfFame={hallOfFame}
    />
  );
}
