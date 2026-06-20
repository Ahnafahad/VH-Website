'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Check, X, ChevronDown, ChevronUp, Search, AlertTriangle } from 'lucide-react';
import { O_LEVEL_SUBJECTS, A_LEVEL_SUBJECTS, type SubjectOption } from '@/data/igcse-subjects';

// ─── Subject model ──────────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;      // canonical label chosen from the dropdown
  tags: string[];    // category tags copied from the catalogue on selection
  grade: string;
}

// ─── Grades ─────────────────────────────────────────────────────────────────────

const GRADES = ['A*', 'A', 'B', 'C', 'D', 'E'] as const;
const GRADE_RANK: Record<string, number> = { 'A*': 6, A: 5, B: 4, C: 3, D: 2, E: 1, '': 0 };

/** True if `grade` is at least `min` on the GCE letter scale. */
const atLeast = (grade: string, min: string) => (GRADE_RANK[grade] ?? 0) >= (GRADE_RANK[min] ?? 99);

// ─── Grade-point scales (each institution uses its own — never mix) ─────────────

const duPoints:   Record<string, number> = { 'A*': 5.0, A: 5.0, B: 4.0, C: 3.5, D: 0.0, E: 0.0 };
const bupPoints:  Record<string, number> = { 'A*': 5.0, A: 5.0, B: 4.0, C: 3.5, D: 3.0, E: 0.0 };
const bracPoints: Record<string, number> = { 'A*': 5.0, A: 5.0, B: 4.0, C: 3.0, D: 2.0 }; // E excluded
const nsuPoints:  Record<string, number> = { 'A*': 5.0, A: 5.0, B: 4.0, C: 3.0, D: 2.0, E: 1.0 };

// ─── Tag helpers (the wiring layer) ─────────────────────────────────────────────

const clean = (list: Subject[]) => list.filter(s => s.name.trim() && s.grade);
const has = (s: Subject, tag: string) => s.tags?.includes(tag);
/** Find a subject carrying `tag` at grade >= `min` (best grade wins). */
function findTag(list: Subject[], tag: string, min = 'E'): Subject | undefined {
  return list
    .filter(s => has(s, tag) && atLeast(s.grade, min))
    .sort((a, b) => (GRADE_RANK[b.grade] ?? 0) - (GRADE_RANK[a.grade] ?? 0))[0];
}
const hasTag = (list: Subject[], tag: string, min = 'E') => !!findTag(list, tag, min);

/** Best-N average grade-point on a given scale; subjects scoring undefined are skipped. */
function bestAvg(list: Subject[], scale: Record<string, number>, n: number) {
  const pts = list
    .map(s => scale[s.grade])
    .filter((p): p is number => p !== undefined)
    .sort((a, b) => b - a)
    .slice(0, n);
  if (pts.length < n) return { avg: 0, count: pts.length };
  return { avg: pts.reduce((a, b) => a + b, 0) / n, count: pts.length };
}

/** Cumulative grade-distribution counts across the best 7 (5 O + 2 A) subjects. */
function distribution(ol: Subject[], al: Subject[]) {
  const best = [
    ...[...ol].sort((a, b) => (GRADE_RANK[b.grade] ?? 0) - (GRADE_RANK[a.grade] ?? 0)).slice(0, 5),
    ...[...al].sort((a, b) => (GRADE_RANK[b.grade] ?? 0) - (GRADE_RANK[a.grade] ?? 0)).slice(0, 2),
  ];
  const atLeastA = best.filter(s => atLeast(s.grade, 'A')).length;
  const atLeastB = best.filter(s => atLeast(s.grade, 'B')).length;
  const atLeastC = best.filter(s => atLeast(s.grade, 'C')).length;
  return { best, atLeastA, atLeastB, atLeastC };
}

// ─── Result types ───────────────────────────────────────────────────────────────

interface Check { label: string; value?: string; pass: boolean; warn?: boolean }
interface Result {
  eligible: boolean;
  reason: string;
  checks?: Check[];
  info?: string[];
  warn?: boolean;
}
interface SubResult extends Result { label: string; full?: string }
interface GroupResult { grouped: true; eligible: boolean; subResults: SubResult[]; info?: string[] }
type AnyResult = Result | GroupResult;
const isGroup = (r: AnyResult): r is GroupResult => (r as GroupResult).grouped === true;

// ─── Calculators ────────────────────────────────────────────────────────────────

function calcIBA(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Min 5 O-Levels including Mathematics',
    'Min 2 A-Levels (≥1 final result published in 2026)',
    'O-Level & A-Level average GP ≥ 3.5 each (A=5, B=4, C=3.5, D=0)',
    'Min 2 A grades across the 7 counted subjects',
    'DU Equivalence Certificate required before applying',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.', info };
  if (!hasTag(ol, 'math')) return { eligible: false, reason: 'O-Level Mathematics is required.', info };

  const olAvg = bestAvg(ol, duPoints, 5).avg;
  const alAvg = bestAvg(al, duPoints, 2).avg;
  const { atLeastA } = distribution(ol, al);
  const olPass = olAvg >= 3.5, alPass = alAvg >= 3.5, twoA = atLeastA >= 2;
  const eligible = olPass && alPass && twoA;

  return {
    eligible,
    reason: eligible ? 'Meets all IBA (DU) requirements.' : 'Requirements not met.',
    checks: [
      { label: 'O-Level Mathematics present', pass: true },
      { label: 'O-Level avg ≥ 3.5', value: olAvg.toFixed(2), pass: olPass },
      { label: 'A-Level avg ≥ 3.5', value: alAvg.toFixed(2), pass: alPass },
      { label: 'Min 2 A grades (across 7)', value: `${atLeastA} A`, pass: twoA },
    ],
    info,
  };
}

function calcDUFBS(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Min 5 O-Levels + 2 A-Levels',
    'A-Level must include one of Business Studies / Accounting / Economics / Mathematics',
    'O-Level & A-Level average GP ≥ 3.0 each (A=5, B=4, C=3.5, D=0)',
    'Across the 7 counted subjects: ≥4 grades at B or above, and all 7 at C or above',
    'DU Equivalence Certificate required before applying',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.', info };

  const hasBiz = ['business', 'accounting', 'economics', 'math'].some(t => hasTag(al, t));
  const olAvg = bestAvg(ol, duPoints, 5).avg;
  const alAvg = bestAvg(al, duPoints, 2).avg;
  const { atLeastB, atLeastC } = distribution(ol, al);
  const olPass = olAvg >= 3.0, alPass = alAvg >= 3.0;
  const distPass = atLeastB >= 4 && atLeastC >= 7;
  const eligible = hasBiz && olPass && alPass && distPass;

  return {
    eligible,
    reason: eligible ? 'Meets DU FBS requirements.'
      : !hasBiz ? 'A-Level must include Business / Accounting / Economics / Mathematics.'
      : 'GPA or grade-distribution requirements not met.',
    checks: [
      { label: 'A-Level has Business / Acct / Econ / Maths', value: hasBiz ? 'Yes' : 'No', pass: hasBiz },
      { label: 'O-Level avg ≥ 3.0', value: olAvg.toFixed(2), pass: olPass },
      { label: 'A-Level avg ≥ 3.0', value: alAvg.toFixed(2), pass: alPass },
      { label: '≥4 at B+ and all 7 at C+', value: `${atLeastB}·B / ${atLeastC}·C`, pass: distPass },
    ],
    info,
  };
}

function calcDUEcon(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Min 5 O-Levels + 2 A-Levels',
    'O-Level General Mathematics ≥ B (Additional Math alone does NOT satisfy this)',
    'A-Level must include Mathematics or Economics',
    'Across the 7 counted subjects: ≥4 grades at B or above, and all 7 at C or above',
    'Islamic / Household Economics are NOT accepted as Economics',
    'DU Equivalence Certificate required; admission-test English ≥ 16 marks',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.', info };

  const genMathB = hasTag(ol, 'gen-math', 'B');
  const hasMathOrEcon = hasTag(al, 'math') || hasTag(al, 'economics');
  const { atLeastB, atLeastC } = distribution(ol, al);
  const distPass = atLeastB >= 4 && atLeastC >= 7;
  const eligible = genMathB && hasMathOrEcon && distPass;

  return {
    eligible,
    reason: eligible ? 'Meets DU Economics requirements.'
      : !genMathB ? 'O-Level General Mathematics at minimum grade B is required.'
      : !hasMathOrEcon ? 'A-Level must include Mathematics or Economics.'
      : 'Grade-distribution requirement not met.',
    checks: [
      { label: 'O-Level General Mathematics ≥ B', value: genMathB ? 'Yes' : 'No', pass: genMathB },
      { label: 'A-Level has Mathematics or Economics', value: hasMathOrEcon ? 'Yes' : 'No', pass: hasMathOrEcon },
      { label: '≥4 at B+ and all 7 at C+', value: `${atLeastB}·B / ${atLeastC}·C`, pass: distPass },
    ],
    info,
  };
}

function calcDUSci(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Min 5 O-Levels (2021 or later) + 2 A-Levels (2026)',
    'Best 7 subjects: ≥2 A grades, ≥5 at B or above, all 7 at C or above',
    'No D grade accepted in any of the 7 counted subjects',
    'Per-department subject prerequisites also apply (Physics/Chemistry/etc.)',
    'DU Equivalence Certificate required before applying',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.', info };

  const { best, atLeastA, atLeastB, atLeastC } = distribution(ol, al);
  const noD = !best.some(s => s.grade === 'D' || s.grade === 'E');
  const aPass = atLeastA >= 2, bPass = atLeastB >= 5, cPass = atLeastC >= 7 && best.length >= 7;
  const eligible = aPass && bPass && cPass && noD;

  return {
    eligible,
    reason: eligible ? 'Meets DU Science unit requirements (check per-department subjects).'
      : !noD ? 'No D (or lower) grade is accepted in the 7 counted subjects.'
      : 'Grade-distribution requirement not met.',
    checks: [
      { label: 'Min 2 A grades (best 7)', value: `${atLeastA} A`, pass: aPass },
      { label: 'Min 5 at B or above', value: `${atLeastB}`, pass: bPass },
      { label: 'All 7 at C or above', value: `${atLeastC}`, pass: cPass },
      { label: 'No D / E grades', pass: noD },
    ],
    info,
  };
}

function calcBUET(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'O-Level: min 5 subjects, each ≥ B, including Maths, Physics, Chemistry, English',
    'O-Level results November 2022 or later',
    'A-Level: Maths, Physics, Chemistry — two at A and the third at B (minimum)',
    'A-Level results November 2025 or later (or published by 14 Dec 2025)',
    'Final shortlist: top 300 ranked by A-Level Maths & Physics grades',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };

  const oMath = findTag(ol, 'math'), oPhy = findTag(ol, 'physics'),
        oChem = findTag(ol, 'chemistry'), oEng = findTag(ol, 'english');
  const missing = [
    !oMath && 'Mathematics', !oPhy && 'Physics', !oChem && 'Chemistry', !oEng && 'English',
  ].filter(Boolean) as string[];
  if (missing.length) return { eligible: false, reason: `Missing O-Level: ${missing.join(', ')}.`, info };

  const olBplus = ol.filter(s => atLeast(s.grade, 'B')).length;
  const mandatoryBplus = [oMath, oPhy, oChem, oEng].every(s => s && atLeast(s.grade, 'B'));
  const olGradesOk = mandatoryBplus && olBplus >= 5;

  const aMath = findTag(al, 'math'), aPhy = findTag(al, 'physics'), aChem = findTag(al, 'chemistry');
  const core = [aMath, aPhy, aChem];
  if (core.some(s => !s)) return { eligible: false, reason: 'A-Level must include Mathematics, Physics and Chemistry.', info, checks: [
    { label: 'O-Level Maths/Phys/Chem/Eng all ≥ B', value: `${olBplus}/5 at B+`, pass: olGradesOk },
    { label: 'A-Level has Maths, Physics, Chemistry', value: 'No', pass: false },
  ] };

  const aCount = core.filter(s => s && atLeast(s.grade, 'A')).length;
  const bCount = core.filter(s => s && atLeast(s.grade, 'B')).length;
  const aPattern = aCount >= 2 && bCount >= 3;
  const eligible = olGradesOk && aPattern;

  return {
    eligible,
    reason: eligible
      ? 'Meets BUET minimum. Final ranking: top 300 by A-Level Maths/Physics grades.'
      : !olGradesOk ? 'All 5 O-Levels (incl. Maths/Phys/Chem/Eng) must be at minimum B.'
      : 'A-Level needs two A grades and the third at B across Maths/Physics/Chemistry.',
    checks: [
      { label: 'O-Level Maths/Phys/Chem/Eng all ≥ B', value: `${olBplus}/5 at B+`, pass: olGradesOk },
      { label: 'A-Level: 2 A grades in Maths/Phys/Chem', value: `${aCount} A`, pass: aCount >= 2 },
      { label: 'All 3 core science subjects ≥ B', value: `${bCount}/3`, pass: bCount >= 3 },
    ],
    info,
  };
}

function calcBRACBBA(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Min 5 O-Levels + 2 A-Levels',
    'O-Level & A-Level average GPA ≥ 2.5 each (A=5, B=4, C=3, D=2; E not counted)',
    'A-Level completed in 2024 or later',
    'Admission test: English Composition, English MCQ, Mathematics MCQ',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.', info };

  const olR = bestAvg(ol, bracPoints, 5), alR = bestAvg(al, bracPoints, 2);
  const olPass = olR.count >= 5 && olR.avg >= 2.5;
  const alPass = alR.count >= 2 && alR.avg >= 2.5;
  const eligible = olPass && alPass;

  return {
    eligible,
    reason: eligible ? 'Meets BRAC University BBA requirements.' : 'GPA requirements not met.',
    checks: [
      { label: 'O-Level avg ≥ 2.5 (E excluded)', value: olR.avg.toFixed(2), pass: olPass },
      { label: 'A-Level avg ≥ 2.5 (E excluded)', value: alR.avg.toFixed(2), pass: alPass },
    ],
    info,
  };
}

function calcNSUBBA(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Min 5 O-Levels + 2 A-Levels',
    'O-Level average GP ≥ 2.5 (across 5); A-Level average GP ≥ 2.0 (across 2)',
    'A=5, B=4, C=3, D=2, E=1',
    'Only one E grade is acceptable across the combined 7 subjects',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.', info };

  const olR = bestAvg(ol, nsuPoints, 5), alR = bestAvg(al, nsuPoints, 2);
  const { best } = distribution(ol, al);
  const eCount = best.filter(s => s.grade === 'E').length;
  const olPass = olR.avg >= 2.5, alPass = alR.avg >= 2.0, ePass = eCount <= 1;
  const eligible = olPass && alPass && ePass;

  return {
    eligible,
    reason: eligible ? 'Meets NSU BBA requirements.'
      : !ePass ? 'More than one E grade across the 7 counted subjects.'
      : 'GPA requirements not met.',
    checks: [
      { label: 'O-Level avg ≥ 2.5', value: olR.avg.toFixed(2), pass: olPass },
      { label: 'A-Level avg ≥ 2.0', value: alR.avg.toFixed(2), pass: alPass },
      { label: 'At most one E grade (across 7)', value: `${eCount} E`, pass: ePass },
    ],
    info,
  };
}

// BRAC Science — group with one sub-card per program.
const BRAC_SCI_PROGRAMS: { label: string; full: string; reqs: { tag: string; min: string; name: string }[]; note?: string }[] = [
  { label: 'Applied Physics & Electronics', full: 'APE', reqs: [{ tag: 'physics', min: 'C', name: 'Physics' }, { tag: 'math', min: 'C', name: 'Mathematics' }] },
  { label: 'Computer Science & Engineering', full: 'CSE', reqs: [{ tag: 'physics', min: 'C', name: 'Physics' }, { tag: 'math', min: 'C', name: 'Mathematics' }] },
  { label: 'Electrical & Electronic Engineering', full: 'EEE', reqs: [{ tag: 'physics', min: 'C', name: 'Physics' }, { tag: 'math', min: 'C', name: 'Mathematics' }] },
  { label: 'Electronics & Communication Engineering', full: 'ECE', reqs: [{ tag: 'physics', min: 'C', name: 'Physics' }, { tag: 'math', min: 'C', name: 'Mathematics' }] },
  { label: 'Physics', full: 'Physics', reqs: [{ tag: 'physics', min: 'C', name: 'Physics' }, { tag: 'math', min: 'C', name: 'Mathematics' }] },
  { label: 'Computer Science / Mathematics', full: 'CS / Maths', reqs: [{ tag: 'math', min: 'C', name: 'Mathematics' }] },
  { label: 'Biotechnology', full: 'Biotechnology', reqs: [{ tag: 'biology', min: 'C', name: 'Biology' }, { tag: 'chemistry', min: 'C', name: 'Chemistry' }], note: 'Without O/A-Level Maths, a remedial Maths course is required.' },
  { label: 'Microbiology', full: 'Microbiology', reqs: [{ tag: 'biology', min: 'C', name: 'Biology' }, { tag: 'chemistry', min: 'C', name: 'Chemistry' }], note: 'Without O/A-Level Maths, a remedial Maths course is required.' },
  { label: 'Pharmacy', full: 'Pharmacy', reqs: [{ tag: 'chemistry', min: 'B', name: 'Chemistry' }, { tag: 'biology', min: 'B', name: 'Biology' }, { tag: 'math', min: 'C', name: 'Mathematics' }, { tag: 'physics', min: 'C', name: 'Physics' }], note: 'Extra aggregate/recency rules + Pharmacy Council compliance apply — verify on the live page.' },
];

function calcBRACScience(oLevels: Subject[], aLevels: Subject[]): GroupResult {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Common rule: O-Level & A-Level average GPA ≥ 2.5 each (A=5, B=4, C=3, D=2; E excluded)',
    'A-Level completed in 2024 or later',
    'Each program below also requires specific A-Level subjects.',
  ];
  const olR = bestAvg(ol, bracPoints, 5), alR = bestAvg(al, bracPoints, 2);
  const baseOk = ol.length >= 5 && al.length >= 2 && olR.avg >= 2.5 && alR.avg >= 2.5;

  const subResults: SubResult[] = BRAC_SCI_PROGRAMS.map(p => {
    const subjChecks: Check[] = p.reqs.map(req => {
      const found = findTag(al, req.tag, req.min);
      return { label: `A-Level ${req.name} ≥ ${req.min}`, value: found ? found.grade : 'No', pass: !!found };
    });
    const subjOk = subjChecks.every(c => c.pass);
    const eligible = baseOk && subjOk;
    return {
      label: p.label,
      full: p.full,
      eligible,
      warn: p.full === 'Pharmacy' && eligible,
      reason: eligible
        ? (p.note ?? 'Meets requirements for this program.')
        : !baseOk ? 'Common GPA rule (≥ 2.5 each) not met.' : 'Required A-Level subjects not met.',
      checks: [
        { label: 'O-Level avg ≥ 2.5', value: olR.avg.toFixed(2), pass: ol.length >= 5 && olR.avg >= 2.5 },
        { label: 'A-Level avg ≥ 2.5', value: alR.avg.toFixed(2), pass: al.length >= 2 && alR.avg >= 2.5 },
        ...subjChecks,
      ],
    };
  });

  return { grouped: true, eligible: subResults.some(r => r.eligible), subResults, info };
}

function calcJUIBA(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const all = [...ol, ...al];
  const info = [
    'O-Levels 2021 or later; A-Levels 2025 or 2026',
    'Unit rule: across the 7 counted subjects, ≥4 at B+ and all 7 at C+',
    'English at A- or better (grade B accepted)',
    'Plus one of {Higher Maths / Statistics} (Science bg) OR {Accounting / Economics / Maths / Business} (other bg) at A- or better (grade B accepted)',
    'JU states the threshold as A-; IGCSE / IAL / Cambridge A-Level have no A- grade, so it is read leniently as grade B',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.', info };

  const { atLeastB, atLeastC } = distribution(ol, al);
  const distPass = atLeastB >= 4 && atLeastC >= 7;

  // JU's "A-" threshold → grade B (lenient: these qualifications have no A- grade).
  const eng = findTag(all, 'english', 'B');
  const engOk = !!eng;

  const relevantTags = ['math', 'add-math', 'statistics', 'accounting', 'economics', 'business'];
  const rel = relevantTags.map(t => findTag(all, t, 'B')).filter(Boolean)[0] as Subject | undefined;
  const relOk = !!rel;

  const eligible = distPass && engOk && relOk;

  return {
    eligible,
    reason: eligible ? 'Meets IBA-JU requirements.'
      : !engOk ? 'English at A- or better (grade B accepted) is required.'
      : !relOk ? 'A relevant subject (Higher Maths / Statistics / Accounting / Economics / Maths / Business) at A- (grade B accepted) is required.'
      : 'Unit grade-distribution requirement not met.',
    checks: [
      { label: '≥4 at B+ and all 7 at C+', value: `${atLeastB}·B / ${atLeastC}·C`, pass: distPass },
      { label: 'English ≥ A- (B accepted)', value: eng?.grade ?? 'No', pass: engOk },
      { label: 'Relevant subject ≥ A- (B accepted)', value: rel?.grade ?? 'No', pass: relOk },
    ],
    info,
  };
}

function calcBUP(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Min 5 O-Levels + 2 A-Levels (FBS BBA programs)',
    'Combined points of best 5 O + best 2 A must total ≥ 26.5',
    'A*/A = 5.0 · B = 4.0 · C = 3.5 · D = 3.0 · below D not counted',
    'BUP runs its own admission process',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.', info };

  const olPts = ol.map(s => bupPoints[s.grade]).filter(p => p > 0).sort((a, b) => b - a).slice(0, 5);
  const alPts = al.map(s => bupPoints[s.grade]).filter(p => p > 0).sort((a, b) => b - a).slice(0, 2);
  const total = [...olPts, ...alPts].reduce((a, b) => a + b, 0);
  const enough = olPts.length >= 5 && alPts.length >= 2;
  const eligible = enough && total >= 26.5;

  return {
    eligible,
    reason: eligible ? 'Meets BUP FBS requirements.'
      : !enough ? 'Need at least 5 counting O-Levels and 2 A-Levels (grades below D do not count).'
      : `Need ${(26.5 - total).toFixed(1)} more points.`,
    checks: [{ label: 'Combined points ≥ 26.5 (best 5 O + 2 A)', value: total.toFixed(1), pass: eligible }],
    info,
  };
}

function calcMISTEng(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'O-Level: min 5 subjects each ≥ B, including Maths, Physics, Chemistry, English',
    'A-Level: Mathematics, Physics, Chemistry — each ≥ B',
    'Biomedical Engineering (BME): additionally A-Level Biology ≥ C',
    'Architecture: additionally sits the Unit B exam',
    'Attested hardcopy transcripts required; MIST runs its own admission test',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };

  const oMath = findTag(ol, 'math'), oPhy = findTag(ol, 'physics'),
        oChem = findTag(ol, 'chemistry'), oEng = findTag(ol, 'english');
  const missing = [
    !oMath && 'Mathematics', !oPhy && 'Physics', !oChem && 'Chemistry', !oEng && 'English',
  ].filter(Boolean) as string[];
  if (missing.length) return { eligible: false, reason: `Missing O-Level: ${missing.join(', ')}.`, info };

  const olBplus = ol.filter(s => atLeast(s.grade, 'B')).length;
  const mandBplus = [oMath, oPhy, oChem, oEng].every(s => s && atLeast(s.grade, 'B'));
  const olOk = mandBplus && olBplus >= 5;

  const aMathB = hasTag(al, 'math', 'B'), aPhyB = hasTag(al, 'physics', 'B'), aChemB = hasTag(al, 'chemistry', 'B');
  const aOk = aMathB && aPhyB && aChemB;
  const bmeOk = aOk && hasTag(al, 'biology', 'C');
  const eligible = olOk && aOk;

  return {
    eligible,
    reason: eligible ? 'Meets MIST engineering requirements.'
      : !olOk ? 'All 5 O-Levels (incl. Maths/Phys/Chem/Eng) must be at minimum B.'
      : 'A-Level Maths, Physics and Chemistry must each be at minimum B.',
    checks: [
      { label: 'O-Level Maths/Phys/Chem/Eng all ≥ B', value: `${olBplus}/5 at B+`, pass: olOk },
      { label: 'A-Level Maths / Physics / Chemistry ≥ B', value: `${[aMathB, aPhyB, aChemB].filter(Boolean).length}/3`, pass: aOk },
      { label: 'BME bonus: A-Level Biology ≥ C', value: bmeOk ? 'Eligible' : '—', pass: bmeOk, warn: !bmeOk && eligible },
    ],
    info,
  };
}

function calcMISTSci(oLevels: Subject[], aLevels: Subject[]): Result {
  const ol = clean(oLevels), al = clean(aLevels);
  const info = [
    'Programs: BSc Maths & Data Science, BSc Chemistry / Nanoscience',
    'O-Level: Maths, Physics, Chemistry each ≥ B (results 2023 or 2024)',
    'A-Level: Maths, Physics, Chemistry each ≥ B (results 2025 or 2026)',
    'Attested hardcopy transcripts required; MIST Unit C admission test applies',
  ];
  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.', info };

  const oMathB = hasTag(ol, 'math', 'B'), oPhyB = hasTag(ol, 'physics', 'B'), oChemB = hasTag(ol, 'chemistry', 'B');
  const oOk = oMathB && oPhyB && oChemB;
  const aMathB = hasTag(al, 'math', 'B'), aPhyB = hasTag(al, 'physics', 'B'), aChemB = hasTag(al, 'chemistry', 'B');
  const aOk = aMathB && aPhyB && aChemB;
  const eligible = oOk && aOk;

  return {
    eligible,
    reason: eligible ? 'Meets MIST Science (Unit C) requirements.'
      : !oOk ? 'O-Level Maths, Physics and Chemistry must each be at minimum B.'
      : 'A-Level Maths, Physics and Chemistry must each be at minimum B.',
    checks: [
      { label: 'O-Level Maths / Physics / Chemistry ≥ B', value: `${[oMathB, oPhyB, oChemB].filter(Boolean).length}/3`, pass: oOk },
      { label: 'A-Level Maths / Physics / Chemistry ≥ B', value: `${[aMathB, aPhyB, aChemB].filter(Boolean).length}/3`, pass: aOk },
    ],
    info,
  };
}

// ─── University registry ────────────────────────────────────────────────────────

const UNIVERSITIES = [
  { id: 'IBA',     label: 'IBA (DU)',          full: 'Institute of Business Administration, University of Dhaka', calc: calcIBA },
  { id: 'DUFBS',   label: 'DU FBS',            full: 'Faculty of Business Studies, University of Dhaka',          calc: calcDUFBS },
  { id: 'DUEcon',  label: 'DU Economics',      full: 'Economics (B.S.S.), University of Dhaka',                   calc: calcDUEcon },
  { id: 'DUSci',   label: 'DU Science',        full: 'Science Unit, University of Dhaka',                         calc: calcDUSci },
  { id: 'BUET',    label: 'BUET',              full: 'Bangladesh University of Engineering & Technology',          calc: calcBUET },
  { id: 'MISTEng', label: 'MIST Engineering',  full: 'Engineering & Architecture, MIST',                          calc: calcMISTEng },
  { id: 'MISTSci', label: 'MIST Science',      full: 'Science Unit C, MIST',                                      calc: calcMISTSci },
  { id: 'BRACSci', label: 'BRAC Science',      full: 'Science & Engineering programs, BRAC University',            calc: calcBRACScience },
  { id: 'BRACBBA', label: 'BRAC BBA',          full: 'Bachelor of Business Administration, BRAC University',       calc: calcBRACBBA },
  { id: 'NSUBBA',  label: 'NSU BBA',           full: 'Bachelor of Business Administration, North South University', calc: calcNSUBBA },
  { id: 'JUIBA',   label: 'IBA-JU',            full: 'Institute of Business Administration, Jahangirnagar University', calc: calcJUIBA },
  { id: 'BUP',     label: 'BUP',               full: 'FBS BBA Programs, Bangladesh University of Professionals',   calc: calcBUP },
] as const;

type UniId = typeof UNIVERSITIES[number]['id'];

// ─── Subject combobox (predictive, mobile-friendly) ─────────────────────────────

function SubjectCombobox({
  options, value, onSelect, placeholder,
}: {
  options: SubjectOption[];
  value: string;
  onSelect: (opt: SubjectOption) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    return [...base].sort((a, b) => {
      if (q) {
        const as = a.label.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.label.toLowerCase().startsWith(q) ? 0 : 1;
        if (as !== bs) return as - bs;
      }
      if (!!a.popular !== !!b.popular) return a.popular ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [options, q]);

  useEffect(() => { setHi(0); }, [q, open]);

  // Close on outside click / touch.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[hi] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  const choose = (opt: SubjectOption) => {
    onSelect(opt);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) choose(filtered[hi]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FAF5EF]/25 pointer-events-none" />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          placeholder={placeholder}
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={onKeyDown}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#FAF5EF] placeholder-[#FAF5EF]/25 focus:outline-none focus:border-[#D4B094]/50 focus:bg-white/[0.06] transition-all"
        />
      </div>

      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-[#D4B094]/20 bg-[#2A0A0E] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] py-1.5"
        >
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-[#FAF5EF]/40">No subject found.</li>
          )}
          {filtered.map((opt, i) => {
            const selected = opt.label === value;
            return (
              <li key={opt.label}>
                <button
                  type="button"
                  // onMouseDown fires before the input's blur, so the pick always lands.
                  onMouseDown={e => { e.preventDefault(); choose(opt); }}
                  onMouseEnter={() => setHi(i)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    i === hi ? 'bg-[#D4B094]/15 text-[#FAF5EF]' : 'text-[#FAF5EF]/75'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {opt.popular && (
                      <span className="text-[10px] uppercase tracking-wider text-[#D4B094]/60">Popular</span>
                    )}
                    {selected && <Check size={14} className="text-[#D4B094]" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Subject section ────────────────────────────────────────────────────────────

function SubjectSection({
  title, subtitle, subjects, options, onAdd, onRemove, onSelect, onGrade,
}: {
  title: string;
  subtitle: string;
  subjects: Subject[];
  options: SubjectOption[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onSelect: (id: string, opt: SubjectOption) => void;
  onGrade: (id: string, grade: string) => void;
}) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-base font-medium text-[#FAF5EF]">{title}</h3>
        <p className="text-xs text-[#FAF5EF]/40 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-2.5">
        {subjects.map((s, idx) => (
          <div key={s.id} className="flex gap-2.5 sm:gap-3 items-center">
            <div className="w-5 text-center text-xs text-[#FAF5EF]/20 flex-shrink-0">{idx + 1}</div>
            <SubjectCombobox
              options={options}
              value={s.name}
              onSelect={opt => onSelect(s.id, opt)}
              placeholder="Search subject…"
            />
            <select
              value={s.grade}
              onChange={e => onGrade(s.id, e.target.value)}
              className="w-[68px] px-2 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#FAF5EF] focus:outline-none focus:border-[#D4B094]/50 transition-all appearance-none text-center flex-shrink-0"
            >
              <option value="" className="bg-[#1A0507]">—</option>
              {GRADES.map(g => <option key={g} value={g} className="bg-[#1A0507]">{g}</option>)}
            </select>
            {subjects.length > 1 && (
              <button
                onClick={() => onRemove(s.id)}
                className="p-2 text-[#FAF5EF]/20 hover:text-red-400 transition-colors flex-shrink-0"
                aria-label="Remove subject"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="mt-3 flex items-center gap-2 text-xs text-[#D4B094]/60 hover:text-[#D4B094] transition-colors"
      >
        <Plus size={14} /> Add subject
      </button>
    </div>
  );
}

// ─── Check row ──────────────────────────────────────────────────────────────────

function CheckRow({ c }: { c: Check }) {
  const tone = c.warn ? 'amber' : c.pass ? 'gold' : 'red';
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
        tone === 'gold' ? 'bg-[#D4B094]/20 text-[#D4B094]'
        : tone === 'amber' ? 'bg-amber-900/30 text-amber-400'
        : 'bg-red-900/30 text-red-400'
      }`}>
        {c.warn ? <AlertTriangle size={11} /> : c.pass ? <Check size={11} /> : <X size={11} />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[#FAF5EF]/70">{c.label}</span>
        {c.value && (
          <span className={`ml-2 text-sm font-medium ${
            tone === 'gold' ? 'text-[#D4B094]' : tone === 'amber' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {c.value}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Detail panel (shared by top-level cards and sub-cards) ─────────────────────

function ResultDetail({ r }: { r: Result }) {
  return (
    <div className="pt-5 grid sm:grid-cols-2 gap-6">
      <div>
        <p className="text-xs tracking-[0.2em] uppercase text-[#D4B094]/50 mb-3">Your results</p>
        <div className="space-y-2">
          {r.checks?.map((c, i) => <CheckRow key={i} c={c} />)}
        </div>
        <div className={`mt-4 px-4 py-3 rounded-xl text-sm ${
          r.warn ? 'bg-amber-950/30 text-amber-300'
          : r.eligible ? 'bg-[#D4B094]/10 text-[#D4B094]'
          : 'bg-red-950/40 text-red-400'
        }`}>
          {r.reason}
        </div>
      </div>
      {r.info && (
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-[#D4B094]/50 mb-3">Requirements</p>
          <ul className="space-y-2">
            {r.info.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#FAF5EF]/50">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-[#D4B094]/40 flex-shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EligibilityChecker() {
  const [oLevels, setOLevels] = useState<Subject[]>([{ id: 'ol0', name: '', tags: [], grade: '' }]);
  const [aLevels, setALevels] = useState<Subject[]>([{ id: 'al0', name: '', tags: [], grade: '' }]);
  const [showResults, setShowResults] = useState(false);
  const [expanded, setExpanded] = useState<UniId | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const addOL = () => setOLevels(p => [...p, { id: `ol${Date.now()}`, name: '', tags: [], grade: '' }]);
  const addAL = () => setALevels(p => [...p, { id: `al${Date.now()}`, name: '', tags: [], grade: '' }]);
  const removeOL = (id: string) => setOLevels(p => p.filter(s => s.id !== id));
  const removeAL = (id: string) => setALevels(p => p.filter(s => s.id !== id));

  const selectOL = useCallback((id: string, opt: SubjectOption) =>
    setOLevels(p => p.map(s => s.id === id ? { ...s, name: opt.label, tags: opt.tags } : s)), []);
  const selectAL = useCallback((id: string, opt: SubjectOption) =>
    setALevels(p => p.map(s => s.id === id ? { ...s, name: opt.label, tags: opt.tags } : s)), []);
  const gradeOL = useCallback((id: string, grade: string) =>
    setOLevels(p => p.map(s => s.id === id ? { ...s, grade } : s)), []);
  const gradeAL = useCallback((id: string, grade: string) =>
    setALevels(p => p.map(s => s.id === id ? { ...s, grade } : s)), []);

  const results = useMemo(() => {
    const out = {} as Record<UniId, AnyResult>;
    UNIVERSITIES.forEach(u => { out[u.id] = u.calc(oLevels, aLevels); });
    return out;
  }, [oLevels, aLevels]);

  const eligibleCount = UNIVERSITIES.filter(u => results[u.id].eligible).length;

  const handleCheck = () => { setShowResults(true); setExpanded(null); setExpandedSub(null); };

  return (
    <div className="bg-[#1A0507] text-[#FAF5EF]">
      {!showResults && (
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="mb-12 text-center">
            <p className="text-xs tracking-[0.3em] uppercase text-[#D4B094]/60 mb-4">O/A Level Results</p>
            <h2 className="text-3xl sm:text-4xl font-light text-[#FAF5EF] leading-tight">
              Enter your grades once,<br />
              <span className="italic text-[#D4B094]">see every university.</span>
            </h2>
          </div>

          <SubjectSection
            title="O-Level Subjects"
            subtitle="Search and pick each subject, then choose its grade"
            subjects={oLevels}
            options={O_LEVEL_SUBJECTS}
            onAdd={addOL}
            onRemove={removeOL}
            onSelect={selectOL}
            onGrade={gradeOL}
          />

          <SubjectSection
            title="A-Level Subjects"
            subtitle="Search and pick each subject, then choose its grade"
            subjects={aLevels}
            options={A_LEVEL_SUBJECTS}
            onAdd={addAL}
            onRemove={removeAL}
            onSelect={selectAL}
            onGrade={gradeAL}
          />

          <div className="mt-10 flex justify-center">
            <button
              onClick={handleCheck}
              className="group relative inline-flex items-center gap-3 rounded-full border border-[#D4B094]/40 bg-[#FAF5EF] text-[#1A0507] px-10 py-4 font-sans text-base font-medium tracking-wide transition-all duration-500 hover:bg-[#D4B094] hover:shadow-[0_12px_40px_-12px_rgba(212,176,148,0.55)]"
            >
              Check Eligibility
            </button>
          </div>
        </div>
      )}

      {showResults && (
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="mb-12 text-center">
            <p className="text-xs tracking-[0.3em] uppercase text-[#D4B094]/60 mb-4">Results</p>
            <h2 className="text-3xl sm:text-4xl font-light text-[#FAF5EF] leading-tight mb-4">
              {eligibleCount === 0
                ? 'No programs eligible yet.'
                : eligibleCount === UNIVERSITIES.length
                  ? 'Eligible everywhere!'
                  : <>Eligible for <span className="text-[#D4B094] italic">{eligibleCount} of {UNIVERSITIES.length}</span> options.</>
              }
            </h2>
            <button
              onClick={() => setShowResults(false)}
              className="text-sm text-[#D4B094]/70 hover:text-[#D4B094] transition-colors underline underline-offset-4"
            >
              Edit grades
            </button>
          </div>

          <div className="space-y-3">
            {UNIVERSITIES.map(uni => {
              const r = results[uni.id];
              const isOpen = expanded === uni.id;
              const eligible = r.eligible;

              return (
                <div
                  key={uni.id}
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                    eligible ? 'border-[#D4B094]/30 bg-[#D4B094]/[0.06]' : 'border-white/[0.07] bg-white/[0.03]'
                  }`}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : uni.id)}
                    className="w-full flex items-center justify-between px-5 sm:px-6 py-5 text-left gap-3"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${eligible ? 'bg-[#D4B094]' : 'bg-white/20'}`} />
                      <div className="min-w-0">
                        <span className={`font-medium text-base ${eligible ? 'text-[#FAF5EF]' : 'text-[#FAF5EF]/50'}`}>
                          {uni.label}
                        </span>
                        <span className={`block sm:inline sm:ml-3 text-xs ${eligible ? 'text-[#D4B094]' : 'text-[#FAF5EF]/30'}`}>
                          {uni.full}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                      <span className={`text-xs font-medium tracking-wide uppercase ${eligible ? 'text-[#D4B094]' : 'text-[#FAF5EF]/30'}`}>
                        {isGroup(r)
                          ? `${r.subResults.filter(s => s.eligible).length}/${r.subResults.length}`
                          : eligible ? 'Eligible' : 'Not eligible'}
                      </span>
                      {isOpen ? <ChevronUp size={16} className="text-[#D4B094]/60" /> : <ChevronDown size={16} className="text-[#FAF5EF]/30" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 border-t border-white/[0.06]">
                      {isGroup(r) ? (
                        <div className="pt-5 space-y-2.5">
                          {r.info && (
                            <ul className="mb-4 space-y-1.5">
                              {r.info.map((line, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-[#FAF5EF]/45">
                                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#D4B094]/40 flex-shrink-0" />
                                  {line}
                                </li>
                              ))}
                            </ul>
                          )}
                          {r.subResults.map(sub => {
                            const key = `${uni.id}:${sub.label}`;
                            const subOpen = expandedSub === key;
                            return (
                              <div
                                key={key}
                                className={`rounded-xl border overflow-hidden ${
                                  sub.eligible ? 'border-[#D4B094]/25 bg-[#D4B094]/[0.05]' : 'border-white/[0.06] bg-white/[0.02]'
                                }`}
                              >
                                <button
                                  onClick={() => setExpandedSub(subOpen ? null : key)}
                                  className="w-full flex items-center justify-between px-4 py-3.5 text-left gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sub.eligible ? 'bg-[#D4B094]' : 'bg-white/20'}`} />
                                    <span className={`text-sm ${sub.eligible ? 'text-[#FAF5EF]' : 'text-[#FAF5EF]/50'}`}>{sub.label}</span>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className={`text-[11px] font-medium uppercase tracking-wide ${
                                      sub.warn ? 'text-amber-400' : sub.eligible ? 'text-[#D4B094]' : 'text-[#FAF5EF]/30'
                                    }`}>
                                      {sub.eligible ? 'Eligible' : 'No'}
                                    </span>
                                    {subOpen ? <ChevronUp size={14} className="text-[#D4B094]/60" /> : <ChevronDown size={14} className="text-[#FAF5EF]/30" />}
                                  </div>
                                </button>
                                {subOpen && (
                                  <div className="px-4 pb-4 border-t border-white/[0.06]">
                                    <ResultDetail r={sub} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <ResultDetail r={r} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-10 text-center text-xs text-[#FAF5EF]/25 max-w-lg mx-auto leading-relaxed">
            Results are based on the latest published eligibility criteria. Passing-year windows and
            equivalence steps are summarised in each card — always verify with the university admission office.
          </p>
        </div>
      )}
    </div>
  );
}
