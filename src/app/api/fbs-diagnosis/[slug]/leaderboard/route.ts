/**
 * GET /api/fbs-diagnosis/[slug]/leaderboard
 * Public leaderboard + instructor benchmark for one FBS diagnostic assessment.
 * Considers only SUBMITTED attempts. Students form the leaderboard; staff
 * (admin/super_admin/instructor) form the "instructor benchmark". No answers,
 * no emails — names are privacy-reduced to first name + last initial.
 */

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests, testAttempts, users } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { computeRanks } from '@/lib/tests/scoring';

const STAFF_ROLES = new Set(['admin', 'super_admin', 'instructor']);

function shortName(fullName: string | null): string {
  const base = (fullName ?? '').trim();
  if (!base) return 'Student';
  const parts = base.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const { slug } = await params;

    const test = await db.select().from(tests).where(eq(tests.slug, slug)).get();
    if (!test || !test.isDiagnostic) {
      throw new ApiException('Diagnostic test not found', 404, 'TEST_NOT_FOUND');
    }
    // Diagnostics are scored over the 4 ATTEMPTED sections (2 compulsory + 2
    // chosen × 10 marks = 40), not the test's nominal 50. Denominator is 40.
    const attemptedMarks = 40;
    const pct = (score: number) => (attemptedMarks > 0 ? round2((score / attemptedMarks) * 100) : 0);

    const rows = await db.select({
      attemptId: testAttempts.id,
      totalScore: testAttempts.totalScore,
      name: users.name,
      role: users.role,
    })
      .from(testAttempts)
      .innerJoin(users, eq(testAttempts.userId, users.id))
      .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.status, 'submitted')));

    const students = rows.filter(r => !STAFF_ROLES.has(r.role));
    const staff = rows.filter(r => STAFF_ROLES.has(r.role));

    // Leaderboard — students only, ranked, top 20.
    const ranks = computeRanks(
      students.map(s => ({ attemptId: s.attemptId, totalScore: s.totalScore ?? 0 })),
    );
    const rankById = new Map(ranks.map(r => [r.attemptId, r.rank]));
    const leaderboard = students
      .map(s => {
        const score = s.totalScore ?? 0;
        return {
          rank: rankById.get(s.attemptId) ?? 0,
          name: shortName(s.name),
          score,
          percentage: pct(score),
          isStaff: false as const,
        };
      })
      .sort((a, b) => a.rank - b.rank || b.score - a.score)
      .slice(0, 20);

    // Instructor benchmark — staff attempts.
    const staffScores = staff.map(s => s.totalScore ?? 0);
    const benchmark = {
      staffCount: staff.length,
      best: staffScores.length ? Math.max(...staffScores) : null,
      average: staffScores.length
        ? round2(staffScores.reduce((a, b) => a + b, 0) / staffScores.length)
        : null,
      entries: staff
        .map(s => {
          const score = s.totalScore ?? 0;
          return { name: shortName(s.name), score, percentage: pct(score) };
        })
        .sort((a, b) => b.score - a.score),
    };

    return {
      test: { slug: test.slug, title: test.title, totalMarks: attemptedMarks },
      totalTakers: students.length,
      leaderboard,
      benchmark,
    };
  });
}
