import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { db } from '@/lib/db';
import { tests, testAttempts, users, userAccess } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

// ─── GET /api/admin/diagnosis-fbs ───────────────────────────────────────────────
// Staff-only. Aggregates the 3 FBS diagnostic assessments: how many took each,
// their scores/time, and WHO they are (name + email) — including leads who took
// a diagnostic but never enrolled. Timestamps are epoch ms. No answer keys leak.

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface AssessmentSummary {
  slug: string;
  title: string;
  totalMarks: number;
  totalTakers: number;
  inProgress: number;
  banned: number;
  avgScore: number | null;
  avgPercentage: number | null;
  highest: number | null;
  lowest: number | null;
  avgTimeSpentSeconds: number | null;
}

interface AttemptRow {
  testSlug: string;
  testTitle: string;
  userId: number;
  userName: string;
  userEmail: string;
  role: string;
  isLead: boolean;
  status: string;
  score: number | null;
  percentage: number | null;
  startedAt: number | null;
  submittedAt: number | null;
  timeSpentSeconds: number | null;
  tabLeaveCount: number;
  resetCount: number;
}

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();

    // Diagnostic tests (fbs-diagnostic-1|2|3).
    const diagnosticTests = await db.select().from(tests).where(eq(tests.isDiagnostic, true));
    const testIds = diagnosticTests.map(t => t.id);
    const testById = new Map(diagnosticTests.map(t => [t.id, t]));

    if (testIds.length === 0) {
      return {
        assessments: [],
        attempts: [],
        totals: { uniqueTakers: 0, totalSubmitted: 0, totalLeads: 0 },
      };
    }

    // All attempts on the diagnostic tests.
    const attemptRows = await db.select().from(testAttempts)
      .where(inArray(testAttempts.testId, testIds));

    // Resolve takers (name/email/role).
    const userIds = Array.from(new Set(attemptRows.map(a => a.userId)));
    const userRows = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const userById = new Map(userRows.map(u => [u.id, u]));

    // Active products → lead detection (student with no active product = lead).
    const accessRows = userIds.length
      ? await db.select({ userId: userAccess.userId })
          .from(userAccess)
          .where(and(inArray(userAccess.userId, userIds), eq(userAccess.active, true)))
      : [];
    const usersWithProducts = new Set(accessRows.map(r => r.userId));
    const isLead = (userId: number, role: string) =>
      role === 'student' && !usersWithProducts.has(userId);

    // ── Per-assessment aggregates ──
    const assessments: AssessmentSummary[] = diagnosticTests
      .slice()
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(test => {
        const mine = attemptRows.filter(a => a.testId === test.id);
        const submitted = mine.filter(a => a.status === 'submitted');
        const inProgress = mine.filter(a => a.status === 'in_progress').length;
        const banned = mine.filter(a => a.status === 'banned').length;

        const scores = submitted
          .map(a => a.totalScore)
          .filter((s): s is number => s != null);
        const times = submitted
          .map(a =>
            a.submittedAt && a.startedAt
              ? Math.max(0, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000))
              : null,
          )
          .filter((s): s is number => s != null);

        const avgScore = scores.length
          ? round2(scores.reduce((sum, s) => sum + s, 0) / scores.length)
          : null;
        // Diagnostics are scored over the 4 attempted sections (40 marks), not
        // the nominal totalMarks (50).
        const attemptedMarks = 40;
        const avgPercentage =
          avgScore != null && attemptedMarks > 0
            ? round2((avgScore / attemptedMarks) * 100)
            : null;
        const avgTimeSpentSeconds = times.length
          ? Math.round(times.reduce((sum, s) => sum + s, 0) / times.length)
          : null;

        return {
          slug: test.slug,
          title: test.title,
          totalMarks: test.totalMarks,
          totalTakers: submitted.length,
          inProgress,
          banned,
          avgScore,
          avgPercentage,
          highest: scores.length ? Math.max(...scores) : null,
          lowest: scores.length ? Math.min(...scores) : null,
          avgTimeSpentSeconds,
        };
      });

    // ── Flat attempts list (newest first) ──
    const attempts: AttemptRow[] = attemptRows
      .map(a => {
        const test = testById.get(a.testId)!;
        const user = userById.get(a.userId);
        const role = user?.role ?? 'student';
        const score = a.status === 'submitted' ? a.totalScore ?? null : null;
        // Diagnostics: percentage over the 4 attempted sections (40 marks).
        const percentage =
          score != null ? round2((score / 40) * 100) : null;
        const timeSpentSeconds =
          a.status === 'submitted' && a.submittedAt && a.startedAt
            ? Math.max(0, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000))
            : null;

        return {
          testSlug: test.slug,
          testTitle: test.title,
          userId: a.userId,
          userName: user?.name ?? 'Unknown',
          userEmail: user?.email ?? '',
          role,
          isLead: isLead(a.userId, role),
          status: a.status,
          score,
          percentage,
          startedAt: a.startedAt ? a.startedAt.getTime() : null,
          submittedAt: a.submittedAt ? a.submittedAt.getTime() : null,
          timeSpentSeconds,
          tabLeaveCount: a.tabLeaveCount,
          resetCount: a.resetCount,
        };
      })
      .sort((a, b) => (b.submittedAt ?? b.startedAt ?? 0) - (a.submittedAt ?? a.startedAt ?? 0));

    // ── Totals ──
    const submittedAttempts = attemptRows.filter(a => a.status === 'submitted');
    const leadUserIds = new Set(
      userRows.filter(u => isLead(u.id, u.role)).map(u => u.id),
    );

    const totals = {
      uniqueTakers: userIds.length,
      totalSubmitted: submittedAttempts.length,
      totalLeads: leadUserIds.size,
    };

    return { assessments, attempts, totals };
  }, 'admin/diagnosis-fbs');
}
