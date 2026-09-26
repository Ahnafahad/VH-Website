/**
 * Redline analysis engine — pure functions, no I/O. Turns a student's first-attempt responses
 * into a topic-wise weakness map, an error-pattern profile and a behaviour profile.
 *
 * Nothing here is a bare percent-correct: every response carries a class (mastered / fragile /
 * lucky / slip / gap / misconception, see classify.ts) that folds in confidence, hints, answer
 * changes and the transfer result, and each skill's mastery is an evidence-weighted estimate
 * shrunk toward 50% so a couple of answers can't read as a verdict.
 */

import { CLASS_CREDIT, countSwitches } from './classify';
import { SKILLS, FAMILY_BASE, TRAP_BASE, familyLabel, skillLabel, trapLabel } from './taxonomy';
import type {
  BehaviorStats, Confidence, FamilyStat, LevelPoint, RedlineAnalysis, ResponseClass,
  SkillState, SkillStat, TrapStat, Weakness,
} from './types';

export interface AnalysisResponse {
  questionId: number;
  number: number;
  level: number;
  position: number;
  skillId: string;
  secondarySkills: string[];
  difficultyScore: number;
  correctKey: string;
  selectedKey: string | null;
  isCorrect: boolean;
  klass: ResponseClass;
  confidence: Confidence | null;
  totalTimeMs: number;
  changes: { key: string; t: number }[];
  hint1Ms: number | null;
  hint2Ms: number | null;
  transferKey: string | null;
  transferCorrect: boolean | null;
  errorFamily: string | null;
  trapType: string | null;
  createdAt: number; // epoch seconds
}

const CLASSES: ResponseClass[] = ['mastered', 'fragile', 'lucky', 'slip', 'gap', 'misconception'];
const emptyClasses = (): Record<ResponseClass, number> =>
  ({ mastered: 0, fragile: 0, lucky: 0, slip: 0, gap: 0, misconception: 0 });

const SECONDARY_WEIGHT = 0.4;
const PRIOR = 1; // pseudo-observations at 50%
const MIN_EVIDENCE = 3;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, d = 0) => { const p = 10 ** d; return Math.round(x * p) / p; };
const pct = (x: number) => Math.round(x * 100);

function median(a: number[]): number | null {
  if (a.length === 0) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const rate = (num: number, den: number, minDen: number): number | null => (den >= minDen ? num / den : null);

/** Recent answers count a little more; a wrong answer on an easy item weighs more than on a hard one. */
function weightOf(idx: number, n: number, difficulty: number, credit: number): number {
  const recency = n <= 1 ? 1 : 0.6 + 0.4 * (idx / (n - 1));
  const d = clamp((difficulty - 1) / 4, 0, 1);
  const diff = credit >= 0.5 ? 0.8 + 0.4 * d : 1.2 - 0.4 * d;
  return recency * diff;
}

interface SkillAcc {
  wSum: number; wcSum: number; answered: number; correct: number; wrong: number;
  classes: Record<ResponseClass, number>;
  credits: number[]; // primary-skill credits in answer order, for the trend
  familyCounts: Map<string, number>;
  lastWrong: AnalysisResponse | null;
}
const newAcc = (): SkillAcc => ({
  wSum: 0, wcSum: 0, answered: 0, correct: 0, wrong: 0, classes: emptyClasses(),
  credits: [], familyCounts: new Map(), lastWrong: null,
});

export function buildAnalysis(all: AnalysisResponse[], levelsDone: number): RedlineAnalysis {
  const rs = [...all].sort((a, b) => a.createdAt - b.createdAt || a.level - b.level || a.position - b.position);
  const n = rs.length;
  const classes = emptyClasses();
  const acc = new Map<string, SkillAcc>(SKILLS.map(s => [s.id, newAcc()]));
  let totalW = 0, totalWC = 0;

  rs.forEach((r, i) => {
    classes[r.klass]++;
    const credit = CLASS_CREDIT[r.klass];
    const w = weightOf(i, n, r.difficultyScore, credit);
    totalW += w; totalWC += w * credit;

    const p = acc.get(r.skillId) ?? acc.set(r.skillId, newAcc()).get(r.skillId)!;
    p.wSum += w; p.wcSum += w * credit; p.answered++; p.credits.push(credit);
    p.classes[r.klass]++;
    if (r.isCorrect) p.correct++; else {
      p.wrong++; p.lastWrong = r;
      if (r.errorFamily) p.familyCounts.set(r.errorFamily, (p.familyCounts.get(r.errorFamily) ?? 0) + 1);
    }
    for (const sid of r.secondarySkills) {
      const s = acc.get(sid);
      if (!s) continue;
      s.wSum += w * SECONDARY_WEIGHT; s.wcSum += w * SECONDARY_WEIGHT * credit;
    }
  });

  // ─── Skills ────────────────────────────────────────────────────────────────
  const skills: SkillStat[] = SKILLS.map(def => {
    const a = acc.get(def.id)!;
    const m = (a.wcSum + 0.5 * PRIOR) / (a.wSum + PRIOR);
    const margin = 1.96 * Math.sqrt((m * (1 - m)) / (a.wSum + 2));
    const evidenceOk = a.answered >= 2 && a.wSum >= MIN_EVIDENCE;
    const mastery = round(m * 100);
    const state: SkillState = !evidenceOk ? 'insufficient' : mastery >= 75 ? 'strong' : mastery >= 50 ? 'developing' : 'weak';
    let trend: number | null = null;
    if (a.credits.length >= 9) {
      const third = Math.floor(a.credits.length / 3);
      const avg = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
      trend = round((avg(a.credits.slice(-third)) - avg(a.credits.slice(0, third))) * 100);
    }
    return {
      id: def.id, label: def.label, mastery, margin: round(margin * 100), evidence: round(a.wSum, 1),
      answered: a.answered, correct: a.correct, classes: a.classes, state, trend,
    };
  });

  // ─── Error families & trap types (wrong answers only) ──────────────────────────
  const wrongs = rs.filter(r => !r.isCorrect);
  const famMap = new Map<string, { count: number; sure: number; skills: Map<string, number> }>();
  const trapMap = new Map<string, number>();
  for (const r of wrongs) {
    if (r.errorFamily) {
      const f = famMap.get(r.errorFamily) ?? { count: 0, sure: 0, skills: new Map() };
      f.count++; if (r.confidence === 'sure') f.sure++;
      f.skills.set(r.skillId, (f.skills.get(r.skillId) ?? 0) + 1);
      famMap.set(r.errorFamily, f);
    }
    if (r.trapType) trapMap.set(r.trapType, (trapMap.get(r.trapType) ?? 0) + 1);
  }
  const families: FamilyStat[] = [...famMap].map(([id, f]) => ({
    id, label: familyLabel(id), count: f.count, share: f.count / wrongs.length,
    confidentShare: f.sure / f.count,
    skills: [...f.skills].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s),
  })).sort((a, b) => b.count - a.count);
  const traps: TrapStat[] = [...trapMap].map(([id, count]) => {
    const base = TRAP_BASE[id] ?? 0.15;
    const share = count / wrongs.length;
    return { id, label: trapLabel(id), count, share, baseShare: base, overIndex: round(share / base, 2) };
  }).sort((a, b) => b.count - a.count);

  // ─── Behaviour ───────────────────────────────────────────────────────────────
  const medianTimeMs = median(rs.map(r => r.totalTimeMs).filter(t => t > 0));
  const sure = rs.filter(r => r.confidence === 'sure');
  const sureAcc = rate(sure.filter(r => r.isCorrect).length, sure.length, 5);
  const med = medianTimeMs ?? 0;
  const rushed = med ? wrongs.filter(r => r.totalTimeMs < 0.4 * med).length : 0;
  const slow = med ? rs.filter(r => r.totalTimeMs > 2.2 * med) : [];
  const hinted = rs.filter(r => r.hint1Ms !== null || r.hint2Ms !== null);
  const unhinted = rs.filter(r => r.hint1Ms === null && r.hint2Ms === null);
  const changed = rs.filter(r => countSwitches(r.changes) > 0);
  const steady = rs.filter(r => countSwitches(r.changes) === 0);
  const acc_ = (x: AnalysisResponse[], min: number) => rate(x.filter(r => r.isCorrect).length, x.length, min);
  const talkedOut = rs.filter(r => !r.isCorrect && r.changes.length > 1 && r.changes[0].key === r.correctKey).length;

  let fatigue: BehaviorStats['fatigue'] = null;
  {
    const maxPos = new Map<number, number>();
    for (const r of rs) maxPos.set(r.level, Math.max(maxPos.get(r.level) ?? 0, r.position));
    const early = rs.filter(r => r.position <= Math.ceil(0.4 * (maxPos.get(r.level) ?? 20)));
    const late = rs.filter(r => r.position > Math.floor(0.6 * (maxPos.get(r.level) ?? 20)));
    const e = acc_(early, 20), l = acc_(late, 20);
    if (e !== null && l !== null) fatigue = { early: pct(e), late: pct(l), delta: pct(l) - pct(e) };
  }

  const wrongLetters: Record<string, number> = {};
  for (const r of wrongs) if (r.selectedKey) wrongLetters[r.selectedKey] = (wrongLetters[r.selectedKey] ?? 0) + 1;
  const letterEntries = Object.entries(wrongLetters).sort((a, b) => b[1] - a[1]);
  const letterBias = wrongs.length >= 15 && letterEntries.length && letterEntries[0][1] / wrongs.length >= 0.4
    ? { letter: letterEntries[0][0], share: letterEntries[0][1] / wrongs.length } : null;

  const transferAttempted = wrongs.filter(r => r.transferKey !== null);
  const behavior: BehaviorStats = {
    answered: n,
    guessRate: n ? rs.filter(r => r.confidence === 'guess').length / n : 0,
    sureAccuracy: sureAcc, sureCount: sure.length,
    overconfidence: sureAcc === null ? null : 1 - sureAcc,
    rushedWrongRate: rate(rushed, wrongs.length, 5),
    overthinkRate: n >= 10 ? slow.length / n : null,
    overthinkAccuracy: acc_(slow, 4),
    medianTimeMs,
    hintRate: n ? hinted.length / n : 0,
    hintAccuracy: acc_(hinted, 4), noHintAccuracy: acc_(unhinted, 4),
    changedRate: n ? changed.length / n : 0,
    changedAccuracy: acc_(changed, 4), steadyAccuracy: acc_(steady, 4),
    talkedOutOfCorrect: talkedOut,
    fatigue,
    transfer: { offered: wrongs.length, attempted: transferAttempted.length, correct: transferAttempted.filter(r => r.transferCorrect).length },
    wrongLetters, letterBias,
  };

  // ─── Level trend ───────────────────────────────────────────────────────────────
  const byLevel = new Map<number, AnalysisResponse[]>();
  for (const r of rs) (byLevel.get(r.level) ?? byLevel.set(r.level, []).get(r.level)!).push(r);
  const levelTrend: LevelPoint[] = [...byLevel].sort((a, b) => a[0] - b[0]).map(([level, xs]) => ({
    level,
    accuracy: pct(xs.filter(r => r.isCorrect).length / xs.length),
    avgTimeMs: Math.round(xs.reduce((s, r) => s + r.totalTimeMs, 0) / xs.length),
    masteredShare: pct(xs.filter(r => r.klass === 'mastered').length / xs.length),
  }));

  // ─── Weaknesses ────────────────────────────────────────────────────────────────
  const candidates: Weakness[] = [];
  for (const s of skills) {
    const a = acc.get(s.id)!;
    if (s.state === 'insufficient' || s.state === 'strong' || a.wrong < 2) continue;
    const misShare = a.wrong ? a.classes.misconception / a.wrong : 0;
    const severity = (1 - s.mastery / 100) * Math.min(1, s.evidence / 8) * (1 + 0.5 * misShare);
    const topFam = [...a.familyCounts].sort((x, y) => y[1] - x[1])[0];
    const points = [`Missed ${a.wrong} of ${a.answered} questions in this skill.`];
    if (a.classes.misconception) points.push(`${plural(a.classes.misconception, 'was an answer', 'were answers')} you were sure about, so a rule you trust here is off.`);
    if (a.classes.gap) points.push(`${plural(a.classes.gap, 'was a gap', 'were gaps')}: you were unsure or skipped.`);
    if (a.classes.slip) points.push(`${plural(a.classes.slip, 'was a slip', 'were slips')}: you solved the follow-up question, so you know this rule and missed it under pressure.`);
    const shaky = a.classes.fragile + a.classes.lucky;
    if (shaky) points.push(`${shaky} of your correct answers ${shaky === 1 ? 'was' : 'were'} shaky (unsure, guessed, hinted or changed).`);
    if (topFam && topFam[1] >= 2) points.push(`Most common trap: ${familyLabel(topFam[0]).toLowerCase()} (${topFam[1]} times).`);
    candidates.push({
      kind: 'skill', id: s.id, label: s.label, severity,
      headline: `${s.label} is at ${s.mastery}% mastery`,
      points, whyMiss: null, howCatch: null,
      questionNumbers: rs.filter(r => r.skillId === s.id && !r.isCorrect).slice(-4).map(r => r.number),
      teachQuestionId: a.lastWrong?.questionId ?? null,
    });
  }
  for (const f of families) {
    const base = FAMILY_BASE[f.id] ?? 0.06;
    const over = f.share / base;
    if (f.count < 4 || over < 1.3) continue;
    const severity = 0.55 * Math.min(1, f.count / 10) * Math.min(1, over / 2.5);
    const last = [...wrongs].reverse().find(r => r.errorFamily === f.id) ?? null;
    const points = [
      `You picked this kind of wrong option ${f.count} times, ${pct(f.share)}% of your wrong answers (it makes up ${pct(base)}% of the wrong options offered).`,
    ];
    if (f.confidentShare >= 0.4) points.push(`${pct(f.confidentShare)}% of those came with a Sure rating, which suggests a habit rather than a slip.`);
    candidates.push({
      kind: 'family', id: f.id, label: f.label, severity,
      headline: `Recurring error: ${f.label.toLowerCase()}`,
      points, whyMiss: null, howCatch: null,
      questionNumbers: wrongs.filter(r => r.errorFamily === f.id).slice(-4).map(r => r.number),
      teachQuestionId: last?.questionId ?? null,
    });
  }
  const weaknesses = candidates.sort((a, b) => b.severity - a.severity).slice(0, 5);

  const strengths = skills.filter(s => s.state === 'strong').sort((a, b) => b.mastery - a.mastery).slice(0, 3)
    .map(s => ({ id: s.id, label: s.label, mastery: s.mastery }));

  // ─── Insights ────────────────────────────────────────────────────────────────
  const insights: string[] = [];
  const b = behavior;
  const correctN = rs.filter(r => r.isCorrect).length;
  if (b.overconfidence !== null && b.sureCount >= 8 && b.overconfidence >= 0.25)
    insights.push(`${pct(b.overconfidence)}% of the answers you marked Sure were wrong. Confidence is running ahead of accuracy, so slow down on the questions that feel easy.`);
  if (correctN >= 10 && (classes.fragile + classes.lucky) / correctN >= 0.35)
    insights.push(`${pct((classes.fragile + classes.lucky) / correctN)}% of your correct answers were marked Unsure or Guess, or needed a hint. You know more than you trust; name the rule before you answer.`);
  if (b.rushedWrongRate !== null && b.rushedWrongRate >= 0.3)
    insights.push(`${pct(b.rushedWrongRate)}% of your misses came in under 40% of your usual time. Those are rushed reads, not missing knowledge.`);
  if (talkedOut >= 3)
    insights.push(`${talkedOut} times your first pick was right and you switched to a wrong answer. Change an answer only when you can state the rule that justifies it.`);
  if (b.changedAccuracy !== null && b.steadyAccuracy !== null && b.steadyAccuracy - b.changedAccuracy >= 0.15)
    insights.push(`Answers you changed were right ${pct(b.changedAccuracy)}% of the time against ${pct(b.steadyAccuracy)}% for answers you kept.`);
  if (b.fatigue && b.fatigue.delta <= -10)
    insights.push(`Accuracy drops from ${b.fatigue.early}% early in a level to ${b.fatigue.late}% late in it. Concentration fades over a level; take a breath at question 10.`);
  if (b.hintRate >= 0.15 && b.hintAccuracy !== null && b.noHintAccuracy !== null)
    insights.push(`You opened a hint on ${pct(b.hintRate)}% of questions. With a hint you were right ${pct(b.hintAccuracy)}% of the time, without one ${pct(b.noHintAccuracy)}%.`);
  const trapTop = traps.find(t => t.count >= 5 && t.overIndex >= 1.4);
  if (trapTop) insights.push(`Trap pattern: "${trapTop.label}". You fall for this ${trapTop.overIndex.toFixed(1)}x as often as chance would predict.`);
  if (b.letterBias) insights.push(`${pct(b.letterBias.share)}% of your wrong answers were option ${b.letterBias.letter}. Check that you are choosing on grammar, not on position.`);
  if (b.transfer.attempted >= 4) {
    const t = b.transfer;
    insights.push(t.correct / t.attempted >= 0.6
      ? `After a miss you got ${t.correct} of ${t.attempted} follow-up questions right, so many of your errors are slips in execution rather than missing rules.`
      : `After a miss you got only ${t.correct} of ${t.attempted} follow-up questions right, so the gaps behind your errors are real and worth studying, not just re-attempting.`);
  }

  return {
    answered: n, correct: correctN,
    accuracy: n ? correctN / n : null,
    mastery: n ? round((totalWC / totalW) * 100) : null,
    levelsDone,
    classes, skills, families, traps, behavior, weaknesses, strengths, levelTrend,
    insights: insights.slice(0, 8),
  };
}

export { CLASSES, skillLabel };
