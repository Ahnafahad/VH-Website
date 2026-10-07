/**
 * Spider-chart metrics for the student results hero: the viewer vs the average of the cohort's
 * top 5, on five 0–100 axes. Pure (no DB) so it is unit-tested.
 */

export interface RadarAxis { key: string; label: string; me: number; top5: number }

export interface RadarAttempt {
  attemptId: number;
  score: number;
  /** questionId → selected option key (null / missing = skipped) */
  selected: Map<number, string | null>;
}

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeRadar(args: {
  questionIds: number[];
  correctKey: Map<number, string | null>;
  cohort: RadarAttempt[];
  /** attempt ids of the top 5 by rank */
  topAttemptIds: number[];
  myAttemptId: number;
  totalMarks: number;
}): RadarAxis[] | null {
  const { questionIds, correctKey, cohort, topAttemptIds, myAttemptId, totalMarks } = args;
  const me = cohort.find(a => a.attemptId === myAttemptId);
  const top = cohort.filter(a => topAttemptIds.includes(a.attemptId));
  if (!me || top.length === 0 || cohort.length < 2 || questionIds.length === 0) return null;

  // Difficulty is relative to this cohort: easiest / hardest third of questions by class accuracy.
  const classRate = new Map(questionIds.map(q => [
    q, cohort.filter(a => a.selected.get(q) && a.selected.get(q) === correctKey.get(q)).length / cohort.length,
  ]));
  const byEase = [...questionIds].sort((a, b) => classRate.get(b)! - classRate.get(a)!);
  const third = Math.max(1, Math.floor(questionIds.length / 3));
  const easy = byEase.slice(0, third);
  const hard = byEase.slice(-third);

  const metrics = (a: RadarAttempt) => {
    const isRight = (q: number) => !!a.selected.get(q) && a.selected.get(q) === correctKey.get(q);
    const answered = questionIds.filter(q => a.selected.get(q)).length;
    const correct = questionIds.filter(isRight).length;
    return {
      score:    Math.min(100, Math.max(0, pct(a.score, totalMarks))),
      accuracy: pct(correct, answered),
      attempt:  pct(answered, questionIds.length),
      easy:     pct(easy.filter(isRight).length, easy.length),
      hard:     pct(hard.filter(isRight).length, hard.length),
    };
  };

  const mine = metrics(me);
  const tops = top.map(metrics);
  const axis = (key: keyof typeof mine, label: string): RadarAxis => ({
    key, label, me: round1(mine[key]), top5: round1(mean(tops.map(t => t[key]))),
  });
  return [
    axis('score', 'Score'),
    axis('accuracy', 'Accuracy'),
    axis('attempt', 'Attempt rate'),
    axis('easy', 'Sure shots'),
    axis('hard', 'Hard hits'),
  ];
}
