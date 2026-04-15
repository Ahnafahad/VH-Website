/**
 * LexiCore — Daily AI Message
 *
 * Generates a personalized message once per day in L's voice:
 * analytical, specific, advice-giving, referencing exact user data.
 * Primary: DeepSeek API. Fallback: 15 situation-aware templates.
 * Cached in vocabUserProgress (dailyMessage + dailyMessageDate).
 */

import { db, users, vocabUserProgress, vocabUserWordRecords } from '@/lib/db';
import { eq, count } from 'drizzle-orm';
import { FREE_WORD_POOL, PAID_WORD_POOL } from './constants';

// ─── Stats ───────────────────────────────────────────────────────────────────

interface UserStats {
  name:               string;
  streakDays:         number;
  totalPoints:        number;
  masteredCount:      number;
  learningCount:      number;
  totalWords:         number;
  daysOnPlatform:     number;
  daysSinceLastStudy: number | null;  // null = never studied
  requiredPace:       number | null;  // words/day to hit deadline; null = no deadline
  daysUntilDeadline:  number | null;
  remainingWords:     number;
  pool:               number;
}

async function getUserStats(userId: number, userName: string, createdAt: Date): Promise<UserStats> {
  const [progress, masteryRows] = await Promise.all([
    db.select({
      streakDays:    vocabUserProgress.streakDays,
      totalPoints:   vocabUserProgress.totalPoints,
      lastStudyDate: vocabUserProgress.lastStudyDate,
      deadline:      vocabUserProgress.deadline,
      phase:         vocabUserProgress.phase,
    })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, userId))
      .limit(1)
      .then(r => r[0]),

    db.select({ level: vocabUserWordRecords.masteryLevel, cnt: count() })
      .from(vocabUserWordRecords)
      .where(eq(vocabUserWordRecords.userId, userId))
      .groupBy(vocabUserWordRecords.masteryLevel),
  ]);

  const breakdown: Record<string, number> = {};
  for (const r of masteryRows) breakdown[r.level] = r.cnt;

  const masteredCount    = (breakdown['mastered'] ?? 0) + (breakdown['strong'] ?? 0);
  const learningCount    = (breakdown['learning'] ?? 0) + (breakdown['familiar'] ?? 0);
  const totalWords       = Object.values(breakdown).reduce((s, n) => s + n, 0);
  const daysOnPlatform   = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000));
  const pool             = (progress?.phase ?? 2) === 1 ? PAID_WORD_POOL : FREE_WORD_POOL;
  const remainingWords   = Math.max(0, pool - masteredCount);

  const daysSinceLastStudy = progress?.lastStudyDate
    ? Math.floor((Date.now() - progress.lastStudyDate.getTime()) / 86_400_000)
    : null;

  let requiredPace: number | null = null;
  let daysUntilDeadline: number | null = null;
  if (progress?.deadline) {
    const msLeft = progress.deadline.getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / 86_400_000);
    if (daysLeft > 0) {
      daysUntilDeadline = daysLeft;
      requiredPace = Math.max(1, Math.ceil(remainingWords / daysLeft));
    }
  }

  return {
    name: userName.split(' ')[0],
    streakDays:    progress?.streakDays ?? 0,
    totalPoints:   progress?.totalPoints ?? 0,
    masteredCount,
    learningCount,
    totalWords,
    daysOnPlatform,
    daysSinceLastStudy,
    requiredPace,
    daysUntilDeadline,
    remainingWords,
    pool,
  };
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

async function generateWithDeepSeek(s: UserStats): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const deadlineContext = s.daysUntilDeadline !== null && s.requiredPace !== null
    ? `Deadline: ${s.daysUntilDeadline} days away. Required pace: ${s.requiredPace} words/day to finish ${s.remainingWords} remaining words.`
    : 'No deadline set.';

  const absenceContext = s.daysSinceLastStudy !== null && s.daysSinceLastStudy > 1
    ? `Last studied ${s.daysSinceLastStudy} days ago.`
    : s.daysSinceLastStudy === 0
      ? 'Already studied today.'
      : 'Has never studied.';

  const prompt = `You are L — the eccentric detective from Death Note. You are now the voice of LexiCore, a vocabulary learning platform. You observe users analytically and speak with calm precision.

Generate a single 1-2 sentence message for a user named ${s.name}.

Their stats:
- Streak: ${s.streakDays} days
- ${absenceContext}
- Words mastered/strong: ${s.masteredCount} of ${s.pool}
- Words in progress: ${s.learningCount}
- Total encountered: ${s.totalWords}
- Days on platform: ${s.daysOnPlatform}
- ${deadlineContext}

Rules:
- Sound like L: analytical, slightly detached, oddly perceptive. Not warm, not cold. Precise.
- Reference their specific numbers.
- Give actual advice about what they should do today (review weak words, start new ones, they're behind, etc.)
- If they've been absent: acknowledge it specifically. Say what that means for their pace.
- If deadline is close with high required pace: state it plainly, it should feel slightly alarming.
- Max 35 words. No emojis. No quotes.`;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       'deepseek-chat',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens:  120,
    }),
  });

  if (!response.ok) throw new Error(`DeepSeek ${response.status}`);

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response');
  return text.replace(/^["']|["']$/g, '');
}

// ─── Templates (L-voiced, situation-aware) ────────────────────────────────────

const TEMPLATES: Array<(s: UserStats) => string> = [
  // Long absence with deadline
  (s) => s.daysSinceLastStudy !== null && s.daysSinceLastStudy > 3 && s.requiredPace !== null
    ? `${s.daysSinceLastStudy} days. I noticed. Your required pace is now ${s.requiredPace} words per day. I'd begin immediately.`
    : s.daysSinceLastStudy !== null && s.daysSinceLastStudy > 3
      ? `${s.daysSinceLastStudy} days of absence. The words you were learning have already started fading. I'd begin with a review.`
      : `${s.streakDays > 0 ? `${s.streakDays} consecutive days.` : `Starting fresh today.`} ${s.requiredPace !== null ? `${s.requiredPace} words per day is the current target.` : `Consistency is the variable that matters most.`}`,

  // Deadline pressure with exact numbers
  (s) => s.daysUntilDeadline !== null && s.requiredPace !== null
    ? `${s.remainingWords} words remain. ${s.daysUntilDeadline} days. That is ${s.requiredPace} per day — ${s.requiredPace > 20 ? `with no room for missed sessions.` : `manageable, if you don't stop.`}`
    : `${s.masteredCount} of ${s.pool} words mastered. The gap is ${s.remainingWords}. Set a deadline and I can tell you exactly what that requires.`,

  // Streak observation
  (s) => s.streakDays >= 7
    ? `${s.streakDays} days without interruption. I find consistency more telling than raw effort. Today, focus on the ${s.learningCount} words still in progress.`
    : s.streakDays > 0
      ? `${s.streakDays} days. The pattern is forming. Don't break it — the words you're learning now are at the most fragile stage.`
      : `No active streak. That is data, not a verdict. Starting today still changes your outcome.`,

  // Learning pile advice
  (s) => s.learningCount > 10
    ? `${s.learningCount} words are partially learned — closer to mastery than anything new. Reviewing them today is more efficient than starting fresh ones.`
    : `${s.masteredCount} words locked in permanently. The remaining ${s.remainingWords} are what stand between you and exam readiness.`,

  // Return after short gap
  (s) => s.daysSinceLastStudy !== null && s.daysSinceLastStudy > 1 && s.daysSinceLastStudy <= 3
    ? `${s.daysSinceLastStudy} days since the last session. Start with a review before new words — memory decay is faster than most people expect.`
    : `You've already studied today. If you have time, weak words benefit disproportionately from a second session.`,

  // High urgency pace
  (s) => s.requiredPace !== null && s.requiredPace > 20
    ? `${s.requiredPace} words per day. That is aggressive. It requires studying every day from this point forward without exception.`
    : s.requiredPace !== null
      ? `${s.requiredPace} words per day to finish by your deadline. That is achievable. The question is whether you'll actually maintain it.`
      : `No deadline means no urgency, which generally means slower progress. I'd recommend setting one.`,

  // Mastery progress
  (s) => `You've mastered ${s.masteredCount} of ${s.pool} words. ${s.daysUntilDeadline !== null ? `At ${s.requiredPace} per day, you'll close the remaining ${s.remainingWords} by your deadline.` : `The remaining ${s.remainingWords} are what the exam will test.`}`,

  // Near-miss advice
  (s) => s.totalWords > 0
    ? `The words you nearly got right last time are your highest-value targets today. Near-misses are more useful than complete unknowns.`
    : `You haven't started yet. I've been waiting. The first session is the most consequential one.`,

  // Long tenure observation
  (s) => s.daysOnPlatform > 30
    ? `${s.daysOnPlatform} days on this platform. ${s.masteredCount} words mastered. The trajectory is what matters — ${s.requiredPace !== null ? `${s.requiredPace}/day from here.` : `keep it consistent.`}`
    : `${s.daysOnPlatform} days in. Early patterns are the most predictive. What you do now tends to determine what you do later.`,

  // Streak break acknowledgment
  (s) => s.streakDays === 0 && s.totalWords > 0
    ? `Your streak broke. That is recoverable. What matters is whether today becomes day one of the next one.`
    : `${s.streakDays}-day streak intact. The SRS system is calibrated for exactly this consistency — don't interrupt it.`,

  // Points reframe
  (s) => `${s.totalPoints} points. Points reflect effort, not readiness. Readiness is ${s.masteredCount} mastered words out of ${s.pool}. Focus on that ratio.`,

  // No deadline prompt
  (s) => s.daysUntilDeadline === null
    ? `You haven't set a deadline. Unconstrained timelines tend to expand indefinitely. I'd pick a date — it changes how the brain processes urgency.`
    : `${s.daysUntilDeadline} days left. ${s.requiredPace} per day. I'd start with the words that have been in your learning pile the longest.`,

  // Exam prep connection
  (s) => s.requiredPace !== null
    ? `Vocabulary is a measurable component of your exam score. You need ${s.requiredPace} words per day. That is the number I'd hold in mind today.`
    : `The exam tests recognition under time pressure, not leisurely recall. Short daily sessions train the right kind of memory.`,

  // Returning after very long gap
  (s) => s.daysSinceLastStudy !== null && s.daysSinceLastStudy > 14
    ? `${s.daysSinceLastStudy} days. Some of what you learned will have faded. Begin with familiar words — rebuilding is faster than starting over.`
    : `${s.masteredCount} words are permanent now. The ${s.learningCount} in progress are not — they still need today's session.`,

  // Closing in on goal
  (s) => s.masteredCount > 0 && s.remainingWords < s.masteredCount
    ? `You've mastered more than half your pool. The final stretch is where most people slow down. ${s.requiredPace !== null ? `${s.requiredPace}/day will finish it.` : `Don't.`}`
    : `${s.masteredCount} mastered, ${s.remainingWords} remaining. The curve of acquisition accelerates as familiarity builds — the remaining words will come faster.`,

  // Probability framing
  (s) => `The probability of encountering at least one of your ${s.remainingWords} unmastered words on the exam is higher than you'd like. I'd treat that as the actual reason to study today.`,

  // Wry sweets reference (L's quirk)
  (s) => `I find studying vocabulary more productive than most alternatives I've considered. You have ${s.requiredPace !== null ? `${s.requiredPace} words` : `some words`} to cover today. I'd begin.`,

  // Tracking observation
  (s) => `I've been observing your pattern for ${s.daysOnPlatform} days. You perform best when you have a specific number to target. Today's number: ${s.requiredPace ?? (s.learningCount > 0 ? Math.min(s.learningCount, 10) : 5)}.`,

  // Deduction-style
  (s) => `${s.streakDays > 0 ? `${s.streakDays}-day streak.` : `No streak.`} ${s.masteredCount} mastered. ${s.learningCount} in progress. The logical sequence today is review before new acquisition.`,

  // Exam doesn't negotiate
  (s) => s.daysUntilDeadline !== null && s.daysUntilDeadline < 30
    ? `${s.daysUntilDeadline} days. The exam doesn't negotiate on timing. I'd focus on the words you've been avoiding.`
    : `The exam will test exactly the words you've been skipping. I find that worth considering.`,

  // Reading speed framing
  (s) => `Vocabulary affects reading speed more than most students account for. Each of your ${s.masteredCount} mastered words is a sentence where your brain doesn't pause. The exam is timed.`,

  // Irreversibility of progress
  (s) => `${s.masteredCount > 0 ? `${s.masteredCount} words permanently encoded.` : `No words mastered yet.`} That number is irreversible. Whatever happens today, that progress cannot be undone. Add to it.`,

  // Curious observation
  (s) => `I find it notable that you're here with ${s.remainingWords} words still remaining. That suggests something. I'd use that impulse — it tends to be more transient than it feels.`,

  // Optimal sequence
  (s) => `Today's most efficient sequence: review ${Math.min(s.learningCount > 0 ? s.learningCount : 5, 10)} words you already know partially, then ${Math.max(1, (s.requiredPace ?? 5) - Math.min(s.learningCount > 0 ? s.learningCount : 5, 10))} new ones. In that order.`,

  // Slightly unsettling precision
  (s) => s.daysSinceLastStudy !== null && s.daysSinceLastStudy > 0
    ? `You were absent for ${s.daysSinceLastStudy} ${s.daysSinceLastStudy === 1 ? 'day' : 'days'}. I don't say that to make you feel bad. I say it because the SRS clock kept running while you were gone.`
    : `You're here. I've found that the students who show up consistently tend to surprise themselves. Today is more important than it looks.`,
];

function generateFromTemplate(s: UserStats): string {
  const idx = Math.floor(Math.random() * TEMPLATES.length);
  return TEMPLATES[idx](s);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getDailyMessage(
  email: string,
): Promise<{ message: string; isNew: boolean }> {
  const today = new Date().toISOString().slice(0, 10);

  const [user] = await db
    .select({ id: users.id, name: users.name, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) throw new Error('User not found');

  const [progress] = await db
    .select({
      dailyMessage:     vocabUserProgress.dailyMessage,
      dailyMessageDate: vocabUserProgress.dailyMessageDate,
    })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

  if (progress?.dailyMessageDate === today && progress.dailyMessage) {
    return { message: progress.dailyMessage, isNew: false };
  }

  const stats = await getUserStats(user.id, user.name, user.createdAt);

  let message: string;
  try {
    message = await generateWithDeepSeek(stats);
  } catch {
    message = generateFromTemplate(stats);
  }

  await db
    .update(vocabUserProgress)
    .set({ dailyMessage: message, dailyMessageDate: today })
    .where(eq(vocabUserProgress.userId, user.id));

  return { message, isNew: true };
}
