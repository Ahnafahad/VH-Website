'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, ArrowUpRight, Check, Loader2 } from 'lucide-react';

type EducationType = 'hsc' | 'alevels' | null;
type ProgramMode   = 'mocks' | 'full' | null;
type MockProgram   = 'du-iba' | 'bup-iba' | 'du-fbs' | 'bup-fbs' | 'fbs-detailed';
type FullCourse    = 'du-iba-full' | 'bup-iba-fbs-full';
type MockIntent    = 'trial' | 'full' | null;

const MOCK_PRICES: Record<MockProgram, number> = {
  'du-iba': 3000,
  'bup-iba': 2200,
  'du-fbs': 2500,
  'bup-fbs': 2000,
  'fbs-detailed': 6500,
};

const MOCK_LABELS: Record<MockProgram, { title: string; detail: string }> = {
  'du-iba':       { title: 'DU IBA Mock Test Series',   detail: '10 comprehensive mocks · First mock free' },
  'bup-iba':      { title: 'BUP IBA Mock Test Series',  detail: '8 comprehensive mocks · First mock free' },
  'du-fbs':       { title: 'DU FBS Mock Test Series',   detail: '8 comprehensive mocks · First mock free' },
  'bup-fbs':      { title: 'BUP FBS Mock Test Series',  detail: '8 comprehensive mocks · First mock free' },
  'fbs-detailed': { title: 'Detailed Guidance for FBS', detail: 'Expert classes + study notes + both FBS mock series' },
};

const STEPS = ['Personal', 'Education', 'Program', 'Review'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoursesRegistrationPage() {
  const [step, setStep]       = useState(1);
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2
  const [eduType,     setEduType]     = useState<EducationType>(null);
  const [hscYear,     setHscYear]     = useState('');
  const [sscYear,     setSscYear]     = useState('');
  const [aLevelYear,  setALevelYear]  = useState('');
  const [oLevelYear,  setOLevelYear]  = useState('');

  // Step 3
  const [mode,         setMode]         = useState<ProgramMode>(null);
  const [mocks,        setMocks]        = useState<MockProgram[]>([]);
  const [fullCourses,  setFullCourses]  = useState<FullCourse[]>([]);
  const [mockIntent,   setMockIntent]   = useState<MockIntent>(null);

  // Step 4
  const [refName, setRefName] = useState('');
  const [refInst, setRefInst] = useState('');
  const [refBatch,setRefBatch]= useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pricing
  const { subtotal, discount, finalPrice } = useMemo(() => {
    if (mode !== 'mocks') return { subtotal: 0, discount: 0, finalPrice: 0 };
    const sub = mocks.reduce((s, p) => s + MOCK_PRICES[p], 0);
    const rate = mocks.length >= 4 ? 0.25 : mocks.length === 3 ? 0.15 : mocks.length === 2 ? 0.05 : 0;
    const disc = sub * rate;
    return { subtotal: sub, discount: disc, finalPrice: sub - disc };
  }, [mocks, mode]);

  // Validation
  const ok1 = name.trim() && email.includes('@') && phone.trim();
  const ok2 = eduType && (
    (eduType === 'hsc'     && hscYear && sscYear) ||
    (eduType === 'alevels' && aLevelYear && oLevelYear)
  );
  const ok3 = (mode === 'full'  && fullCourses.length > 0) ||
              (mode === 'mocks' && mocks.length > 0 && mockIntent);

  const toggleMock = (p: MockProgram) => {
    setMockIntent(null);
    setMocks(prev => {
      let next = prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p];
      if (p === 'fbs-detailed' && next.includes('fbs-detailed'))
        next = next.filter(x => x !== 'du-fbs' && x !== 'bup-fbs');
      if ((p === 'du-fbs' || p === 'bup-fbs') && !prev.includes(p))
        next = next.filter(x => x !== 'fbs-detailed');
      return next;
    });
  };

  const toggleFull = (c: FullCourse) =>
    setFullCourses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name, email, phone, educationType: eduType,
        years: eduType === 'hsc' ? { hscYear, sscYear } : { aLevelYear, oLevelYear },
        programMode: mode,
        ...(mode === 'mocks'
          ? { selectedMocks: mocks, mockIntent, pricing: { subtotal, discount, finalPrice },
              ...(refName && refInst && refBatch ? { referral: { name: refName, institution: refInst, batch: refBatch } } : {}) }
          : { selectedFullCourses: fullCourses })
      };
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setSubmitted(true);
    } catch {
      alert('Failed to submit. Please try again or call +880 1915424939.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="relative min-h-screen bg-[#FAF5EF] text-[#1A0507] overflow-hidden">
        <EditoralOverlay />
        <div className="relative max-w-3xl mx-auto px-6 sm:px-10 pt-20 pb-24">
          <ChapterMark chapter="Chapter Six" title="The Beginning" />

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em] font-light mt-8"
          >
            Thank you,{' '}
            <em className="font-extralight text-[#760F13]">{name.split(' ')[0] || 'friend'}</em>.
            <br />
            Your seat is <em className="font-extralight text-[#760F13]">held</em>.
          </motion.h1>

          <div className="border-t border-b border-[#D4B094]/30 py-6 my-10 space-y-3">
            {[
              ['Program', mode === 'mocks' ? mocks.map(m => MOCK_LABELS[m].title).join(' · ') : fullCourses.join(' · ')],
              ...(finalPrice > 0 ? [['Rate', `${finalPrice.toLocaleString()} BDT`]] : []),
              ['Contact', `${email} · ${phone}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-4">
                <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] w-24 shrink-0">{k}</span>
                <span className="font-heading text-lg text-[#1A0507]">{v}</span>
              </div>
            ))}
          </div>

          <div className="relative rounded-2xl border border-[#D4B094]/40 bg-white/70 backdrop-blur-sm p-6 sm:p-8 mb-8 overflow-hidden">
            <CornerBrackets accent="#A86E58" />
            <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#760F13] mb-3">
              Early-bird advantage — unlocked
            </div>
            <p className="font-heading text-xl sm:text-2xl leading-snug text-[#1A0507] font-light">
              You&rsquo;ve locked in current rates and first access to the 2026 cohort.
              Expect a call on <strong className="font-medium">{phone}</strong> within 24 hours.
            </p>
          </div>

          <div className="relative rounded-2xl border border-[#D4B094]/30 bg-[#1A0507] text-[#FAF5EF] p-6 sm:p-10 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
              <div className="shrink-0 p-3 bg-white rounded-xl shadow-lg">
                <img src="/whatsapp-qr.png" alt="Scan to join WhatsApp group" className="w-40 h-40 sm:w-44 sm:h-44 block" />
              </div>
              <div className="flex-1">
                <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094] mb-3">Stay connected</div>
                <h3 className="font-heading text-2xl sm:text-3xl font-light leading-tight mb-3">
                  Join the group. Don&rsquo;t miss the update.
                </h3>
                <p className="font-sans text-sm text-[#FAF5EF]/70 leading-relaxed mb-6 max-w-md">
                  Scan or tap below. Early-bird advantage, course updates, and cohort announcements come here first.
                </p>
                <a
                  href="https://chat.whatsapp.com/LBdtaxyUP6w1S7npTrFli6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 rounded-full bg-[#FAF5EF] text-[#1A0507] px-7 py-3.5 font-sans text-sm font-medium tracking-wide transition-all duration-500 hover:bg-[#D4B094] hover:shadow-[0_10px_40px_-10px_rgba(212,176,148,0.5)]"
                >
                  Open WhatsApp group <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between gap-4">
            <Link href="/" className="group inline-flex items-center gap-3 font-sans text-sm text-[#760F13] hover:text-[#1A0507] transition-colors">
              <span className="w-6 h-px bg-current transition-all duration-300 group-hover:w-12" />
              Return home
            </Link>
            <div className="font-sans text-xs text-[#A86E58]/70">
              Questions? <a href="tel:+8801915424939" className="underline decoration-[#D4B094]/50 underline-offset-4">+880 1915424939</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-[#FAF5EF] text-[#1A0507] overflow-hidden">
      <EditoralOverlay />

      <div className="relative max-w-[900px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 pb-24 sm:pt-28">
        <ChapterMark chapter="Chapter Four" title="Register interest" />

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="font-heading text-[clamp(2.5rem,6vw,5rem)] leading-[0.92] tracking-[-0.02em] font-light mt-8 mb-12"
        >
          Secure your{' '}
          <em className="font-extralight text-[#760F13]">early-bird seat.</em>
        </motion.h1>

        {/* Step progress */}
        <StepProgress current={step} total={4} labels={STEPS} />

        {/* Form card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 relative rounded-2xl border border-[#D4B094]/40 bg-white/70 backdrop-blur-sm p-8 sm:p-12 overflow-hidden"
        >
          <CornerBrackets accent="#A86E58" />
          <span aria-hidden className="absolute -top-4 -right-2 font-heading italic text-[#D4B094]/20 text-[7rem] font-extralight leading-none pointer-events-none select-none">
            {String(step).padStart(2, '0')}
          </span>

          <div className="relative">
            <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-6">
              {STEPS[step - 1]}
            </div>

            {/* ── Step 1: Personal info ── */}
            {step === 1 && (
              <div className="space-y-8">
                <h2 className="font-heading text-3xl sm:text-4xl font-light leading-tight tracking-[-0.01em]">
                  Who are you?
                </h2>

                <CourseInput label="Full name" id="name" type="text" value={name} onChange={setName} placeholder="Your full name" autoComplete="name" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <CourseInput label="Email" id="email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
                  <CourseInput label="Phone / WhatsApp" id="phone" type="tel" value={phone} onChange={setPhone} placeholder="01XXXXXXXXX" autoComplete="tel" />
                </div>

                <StepNav
                  onNext={() => setStep(2)}
                  nextDisabled={!ok1}
                  nextLabel="Next — Education"
                />
              </div>
            )}

            {/* ── Step 2: Education ── */}
            {step === 2 && (
              <div className="space-y-8">
                <h2 className="font-heading text-3xl sm:text-4xl font-light leading-tight tracking-[-0.01em]">
                  Your academic track.
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['hsc', 'alevels'] as const).map(t => (
                    <ToggleCard
                      key={t}
                      selected={eduType === t}
                      onClick={() => setEduType(t)}
                      kicker={t === 'hsc' ? 'HSC Track' : 'A Levels Track'}
                      detail={t === 'hsc' ? 'SSC → HSC' : 'O Level → A Level'}
                    />
                  ))}
                </div>

                {eduType === 'hsc' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-[#D4B094]/25">
                    <CourseInput label="HSC passing year" id="hsc" type="text" value={hscYear} onChange={setHscYear} placeholder="2025" />
                    <CourseInput label="SSC passing year" id="ssc" type="text" value={sscYear} onChange={setSscYear} placeholder="2023" />
                  </div>
                )}
                {eduType === 'alevels' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-[#D4B094]/25">
                    <CourseInput label="A Level passing year" id="al" type="text" value={aLevelYear} onChange={setALevelYear} placeholder="2025" />
                    <CourseInput label="O Level passing year" id="ol" type="text" value={oLevelYear} onChange={setOLevelYear} placeholder="2023" />
                  </div>
                )}

                <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!ok2} nextLabel="Next — Program" />
              </div>
            )}

            {/* ── Step 3: Program ── */}
            {step === 3 && (
              <div className="space-y-8">
                <h2 className="font-heading text-3xl sm:text-4xl font-light leading-tight tracking-[-0.01em]">
                  What are you after?
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ToggleCard
                    selected={mode === 'mocks'}
                    onClick={() => { setMode('mocks'); setFullCourses([]); }}
                    kicker="Mock Test Programs"
                    detail="Comprehensive mock test series · First mock free"
                  />
                  <ToggleCard
                    selected={mode === 'full'}
                    onClick={() => { setMode('full'); setMocks([]); setMockIntent(null); }}
                    kicker="Full Courses"
                    detail="Complete preparation with classes & guidance"
                  />
                </div>

                {/* Mock programs */}
                {mode === 'mocks' && (
                  <div className="space-y-6">
                    <div className="border-t border-[#D4B094]/25 pt-6">
                      <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-4">
                        Select programs
                      </p>
                      <div className="space-y-3">
                        {(['du-iba', 'bup-iba'] as MockProgram[]).map(p => (
                          <MockCard
                            key={p}
                            program={p}
                            selected={mocks.includes(p)}
                            disabled={false}
                            price={MOCK_PRICES[p]}
                            onToggle={() => toggleMock(p)}
                          />
                        ))}
                        {eduType === 'alevels' && (['du-fbs', 'bup-fbs'] as MockProgram[]).map(p => (
                          <MockCard
                            key={p}
                            program={p}
                            selected={mocks.includes(p)}
                            disabled={mocks.includes('fbs-detailed')}
                            price={MOCK_PRICES[p]}
                            onToggle={() => toggleMock(p)}
                          />
                        ))}
                        {eduType === 'alevels' && (
                          <MockCard
                            program="fbs-detailed"
                            selected={mocks.includes('fbs-detailed')}
                            disabled={mocks.includes('du-fbs') || mocks.includes('bup-fbs')}
                            price={MOCK_PRICES['fbs-detailed']}
                            onToggle={() => toggleMock('fbs-detailed')}
                            premium
                          />
                        )}
                      </div>
                    </div>

                    {/* Pricing */}
                    {mocks.length > 0 && (
                      <div className="rounded-2xl bg-[#1A0507] text-[#FAF5EF] p-6 sm:p-8 overflow-hidden relative">
                        <CornerBrackets accent="#D4B094" />
                        <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094] mb-5">
                          Pricing
                        </div>
                        <div className="space-y-2 text-sm font-sans text-[#FAF5EF]/70 mb-4">
                          <div className="flex justify-between">
                            <span>{mocks.length} program{mocks.length > 1 ? 's' : ''}</span>
                            <span className="text-[#FAF5EF]">Tk {subtotal.toLocaleString()}</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between text-[#D4B094]">
                              <span>Multi-program discount ({mocks.length >= 4 ? 25 : mocks.length === 3 ? 15 : 5}%)</span>
                              <span>− Tk {discount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="border-t border-white/10 pt-4 flex justify-between items-baseline">
                          <span className="font-heading text-lg font-light text-[#FAF5EF]/70">Total</span>
                          <span className="font-heading text-3xl font-light text-[#FAF5EF]">
                            Tk {finalPrice.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Intent */}
                    {mocks.length > 0 && (
                      <div className="space-y-3 border-t border-[#D4B094]/25 pt-6">
                        <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-4">
                          How do you want to start?
                        </p>
                        <ToggleCard
                          selected={mockIntent === 'trial'}
                          onClick={() => setMockIntent('trial')}
                          kicker="Experience first, decide later"
                          detail="Start with the complimentary first mock · No payment required"
                        />
                        <ToggleCard
                          selected={mockIntent === 'full'}
                          onClick={() => setMockIntent('full')}
                          kicker="Secure your place now"
                          detail="Full program access · Priority support"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Full courses */}
                {mode === 'full' && (
                  <div className="space-y-4 border-t border-[#D4B094]/25 pt-6">
                    <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-4">
                      Select course
                    </p>
                    <ToggleCard
                      selected={fullCourses.includes('du-iba-full')}
                      onClick={() => toggleFull('du-iba-full')}
                      kicker="DU IBA Complete Course"
                      detail="Full preparation with classes, notes, mock tests & instructor guidance"
                    />
                    {eduType === 'alevels' && (
                      <ToggleCard
                        selected={fullCourses.includes('bup-iba-fbs-full')}
                        onClick={() => toggleFull('bup-iba-fbs-full')}
                        kicker="BUP IBA & FBS Complete Course"
                        detail="Comprehensive preparation for both BUP programs with full support"
                      />
                    )}
                    {eduType === 'hsc' && (
                      <ToggleCard
                        selected={fullCourses.includes('bup-iba-fbs-full')}
                        onClick={() => toggleFull('bup-iba-fbs-full')}
                        kicker="BUP IBA Complete Course"
                        detail="Full preparation with classes, notes, mock tests & instructor guidance"
                      />
                    )}
                    {fullCourses.length > 0 && (
                      <p className="font-sans text-xs text-[#A86E58]/80 leading-relaxed pt-2">
                        Our admissions team will contact you within 24 hours to discuss curriculum, scheduling, and pricing.
                      </p>
                    )}
                  </div>
                )}

                <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!ok3} nextLabel="Review" />
              </div>
            )}

            {/* ── Step 4: Review & submit ── */}
            {step === 4 && (
              <div className="space-y-8">
                <h2 className="font-heading text-3xl sm:text-4xl font-light leading-tight tracking-[-0.01em]">
                  Confirm your details.
                </h2>

                {/* Summary */}
                <div className="space-y-4 border-t border-[#D4B094]/25 pt-6">
                  {[
                    { label: 'Name',    value: name },
                    { label: 'Email',   value: email },
                    { label: 'Phone',   value: phone },
                    { label: 'Track',   value: eduType === 'hsc' ? 'HSC (SSC → HSC)' : 'A Levels (O → A)' },
                    { label: 'Years',   value: eduType === 'hsc' ? `SSC ${sscYear} · HSC ${hscYear}` : `O Level ${oLevelYear} · A Level ${aLevelYear}` },
                    { label: 'Program', value: mode === 'mocks'
                        ? mocks.map(m => MOCK_LABELS[m].title).join(' · ')
                        : fullCourses.includes('du-iba-full') ? 'DU IBA Complete Course' : 'BUP Complete Course' },
                    ...(mode === 'mocks' && finalPrice > 0 ? [{ label: 'Total', value: `Tk ${finalPrice.toLocaleString()}` }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-baseline gap-4">
                      <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] w-24 shrink-0">{label}</span>
                      <span className="font-heading text-lg text-[#1A0507] font-light">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Referral (mocks only) */}
                {mode === 'mocks' && (
                  <div className="border-t border-[#D4B094]/25 pt-6 space-y-6">
                    <div>
                      <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-1">
                        Referral (optional)
                      </p>
                      <p className="font-sans text-xs text-[#1A0507]/50 leading-relaxed">
                        Current / alumni of BUP FBS, BUP IBA, IBA DU, DU FBS, or VH program only.
                      </p>
                    </div>
                    <CourseInput label="Referral name" id="ref-name" type="text" value={refName} onChange={setRefName} placeholder="Full name" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div>
                        <label htmlFor="ref-inst" className="block font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-2">
                          Institution
                        </label>
                        <select
                          id="ref-inst"
                          value={refInst}
                          onChange={e => setRefInst(e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-[#1A0507]/20 py-3 px-0 font-heading text-xl text-[#1A0507] focus:outline-none focus:border-[#760F13] transition-colors appearance-none"
                        >
                          <option value="">Select…</option>
                          {['BUP FBS','BUP IBA','IBA DU','DU FBS','Beyond the Horizon Alumni','Beyond the Horizon Current Student'].map(v =>
                            <option key={v} value={v}>{v}</option>
                          )}
                        </select>
                      </div>
                      <CourseInput label="Batch" id="ref-batch" type="text" value={refBatch} onChange={setRefBatch} placeholder="e.g. 2024" />
                    </div>
                    {refName && refInst && refBatch && (
                      <div className="flex items-center gap-3 text-[#A86E58] font-sans text-xs">
                        <Check size={14} />
                        Referral added
                      </div>
                    )}
                  </div>
                )}

                {/* Early-bird note */}
                <div className="rounded-2xl border border-[#D4B094]/40 bg-white/60 p-6 relative overflow-hidden">
                  <CornerBrackets accent="#A86E58" />
                  <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#760F13] mb-2">
                    Early-bird advantage
                  </div>
                  <p className="font-sans text-sm text-[#1A0507]/70 leading-relaxed">
                    {mode === 'mocks'
                      ? 'No payment at registration. First mock is complimentary. Payment details shared separately.'
                      : 'Our team will reach you within 24 hours to discuss curriculum, schedule, and pricing.'}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => setStep(3)}
                    className="group inline-flex items-center gap-3 font-sans text-sm text-[#1A0507]/60 hover:text-[#1A0507] transition-colors py-4"
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                  <div className="flex-1" />
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#1A0507]/20 text-[#1A0507]/60 px-7 py-3.5 font-sans text-sm font-medium tracking-wide hover:border-[#1A0507]/40 hover:text-[#1A0507] transition-all"
                  >
                    Home
                  </Link>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="group/cta relative inline-flex items-center gap-3 rounded-full bg-[#1A0507] text-[#FAF5EF] px-8 py-3.5 font-sans text-sm font-medium tracking-wide transition-all duration-500 disabled:opacity-50 hover:bg-[#760F13] hover:shadow-[0_10px_40px_-10px_rgba(90,11,15,0.4)]"
                  >
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting</> : (
                      <>
                        <span className="relative overflow-hidden">
                          <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:-translate-y-full">Submit registration</span>
                          <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-y-0">Submit registration</span>
                        </span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover/cta:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-16 flex items-center gap-4 text-[#A86E58]/80">
          <span className="flex-1 h-px bg-[#A86E58]/20" />
          <span className="font-heading italic text-sm font-extralight">
            Either way, you&rsquo;re already in the right place.
          </span>
          <span className="flex-1 h-px bg-[#A86E58]/20" />
        </div>

        <div className="mt-8 text-center font-sans text-xs text-[#A86E58]/60">
          Need help?{' '}
          <a href="tel:+8801915424939" className="underline decoration-[#D4B094]/50 underline-offset-4 hover:text-[#A86E58] transition-colors">
            +880 1915424939
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function EditoralOverlay() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, #1A0507 39px, #1A0507 40px)' }} />
      <div aria-hidden className="absolute inset-0 opacity-60 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212,176,148,0.22), transparent 60%)' }} />
    </>
  );
}

function ChapterMark({ chapter, title }: { chapter: string; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#A86E58] flex items-center gap-3"
    >
      <span className="w-8 h-px bg-[#A86E58]" />
      {chapter} / {title}
    </motion.div>
  );
}

function CornerBrackets({ accent }: { accent: string }) {
  return (
    <>
      <span className="absolute top-5 left-5 w-4 h-px" style={{ backgroundColor: `${accent}80` }} />
      <span className="absolute top-5 left-5 w-px h-4" style={{ backgroundColor: `${accent}80` }} />
      <span className="absolute bottom-5 right-5 w-4 h-px" style={{ backgroundColor: `${accent}80` }} />
      <span className="absolute bottom-5 right-5 w-px h-4 -translate-y-4" style={{ backgroundColor: `${accent}80` }} />
    </>
  );
}

function StepProgress({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-0 max-w-sm">
      {Array.from({ length: total }, (_, i) => i + 1).map((s, i) => (
        <div key={s} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${s < current ? 'bg-[#A86E58]' : s === current ? 'bg-[#1A0507] ring-2 ring-[#1A0507]/20' : 'bg-[#D4B094]/40'}`} />
            <span className={`font-sans text-[9px] tracking-[0.2em] uppercase transition-colors ${s === current ? 'text-[#1A0507]' : 'text-[#A86E58]/40'}`}>
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className="flex-1 h-px mx-3 mb-4 relative">
              <div className="absolute inset-0 bg-[#D4B094]/30" />
              <motion.div
                className="absolute inset-y-0 left-0 bg-[#A86E58]"
                animate={{ width: s < current ? '100%' : '0%' }}
                transition={{ duration: 0.4 }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CourseInput({
  label, id, type, value, onChange, placeholder, autoComplete, helperText,
}: {
  label: string; id: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string; helperText?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-2">
        {label}
      </label>
      <input
        id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        className="w-full bg-transparent border-0 border-b border-[#1A0507]/20 py-3 px-0 font-heading text-xl text-[#1A0507] placeholder-[#1A0507]/25 focus:outline-none focus:border-[#760F13] transition-colors"
      />
      {helperText && <p className="mt-2 font-sans text-[11px] text-[#A86E58]/90">{helperText}</p>}
    </div>
  );
}

function ToggleCard({
  selected, onClick, kicker, detail,
}: { selected: boolean; onClick: () => void; kicker: string; detail: string }) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative w-full text-left rounded-xl border p-5 sm:p-6 transition-all duration-300 overflow-hidden',
        selected
          ? 'bg-[#1A0507] border-[#1A0507] text-[#FAF5EF]'
          : 'bg-transparent border-[#D4B094]/40 text-[#1A0507] hover:border-[#A86E58]/60',
      ].join(' ')}
    >
      {selected && <CornerBrackets accent="#D4B094" />}
      <div className={`font-sans text-[10px] tracking-[0.3em] uppercase mb-1.5 ${selected ? 'text-[#D4B094]' : 'text-[#A86E58]'}`}>
        {kicker}
      </div>
      <div className={`font-sans text-sm ${selected ? 'text-[#FAF5EF]/70' : 'text-[#1A0507]/55'}`}>
        {detail}
      </div>
      {selected && (
        <span className={`absolute top-4 right-5 w-5 h-5 rounded-full flex items-center justify-center bg-[#D4B094]`}>
          <Check size={11} className="text-[#1A0507]" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

function MockCard({
  program, selected, disabled, price, onToggle, premium,
}: { program: MockProgram; selected: boolean; disabled: boolean; price: number; onToggle: () => void; premium?: boolean }) {
  const { title, detail } = MOCK_LABELS[program];
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={[
        'relative w-full text-left rounded-xl border p-5 transition-all duration-300 overflow-hidden',
        disabled
          ? 'opacity-35 cursor-not-allowed border-[#D4B094]/20'
          : selected
            ? 'bg-[#1A0507] border-[#1A0507] text-[#FAF5EF]'
            : premium
              ? 'border-[#A86E58]/40 hover:border-[#A86E58] bg-[#A86E58]/[0.03]'
              : 'border-[#D4B094]/40 hover:border-[#A86E58]/60',
      ].join(' ')}
    >
      {selected && <CornerBrackets accent="#D4B094" />}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {premium && !selected && (
            <span className="inline-block font-sans text-[9px] tracking-[0.25em] uppercase text-[#A86E58] border border-[#A86E58]/40 rounded px-2 py-0.5 mb-2">
              Premium package
            </span>
          )}
          <div className={`font-sans font-medium text-sm mb-0.5 ${selected ? 'text-[#FAF5EF]' : ''}`}>{title}</div>
          <div className={`font-sans text-xs ${selected ? 'text-[#FAF5EF]/60' : 'text-[#1A0507]/45'}`}>{detail}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`font-heading text-lg font-light ${selected ? 'text-[#D4B094]' : 'text-[#1A0507]'}`}>
            Tk {price.toLocaleString()}
          </div>
          {selected && (
            <span className="flex items-center justify-end gap-1 mt-1 font-sans text-[10px] text-[#D4B094]">
              <Check size={10} /> Selected
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function StepNav({
  onBack, onNext, nextDisabled, nextLabel,
}: { onBack?: () => void; onNext: () => void; nextDisabled: boolean; nextLabel: string }) {
  return (
    <div className="flex items-center gap-4 pt-4">
      {onBack && (
        <button onClick={onBack} className="group inline-flex items-center gap-3 font-sans text-sm text-[#1A0507]/50 hover:text-[#1A0507] transition-colors py-4">
          <ArrowLeft size={16} /> Back
        </button>
      )}
      <div className="flex-1" />
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="group/cta relative inline-flex items-center gap-3 rounded-full bg-[#1A0507] text-[#FAF5EF] px-8 py-3.5 font-sans text-sm font-medium tracking-wide transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-[#760F13] enabled:hover:shadow-[0_10px_40px_-10px_rgba(90,11,15,0.4)]"
      >
        <span className="relative overflow-hidden">
          <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:-translate-y-full">{nextLabel}</span>
          <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-y-0">{nextLabel}</span>
        </span>
        <ArrowRight className="w-4 h-4 transition-transform group-hover/cta:translate-x-0.5" />
      </button>
    </div>
  );
}
