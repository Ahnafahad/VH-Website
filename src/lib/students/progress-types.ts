/**
 * Shared contract for the admin/instructor "Students Progress" feature.
 *
 * These types are the single source of truth shared by:
 *   - the data layer      → src/lib/students/progress.ts
 *   - the API routes       → src/app/api/admin/students/route.ts
 *                            src/app/api/admin/students/[id]/route.ts
 *   - the UI               → src/app/admin/students/** + src/components/admin/students/**
 *
 * API envelope (both routes): { success: true, ...payload } on 200,
 * { error: string } on failure (createErrorResponse). Access is limited to
 * roles: 'admin' | 'super_admin' | 'instructor'.
 *
 * GET /api/admin/students            → BatchListResponse (all batches + counts)
 * GET /api/admin/students?batch=X    → BatchSummaryResponse (students in batch X)
 * GET /api/admin/students/[id]       → StudentDetailResponse (one student deep-dive)
 */

// ─── List view (batch selector + summary table) ───────────────────────────────

export interface BatchOption {
  /** the users.batch string, e.g. "2026-27" */
  batch:        string;
  studentCount: number;
}

export interface BatchListResponse {
  batches:        BatchOption[];
  /** batch the API suggests selecting first (most populated), null if none */
  defaultBatch:   string | null;
}

/** One row in the summary table for a selected batch. No rank here (summary only). */
export interface StudentSummary {
  id:               number;
  name:             string;
  email:            string;
  studentId:        string | null;
  products:         string[];              // e.g. ["iba"]
  /** 0–100, over completed applicable sessions; null if no sessions apply yet */
  attendancePercent: number | null;
  attendedSessions:  number;
  totalSessions:     number;
  /** most recent test with visible results the student attempted; null if none */
  lastTest:         StudentSummaryLastTest | null;
  /** vocabUserProgress.totalPoints (lifetime), 0 if no LexiCore progress */
  lexicorePoints:   number;
}

export interface StudentSummaryLastTest {
  testId:      number;
  title:       string;
  /** ISO string of when it was taken (submittedAt) */
  takenAt:     string;
  score:       number;
  totalMarks:  number;
  percentage:  number;                     // 0–100
}

export interface BatchSummaryResponse {
  batch:    string;
  students: StudentSummary[];
}

// ─── Detail view (per-student deep-dive) ──────────────────────────────────────

export interface StudentProfile {
  id:        number;
  name:      string;
  email:     string;
  studentId: string | null;
  batch:     string | null;
  products:  string[];
  role:      string;
  status:    string;
  joinedAt:  string;                       // ISO
}

/** Headline KPI strip shown at the top of the detail page (the "overview"). */
export interface StudentOverview {
  attendancePercent: number | null;
  attendedSessions:  number;
  totalSessions:     number;
  testsTaken:        number;
  avgTestPercentage: number | null;        // mean of per-test percentages
  bestRank:          number | null;        // best (lowest) rank achieved
  lexicorePoints:    number;
  wordsMastered:     number;
  streakDays:        number;
}

export interface StudentTestResult {
  testId:        number;
  slug:          string;
  title:         string;
  takenAt:       string;                   // ISO (submittedAt)
  mode:          string;                   // 'online' | 'offline'
  score:         number;
  totalMarks:    number;
  percentage:    number;                   // 0–100
  rank:          number;
  totalStudents: number;                   // cohort size that took this test
  classAverage:  number;                   // mean raw score
  top5Average:   number;
  highest:       number;
  totalCorrect:  number;
  totalWrong:    number;
  totalUnattempted: number;
  sections:      StudentTestSection[];
}

export interface StudentTestSection {
  title:      string;
  score:      number;
  totalMarks: number;
  percentage: number;                      // 0–100 (0 if section has no marks)
  correct:    number;
  wrong:      number;
  unattempted:number;
}

/** Aggregated weakest sections across all the student's tests (by title). */
export interface WeakSection {
  title:          string;
  accuracyPercent:number;                  // correct / (correct+wrong), 0–100
  correct:        number;
  wrong:          number;
  testsCount:     number;                  // how many tests contributed
}

export interface AttendanceBreakdown {
  overallPercent: number | null;
  attended:       number;
  total:          number;
  bySubject:      AttendanceBySubject[];
  recent:         AttendanceSession[];     // most recent completed sessions, newest first
}

export interface AttendanceBySubject {
  subject:  string;
  attended: number;
  total:    number;
  percent:  number | null;
}

export interface AttendanceSession {
  sessionId:   number;
  title:       string;
  subject:     string;
  scheduledAt: string;                     // ISO
  attended:    boolean;
  /** how they attended, when attended === true; null when absent */
  mode:        string | null;
}

/** LexiCore earnings & mastery breakdown. "words" = points from learning words. */
export interface LexicoreBreakdown {
  totalPoints:      number;
  /** points earned answering quiz questions (sum vocab_quiz_answers.pointsEarned) */
  quizPoints:       number;
  /** points attributed to completing/learning words (flashcards + exposure) */
  wordPoints:       number;
  quizzesCompleted: number;
  quizAccuracy:     number | null;         // 0–100 over all quiz answers
  wordsMastered:    number;
  wordsSeen:        number;                // distinct words with a record
  streakDays:       number;
  longestStreak:    number;
  weeklyPoints:     number;
  /** null if the student never started LexiCore */
  hasProgress:      boolean;
}

export interface StudentDetailResponse {
  profile:      StudentProfile;
  overview:     StudentOverview;
  tests:        StudentTestResult[];       // newest first
  weakSections: WeakSection[];             // weakest first, capped ~5
  attendance:   AttendanceBreakdown;
  lexicore:     LexicoreBreakdown;
}
