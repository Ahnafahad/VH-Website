'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

// --- Grade point tables ---
const ibaGradePoints: Record<string, number>  = { A: 5.0, B: 4.0, C: 3.5, D: 0.0 };
const bupGradePoints: Record<string, number>  = { A: 5.0, B: 4.0, C: 3.5, D: 3.0 };
const duSciGradePoints: Record<string, number> = { A: 5.0, B: 4.0, C: 3.5 };
const bizSubjects = ['business studies', 'business', 'accounting', 'economics', 'mathematics', 'statistics'];
const grades     = ['A', 'B', 'C', 'D'] as const;
const sciGrades  = ['A', 'B', 'C'] as const;

interface Subject { id: string; name: string; grade: string; }

// ─── Calculators ──────────────────────────────────────────────────────────────

function calcIBA(oLevels: Subject[], aLevels: Subject[]) {
  const ol = oLevels.filter(s => s.name.trim() && s.grade);
  const al = aLevels.filter(s => s.name.trim() && s.grade);
  const math = oLevels.find(s => s.name.toLowerCase().trim() === 'mathematics' && s.grade);

  if (!math)          return { eligible: false, reason: 'Mathematics required in O-Level.' };
  if (ol.length < 5)  return { eligible: false, reason: 'Min 5 O-Level subjects required.' };
  if (al.length < 2)  return { eligible: false, reason: 'Min 2 A-Level subjects required.' };

  // best 5 O-Level (math + best 4 others)
  const mathPts    = ibaGradePoints[math.grade];
  const otherOlPts = ol.filter(s => s.id !== math.id).map(s => ibaGradePoints[s.grade]).sort((a, b) => b - a);
  const best5ol    = [mathPts, ...otherOlPts.slice(0, 4)];
  const olCGPA     = best5ol.reduce((s, p) => s + p, 0) / 5;

  // best 2 A-Level
  const alPts  = al.map(s => ibaGradePoints[s.grade]).sort((a, b) => b - a);
  const best2al = alPts.slice(0, 2);
  const alCGPA  = best2al.reduce((s, p) => s + p, 0) / 2;

  const allSubjects    = [...ol, ...al];
  const aCount         = allSubjects.filter(s => s.grade === 'A').length;
  const olPass         = olCGPA >= 3.5;
  const alPass         = alCGPA >= 3.5;
  const minA           = aCount >= 2;
  const eligible       = olPass && alPass && minA;

  return {
    eligible, olCGPA: olCGPA.toFixed(2), alCGPA: alCGPA.toFixed(2),
    aCount, olPass, alPass, minA,
    reason: eligible ? 'Meets all IBA DU requirements.' : 'Requirements not met.',
    checks: [
      { label: `O-Level avg ≥ 3.5  (A=5, B=4, C=3.5, D=0)`, value: `${olCGPA.toFixed(2)}`, pass: olPass },
      { label: `A-Level avg ≥ 3.5`, value: `${alCGPA.toFixed(2)}`, pass: alPass },
      { label: `Min 2 A grades (combined)`, value: `${aCount} A's`, pass: minA },
    ],
    info: [
      'Min 5 O-Levels incl. Mathematics',
      `Min 2 A-Levels (final result ≥ 1 subject published ${new Date().getFullYear()})`,
      'A=5.0  B=4.0  C=3.5  D=0.0',
      'Min 2 A grades across all 7 counted subjects',
    ],
  };
}

function calcBUP(oLevels: Subject[], aLevels: Subject[]) {
  const ol = oLevels.filter(s => s.name.trim() && s.grade);
  const al = aLevels.filter(s => s.name.trim() && s.grade);

  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.' };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.' };

  const olPts  = ol.map(s => bupGradePoints[s.grade]).sort((a, b) => b - a).slice(0, 5);
  const alPts  = al.map(s => bupGradePoints[s.grade]).sort((a, b) => b - a).slice(0, 2);
  const total  = [...olPts, ...alPts].reduce((s, p) => s + p, 0);
  const eligible = total >= 26.5;

  return {
    eligible, total: total.toFixed(1),
    olPts, alPts,
    reason: eligible ? 'Meets all BUP requirements.' : `Need ${(26.5 - total).toFixed(1)} more points.`,
    checks: [
      { label: 'Combined points ≥ 26.5  (best 5 O + best 2 A)', value: `${total.toFixed(1)}`, pass: eligible },
    ],
    info: [
      'Min 5 O-Levels + 2 A-Levels',
      'A/A*/9/8 = 5.0  |  7 = 4.5  |  B/6 = 4.0  |  C/5 = 3.5  |  D/4 = 3.0',
      'Grades below D not counted',
      'Applies to both IBA & FBS programmes',
    ],
  };
}

function calcDUScience(oLevels: Subject[], aLevels: Subject[]) {
  const ol = oLevels.filter(s => s.name.trim() && s.grade);
  const al = aLevels.filter(s => s.name.trim() && s.grade);

  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.' };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.' };

  const combined = [...ol, ...al];
  if (combined.some(s => s.grade === 'D')) return { eligible: false, reason: 'D grades not allowed for DU Science.' };

  const withPts = combined
    .map(s => ({ ...s, pts: duSciGradePoints[s.grade] ?? 0 }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 7);

  const gc = { A: 0, B: 0, C: 0 };
  withPts.forEach(s => { if (s.grade in gc) gc[s.grade as keyof typeof gc]++; });

  const minA = gc.A >= 3;
  const minB = (gc.A + gc.B) >= 5;
  const minC = (gc.A + gc.B + gc.C) >= 7;
  const has7  = withPts.length >= 7;
  const eligible = minA && minB && minC && has7;

  return {
    eligible, gc, withPts,
    reason: eligible ? 'Meets all DU Science requirements.' : 'Grade distribution not met.',
    checks: [
      { label: 'Min 3 A grades (best 7 subjects)', value: `${gc.A} A's`, pass: minA },
      { label: 'Min 5 subjects with B or above', value: `${gc.A + gc.B}`, pass: minB },
      { label: '7 subjects with C or above', value: `${gc.A + gc.B + gc.C}`, pass: minC },
      { label: 'No D grades', value: '', pass: !combined.some(s => s.grade === 'D') },
    ],
    info: [
      'Best 7 subjects counted from combined O+A Level',
      'Grade distribution: 3A + 2B + 2C minimum',
      'No D grades allowed',
      'A=5.0  B=4.0  C=3.5',
    ],
  };
}

function calcDUBusiness(oLevels: Subject[], aLevels: Subject[]) {
  const ol = oLevels.filter(s => s.name.trim() && s.grade);
  const al = aLevels.filter(s => s.name.trim() && s.grade);

  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.' };
  if (al.length < 2) return { eligible: false, reason: 'Min 2 A-Level subjects required.' };

  const hasBiz = al.some(s => bizSubjects.some(b => s.name.toLowerCase().trim() === b));
  if (!hasBiz) return {
    eligible: false,
    reason: 'Must take Business Studies, Accounting, Economics, Mathematics, or Statistics at A-Level.',
    checks: [{ label: 'Business subject in A-Level', value: 'Missing', pass: false }],
    info: ['English-medium: one of Business/Economics/Accounting/Maths/Statistics required at A-Level'],
  };

  const olPts   = ol.map(s => ibaGradePoints[s.grade]).sort((a, b) => b - a).slice(0, 5);
  const alPts   = al.map(s => ibaGradePoints[s.grade]).sort((a, b) => b - a).slice(0, 2);
  const olGPA   = olPts.reduce((s, p) => s + p, 0) / 5;
  const alGPA   = alPts.reduce((s, p) => s + p, 0) / 2;
  const olPass  = olGPA >= 3.0;
  const alPass  = alGPA >= 3.0;
  const eligible = olPass && alPass;

  return {
    eligible, olGPA: olGPA.toFixed(2), alGPA: alGPA.toFixed(2), olPass, alPass, hasBiz,
    reason: eligible ? 'Meets DU FBS requirements.' : 'GPA requirements not met.',
    checks: [
      { label: 'Business subject in A-Level', value: 'Present', pass: true },
      { label: 'O-Level avg ≥ 3.0 (best 5)', value: olGPA.toFixed(2), pass: olPass },
      { label: 'A-Level avg ≥ 3.0 (best 2)', value: alGPA.toFixed(2), pass: alPass },
    ],
    info: [
      'Commerce / IGCSE+A-Level: combined GPA ≥ 7.5 (min 3.0 each)',
      'Science background: combined GPA ≥ 8.0 (min 3.5 each)',
      'Humanities: combined GPA ≥ 7.5 (min 3.0 each)',
      'English-medium must include one business/econ/accounting/maths/stats subject',
    ],
  };
}

function calcBUET(oLevels: Subject[], aLevels: Subject[]) {
  const ol = oLevels.filter(s => s.name.trim() && s.grade);
  const al = aLevels.filter(s => s.name.trim() && s.grade);

  if (ol.length < 5) return { eligible: false, reason: 'Min 5 O-Level subjects required.' };

  const findOl = (name: string) => ol.find(s => s.name.toLowerCase().includes(name));
  const buetOlReq = ['mathematics', 'physics', 'chemistry', 'english'];
  const missingOl: string[] = [];
  const lowOl:     string[] = [];

  buetOlReq.forEach(n => {
    const s = findOl(n);
    if (!s) { missingOl.push(n); return; }
    if (s.grade === 'C' || s.grade === 'D') lowOl.push(`${n} (${s.grade})`);
  });

  if (missingOl.length) return { eligible: false, reason: `Missing O-Level: ${missingOl.join(', ')}.` };
  if (lowOl.length)     return { eligible: false, reason: `Need min B in: ${lowOl.join(', ')}.` };

  const sciAl = al.filter(s => ['mathematics','physics','chemistry'].some(n => s.name.toLowerCase().includes(n)));
  if (sciAl.length < 3) return { eligible: false, reason: 'Must take Maths, Physics, Chemistry at A-Level.' };

  const aCount        = sciAl.filter(s => s.grade === 'A').length;
  const bPlusCount    = sciAl.filter(s => s.grade === 'A' || s.grade === 'B').length;
  const twoA          = aCount >= 2;
  const allBPlus      = bPlusCount >= 3;
  const eligible      = twoA && allBPlus;

  return {
    eligible, sciAl, aCount, bPlusCount, twoA, allBPlus,
    reason: eligible
      ? 'Meets BUET minimum. Final ranking: top 400 by A-Level Maths/Physics/Chemistry.'
      : 'A-Level grade requirements not met.',
    checks: [
      { label: 'O-Level: Maths/Physics/Chemistry/English all ≥ B', value: '', pass: !missingOl.length && !lowOl.length },
      { label: 'A-Level: 2 A grades from Maths/Physics/Chemistry', value: `${aCount}/2`, pass: twoA },
      { label: 'All 3 science subjects ≥ B', value: `${bPlusCount}/3`, pass: allBPlus },
    ],
    info: [
      'O-Level: min 5 subjects incl. Maths, Physics, Chemistry, English (all min B)',
      'A-Level: all 3 science subjects required (Maths, Physics, Chemistry)',
      'Need 2 A grades + 1 B grade minimum at A-Level',
      'Final selection: top 400 ranked by converted A-Level grades',
    ],
  };
}

// ─── University config ────────────────────────────────────────────────────────

const UNIVERSITIES = [
  { id: 'IBA',    label: 'IBA (DU)',    full: 'IBA, University of Dhaka' },
  { id: 'BUP',    label: 'BUP',         full: 'Bangladesh University of Professionals' },
  { id: 'DUFBS',  label: 'DU FBS',      full: 'Faculty of Business Studies, University of Dhaka' },
  { id: 'DUSci',  label: 'DU Science',  full: 'Science Unit, University of Dhaka' },
  { id: 'BUET',   label: 'BUET',        full: 'Bangladesh University of Engineering & Technology' },
] as const;

type UniId = typeof UNIVERSITIES[number]['id'];

// ─── Main component ───────────────────────────────────────────────────────────

export default function EligibilityChecker() {
  const [oLevels, setOLevels] = useState<Subject[]>([{ id: 'ol0', name: '', grade: '' }]);
  const [aLevels, setALevels] = useState<Subject[]>([{ id: 'al0', name: '', grade: '' }]);
  const [showResults, setShowResults] = useState(false);
  const [expanded, setExpanded] = useState<UniId | null>(null);

  // Subjects helpers
  const addOL = () => setOLevels(p => [...p, { id: `ol${Date.now()}`, name: '', grade: '' }]);
  const addAL = () => setALevels(p => [...p, { id: `al${Date.now()}`, name: '', grade: '' }]);
  const removeOL = (id: string) => setOLevels(p => p.filter(s => s.id !== id));
  const removeAL = (id: string) => setALevels(p => p.filter(s => s.id !== id));
  const updateOL = useCallback((id: string, field: string, val: string) =>
    setOLevels(p => p.map(s => s.id === id ? { ...s, [field]: val } : s)), []);
  const updateAL = useCallback((id: string, field: string, val: string) =>
    setALevels(p => p.map(s => s.id === id ? { ...s, [field]: val } : s)), []);

  // Compute all results
  const results = useMemo(() => ({
    IBA:    calcIBA(oLevels, aLevels),
    BUP:    calcBUP(oLevels, aLevels),
    DUFBS:  calcDUBusiness(oLevels, aLevels),
    DUSci:  calcDUScience(oLevels, aLevels),
    BUET:   calcBUET(oLevels, aLevels),
  }), [oLevels, aLevels]);

  const eligibleCount = Object.values(results).filter(r => r.eligible).length;

  const handleCheck = () => {
    setShowResults(true);
    setExpanded(null);
  };

  return (
    <div className="min-h-screen bg-[#1A0507] text-[#FAF5EF]">
      {/* ── Input form ── */}
      {!showResults && (
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="mb-12 text-center">
            <p className="text-xs tracking-[0.3em] uppercase text-[#D4B094]/60 mb-4">O/A Level Results</p>
            <h2 className="text-3xl sm:text-4xl font-light text-[#FAF5EF] leading-tight">
              Enter your grades once,<br />
              <span className="italic text-[#D4B094]">see every university.</span>
            </h2>
          </div>

          {/* O-Level subjects */}
          <SubjectSection
            title="O-Level Subjects"
            subtitle="Enter all your O-Level subjects"
            subjects={oLevels}
            grades={[...grades]}
            onAdd={addOL}
            onRemove={removeOL}
            onUpdate={updateOL}
          />

          {/* A-Level subjects */}
          <SubjectSection
            title="A-Level Subjects"
            subtitle="Enter all your A-Level subjects"
            subjects={aLevels}
            grades={[...grades]}
            onAdd={addAL}
            onRemove={removeAL}
            onUpdate={updateAL}
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

      {/* ── Results ── */}
      {showResults && (
        <div className="max-w-4xl mx-auto px-6 py-16">
          {/* Header */}
          <div className="mb-12 text-center">
            <p className="text-xs tracking-[0.3em] uppercase text-[#D4B094]/60 mb-4">Results</p>
            <h2 className="text-3xl sm:text-4xl font-light text-[#FAF5EF] leading-tight mb-4">
              {eligibleCount === 0
                ? 'No universities eligible yet.'
                : eligibleCount === UNIVERSITIES.length
                  ? 'Eligible for all universities!'
                  : <>Eligible for <span className="text-[#D4B094] italic">{eligibleCount} of {UNIVERSITIES.length}</span> universities.</>
              }
            </h2>
            <button
              onClick={() => setShowResults(false)}
              className="text-sm text-[#D4B094]/70 hover:text-[#D4B094] transition-colors underline underline-offset-4"
            >
              Edit grades
            </button>
          </div>

          {/* University cards */}
          <div className="space-y-3">
            {UNIVERSITIES.map(uni => {
              const r = results[uni.id];
              const isOpen = expanded === uni.id;

              return (
                <div
                  key={uni.id}
                  className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                    r.eligible
                      ? 'border-[#D4B094]/30 bg-[#D4B094]/[0.06]'
                      : 'border-white/[0.07] bg-white/[0.03]'
                  }`}
                >
                  {/* Card header — always visible, clickable */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : uni.id)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                  >
                    <div className="flex items-center gap-4">
                      {/* Eligible dot */}
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        r.eligible ? 'bg-[#D4B094]' : 'bg-white/20'
                      }`} />
                      <div>
                        <span className={`font-medium text-base ${r.eligible ? 'text-[#FAF5EF]' : 'text-[#FAF5EF]/50'}`}>
                          {uni.label}
                        </span>
                        <span className={`ml-3 text-xs ${r.eligible ? 'text-[#D4B094]' : 'text-[#FAF5EF]/30'}`}>
                          {uni.full}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className={`text-xs font-medium tracking-wide uppercase ${
                        r.eligible ? 'text-[#D4B094]' : 'text-[#FAF5EF]/30'
                      }`}>
                        {r.eligible ? 'Eligible' : 'Not eligible'}
                      </span>
                      {isOpen
                        ? <ChevronUp size={16} className="text-[#D4B094]/60" />
                        : <ChevronDown size={16} className="text-[#FAF5EF]/30" />
                      }
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-6 pb-6 border-t border-white/[0.06]">
                      <div className="pt-5 grid sm:grid-cols-2 gap-6">
                        {/* Checks */}
                        <div>
                          <p className="text-xs tracking-[0.2em] uppercase text-[#D4B094]/50 mb-3">Your results</p>
                          <div className="space-y-2">
                            {(r as any).checks?.map((c: any, i: number) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                                  c.pass ? 'bg-[#D4B094]/20 text-[#D4B094]' : 'bg-red-900/30 text-red-400'
                                }`}>
                                  {c.pass ? <Check size={11} /> : <X size={11} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-[#FAF5EF]/70">{c.label}</span>
                                  {c.value && (
                                    <span className={`ml-2 text-sm font-medium ${c.pass ? 'text-[#D4B094]' : 'text-red-400'}`}>
                                      {c.value}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Verdict */}
                          <div className={`mt-4 px-4 py-3 rounded-xl text-sm ${
                            r.eligible
                              ? 'bg-[#D4B094]/10 text-[#D4B094]'
                              : 'bg-red-950/40 text-red-400'
                          }`}>
                            {r.reason}
                          </div>
                        </div>

                        {/* Requirements info */}
                        <div>
                          <p className="text-xs tracking-[0.2em] uppercase text-[#D4B094]/50 mb-3">Requirements</p>
                          <ul className="space-y-2">
                            {(r as any).info?.map((line: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-[#FAF5EF]/50">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-[#D4B094]/40 flex-shrink-0" />
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <p className="mt-10 text-center text-xs text-[#FAF5EF]/25 max-w-lg mx-auto leading-relaxed">
            Results based on official eligibility criteria. Always verify with university admission offices.
            More universities to be added.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Subject row section ──────────────────────────────────────────────────────

function SubjectSection({
  title, subtitle, subjects, grades, onAdd, onRemove, onUpdate,
}: {
  title: string;
  subtitle: string;
  subjects: Subject[];
  grades: string[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, val: string) => void;
}) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-base font-medium text-[#FAF5EF]">{title}</h3>
        <p className="text-xs text-[#FAF5EF]/40 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-2.5">
        {subjects.map((s, idx) => (
          <div key={s.id} className="flex gap-3 items-center">
            <div className="w-6 text-center text-xs text-[#FAF5EF]/20 flex-shrink-0">{idx + 1}</div>
            <input
              type="text"
              placeholder="Subject name"
              value={s.name}
              onChange={e => onUpdate(s.id, 'name', e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#FAF5EF] placeholder-[#FAF5EF]/20 focus:outline-none focus:border-[#D4B094]/40 focus:bg-white/[0.06] transition-all"
            />
            <select
              value={s.grade}
              onChange={e => onUpdate(s.id, 'grade', e.target.value)}
              className="w-20 px-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#FAF5EF] focus:outline-none focus:border-[#D4B094]/40 transition-all appearance-none text-center"
            >
              <option value="" className="bg-[#1A0507]">—</option>
              {grades.map(g => <option key={g} value={g} className="bg-[#1A0507]">{g}</option>)}
            </select>
            {subjects.length > 1 && (
              <button
                onClick={() => onRemove(s.id)}
                className="p-2 text-[#FAF5EF]/20 hover:text-red-400 transition-colors"
                aria-label="Remove"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="mt-3 flex items-center gap-2 text-xs text-[#D4B094]/50 hover:text-[#D4B094] transition-colors"
      >
        <Plus size={14} /> Add subject
      </button>
    </div>
  );
}
