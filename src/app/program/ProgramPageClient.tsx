'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowUpRight, ArrowDown } from 'lucide-react';
import { FlickeringGrid } from '@/components/ui/flickering-grid';
import { BorderBeam } from '@/components/ui/border-beam';
import { NumberTicker } from '@/components/ui/number-ticker';
import { TiltCard } from '@/components/landing/TiltCard';

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

type StatItem = { count: number; label: string; suffix?: string };

type Program = {
  id: 'iba' | 'fbs';
  chapter: string;
  folio: string;
  title: string;
  titleEm: string;
  lede: string;
  duration: string;
  subjectsLabel: string;
  subjects: { name: string; detail: string }[];
  stats: StatItem[];
  mocks: { title: string; count: number; detail: string }[];
  outcome: string;
  tone: 'light' | 'dark';
};

const iba: Program = {
  id: 'iba',
  chapter: 'Chapter One / Program I',
  folio: '№ 01',
  title: 'IBA DU',
  titleEm: 'the flagship',
  lede:
    'Five months of topic-wise, classroom-based preparation built around the single most competitive business admission in Bangladesh — and the BUP IBA paper that shares its DNA.',
  duration: '5-Month Intensive',
  subjectsLabel: 'Core curriculum',
  subjects: [
    {
      name: 'English',
      detail: 'Grammar architecture, reading comprehension, writing workshops.',
    },
    {
      name: 'Mathematics',
      detail: 'Arithmetic foundations through advanced problem-solving drills.',
    },
    {
      name: 'Analytical Ability',
      detail: 'Logic puzzles, critical reasoning, IBA-specific question families.',
    },
  ],
  stats: [
    { count: 60, label: 'Topic-wise classes' },
    { count: 10, label: 'In-house tests' },
    { count: 14, label: 'Mock exams' },
  ],
  mocks: [
    {
      title: 'DU IBA format',
      count: 10,
      detail: 'Cut from past papers. Tight timing, full-length, weekly review.',
    },
    {
      title: 'BUP IBA format',
      count: 4,
      detail: 'Separate paper structure. Same prep, targeted calibration.',
    },
  ],
  outcome: 'Two exams, one curriculum. Nothing wasted.',
  tone: 'light',
};

const fbs: Program = {
  id: 'fbs',
  chapter: 'Chapter Two / Program II',
  folio: '№ 02',
  title: 'DU FBS',
  titleEm: 'the specialist',
  lede:
    'Four months focused on the accounting-heavy reality of the C-Unit exam — built around Business, Economics, and Accounting, the three subjects that decide this paper.',
  duration: '4-Month Focused',
  subjectsLabel: 'Core curriculum',
  subjects: [
    {
      name: 'Business',
      detail: 'Management foundations, organisational theory, case reasoning.',
    },
    {
      name: 'Economics',
      detail: 'Micro and macro fundamentals framed for admission-style questions.',
    },
    {
      name: 'Accounting',
      detail: 'Journals to finals. The subject that separates FBS from the rest.',
    },
  ],
  stats: [
    { count: 48, label: 'Subject classes', suffix: '±' },
    { count: 3, label: 'Monthly subject tests' },
    { count: 15, label: 'Mock exams' },
  ],
  mocks: [
    {
      title: 'DU FBS format',
      count: 10,
      detail: 'C-Unit paper replicated to the minute. Written section graded every time.',
    },
    {
      title: 'BUP FBS format',
      count: 5,
      detail: 'BUP-specific pattern. Same prep, targeted calibration.',
    },
  ],
  outcome: 'The accounting-heavy paper deserves an accounting-heavy program.',
  tone: 'dark',
};

const testFormat = {
  total: '1h 30m',
  marks: 100,
  breakdown: [
    { section: 'MCQ', time: '45 min', marks: 60, note: '+1 correct · −0.25 wrong' },
    { section: 'Written', time: '45 min', marks: 40, note: 'Graded by founders' },
  ],
  beats: [
    { k: 'Total time', v: '1h 30m' },
    { k: 'MCQ section', v: '45 min' },
    { k: 'Written section', v: '45 min' },
    { k: 'MCQ marks', v: '60' },
    { k: 'Written marks', v: '40' },
    { k: 'Negative marking', v: '−0.25' },
  ],
};

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function ProgramPageClient() {
  return (
    <main className="bg-[#FAF5EF] text-[#1A0507]">
      <HeroSection />
      <ProgramSection program={iba} index={0} />
      <ProgramSection program={fbs} index={1} />
      <TestFormatSection />
      <RegisterSection />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  HERO                                                               */
/* ------------------------------------------------------------------ */

function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const headlineWords = ['Two', 'programs.', 'One', 'standard.'];

  return (
    <section
      ref={ref}
      className="relative min-h-[92vh] bg-[#1A0507] text-[#FAF5EF] overflow-hidden flex items-center"
    >
      {/* FlickeringGrid atmosphere */}
      <div className="absolute inset-0 opacity-[0.18]">
        <FlickeringGrid
          squareSize={3}
          gridGap={7}
          color="#D4B094"
          maxOpacity={0.35}
          flickerChance={0.08}
        />
      </div>

      {/* Warm bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 55%, rgba(212,176,148,0.18), transparent 60%)',
        }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Edge credits */}
      <div className="absolute top-28 left-6 sm:left-12 font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/60">
        Est. 2021 · Dhanmondi, Dhaka
      </div>
      <div className="absolute top-28 right-6 sm:right-12 font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/60">
        Programs · Volume I
      </div>

      <motion.div
        style={{ y, opacity }}
        className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 w-full pt-40 pb-28"
      >
        {/* Kicker */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center gap-3 font-sans text-[11px] tracking-[0.3em] uppercase text-[#D4B094] mb-10"
        >
          <span className="w-10 h-px bg-[#D4B094]/60" />
          The Programs · Prospectus
        </motion.div>

        {/* Headline with word-reveal */}
        <h1 className="font-heading text-[#FAF5EF] text-[clamp(2.7rem,8vw,7rem)] leading-[0.88] tracking-[-0.03em] font-light max-w-[18ch]">
          {headlineWords.map((word, i) => (
            <span key={i} className="inline-block overflow-hidden mr-[0.28em] last:mr-0">
              <motion.span
                initial={{ y: '110%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                transition={{
                  duration: 1,
                  delay: 0.35 + i * 0.09,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`inline-block ${i === 3 ? 'italic font-extralight text-[#D4B094]' : ''}`}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="mt-12 font-sans text-[#FAF5EF]/65 text-base sm:text-lg leading-relaxed max-w-xl"
        >
          One school. Two pathways. Below is the full prospectus —
          class structure, mocks, test format, and outcomes.
        </motion.p>

        {/* Anchor pair */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="mt-16 flex flex-wrap gap-8"
        >
          <AnchorLink href="#iba" label="Read IBA DU" index="01" />
          <AnchorLink href="#fbs" label="Read DU FBS" index="02" />
          <AnchorLink href="#test-format" label="The test" index="03" />
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.4 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-[#D4B094]/60"
      >
        <span className="font-sans text-[10px] tracking-[0.3em] uppercase">Scroll</span>
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowDown className="w-4 h-4" strokeWidth={1.25} />
        </motion.span>
      </motion.div>
    </section>
  );
}

function AnchorLink({
  href,
  label,
  index,
}: {
  href: string;
  label: string;
  index: string;
}) {
  return (
    <Link href={href} className="group inline-flex items-baseline gap-3">
      <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/60">
        {index}
      </span>
      <span className="relative font-heading italic text-xl sm:text-2xl font-light text-[#FAF5EF]">
        {label}
        <span className="absolute left-0 -bottom-1 h-px w-0 bg-[#D4B094] transition-all duration-500 group-hover:w-full" />
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  PROGRAM SECTION (shared)                                           */
/* ------------------------------------------------------------------ */

function ProgramSection({ program, index }: { program: Program; index: number }) {
  const isDark = program.tone === 'dark';
  const bg = isDark ? '#1A0507' : '#FAF5EF';
  const fg = isDark ? '#FAF5EF' : '#1A0507';
  const accent = isDark ? '#D4B094' : '#760F13';
  const sub = isDark ? 'rgba(250,245,239,0.62)' : 'rgba(26,5,7,0.62)';
  const borderCol = isDark ? 'rgba(212,176,148,0.15)' : 'rgba(26,5,7,0.1)';

  return (
    <section
      id={program.id}
      className="relative py-28 sm:py-36 lg:py-44 overflow-hidden scroll-mt-20"
      style={{ backgroundColor: bg, color: fg }}
    >
      {/* Ledger lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, ${fg} 39px, ${fg} 40px)`,
        }}
      />

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20 lg:mb-28 items-end">
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-3 font-sans text-[11px] tracking-[0.3em] uppercase mb-6"
              style={{ color: accent }}
            >
              <span className="w-8 h-px" style={{ backgroundColor: accent }} />
              {program.chapter}
            </motion.div>

            {/* Giant title with index watermark */}
            <div className="relative">
              <span
                className="absolute -top-14 -left-4 sm:-left-8 font-heading italic font-extralight text-[clamp(6rem,16vw,14rem)] leading-none pointer-events-none select-none"
                style={{ color: accent, opacity: 0.08 }}
              >
                0{index + 1}
              </span>

              <motion.h2
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="relative font-heading font-light text-[clamp(3rem,8.5vw,7.5rem)] leading-[0.9] tracking-[-0.03em]"
              >
                {program.title}
                <br />
                <em
                  className="font-extralight"
                  style={{ color: accent }}
                >
                  {program.titleEm}
                </em>
              </motion.h2>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.2 }}
              className="mt-10 font-heading italic font-light text-xl sm:text-2xl max-w-2xl leading-[1.35]"
              style={{ color: `${fg}cc` }}
            >
              {program.lede}
            </motion.p>
          </div>

          {/* Duration callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="lg:col-span-4 lg:justify-self-end"
          >
            <div
              className="relative border rounded-sm px-6 py-8 max-w-xs"
              style={{ borderColor: borderCol }}
            >
              <span
                className="absolute top-3 left-4 font-sans text-[9px] tracking-[0.3em] uppercase"
                style={{ color: accent }}
              >
                {program.folio}
              </span>
              <div
                className="mt-5 font-sans text-[10px] tracking-[0.3em] uppercase"
                style={{ color: sub }}
              >
                Duration
              </div>
              <div
                className="font-heading font-light text-3xl sm:text-4xl tracking-[-0.02em] mt-2"
                style={{ color: fg }}
              >
                {program.duration}
              </div>

              {/* Corner brackets */}
              <Corner tl color={accent} />
              <Corner br color={accent} />
            </div>
          </motion.div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px mb-24 lg:mb-32 border-t border-b"
          style={{ borderColor: borderCol }}
        >
          {program.stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative py-14 px-6 sm:px-10 flex flex-col"
              style={{
                backgroundColor: bg,
                boxShadow: `inset -1px 0 0 ${borderCol}`,
              }}
            >
              <div
                className="font-sans text-[9px] tracking-[0.3em] uppercase mb-3"
                style={{ color: accent }}
              >
                0{i + 1}
              </div>
              <div className="font-heading font-light text-[clamp(3rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.03em]">
                <NumberTicker
                  value={s.count}
                  className="font-heading font-light"
                  style={{ color: fg } as React.CSSProperties}
                />
                {s.suffix && (
                  <span style={{ color: accent }} className="font-extralight">
                    {s.suffix}
                  </span>
                )}
              </div>
              <div
                className="mt-4 font-sans text-[11px] tracking-[0.25em] uppercase"
                style={{ color: sub }}
              >
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Subjects — editorial list */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-24 lg:mb-32">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-4"
          >
            <div
              className="font-sans text-[10px] tracking-[0.3em] uppercase mb-4 flex items-center gap-3"
              style={{ color: accent }}
            >
              <span className="w-6 h-px" style={{ backgroundColor: accent }} />
              {program.subjectsLabel}
            </div>
            <h3
              className="font-heading font-light text-4xl sm:text-5xl leading-[1] tracking-[-0.02em]"
              style={{ color: fg }}
            >
              What you<em className="font-extralight" style={{ color: accent }}> study</em>.
            </h3>
          </motion.div>

          <div className="lg:col-span-8 flex flex-col divide-y"
            style={{ borderColor: borderCol }}
          >
            {program.subjects.map((sub_, i) => (
              <motion.div
                key={sub_.name}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="group relative grid grid-cols-12 items-baseline gap-4 py-8 first:border-t border-b"
                style={{ borderColor: borderCol }}
              >
                <span
                  className="col-span-1 font-sans text-[10px] tracking-[0.3em] uppercase pt-2"
                  style={{ color: accent }}
                >
                  0{i + 1}
                </span>
                <h4
                  className="col-span-4 font-heading font-light text-2xl sm:text-3xl tracking-[-0.01em]"
                  style={{ color: fg }}
                >
                  {sub_.name}
                </h4>
                <p
                  className="col-span-7 font-sans text-sm sm:text-base leading-relaxed"
                  style={{ color: sub }}
                >
                  {sub_.detail}
                </p>

                {/* Hover accent line */}
                <motion.span
                  className="absolute left-0 bottom-0 h-px"
                  style={{ backgroundColor: accent, width: '0%' }}
                  whileHover={{ width: '100%' }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mock breakdown — cards with tilt */}
        <div className="mb-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-14 flex items-end justify-between flex-wrap gap-6"
          >
            <div>
              <div
                className="font-sans text-[10px] tracking-[0.3em] uppercase mb-4 flex items-center gap-3"
                style={{ color: accent }}
              >
                <span className="w-6 h-px" style={{ backgroundColor: accent }} />
                The mocks
              </div>
              <h3
                className="font-heading font-light text-4xl sm:text-5xl leading-[1] tracking-[-0.02em] max-w-2xl"
                style={{ color: fg }}
              >
                Built from <em className="font-extralight" style={{ color: accent }}>past papers</em>, graded by founders.
              </h3>
            </div>
            <div
              className="font-sans text-sm max-w-sm leading-relaxed"
              style={{ color: sub }}
            >
              Each mock mirrors the real paper to the minute. Written sections are marked
              individually, not by rubric.
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {program.mocks.map((m, i) => (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.9, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <TiltCard
                  maxTilt={4}
                  depth={14}
                  className="relative border rounded-sm p-8 sm:p-10 h-full overflow-hidden"
                >
                  <div
                    className="absolute inset-0 -z-0"
                    style={{ backgroundColor: bg }}
                  />
                  <div
                    className="absolute inset-0 -z-0 border rounded-sm"
                    style={{ borderColor: borderCol }}
                  />

                  {/* Big numeral */}
                  <div className="relative flex items-end gap-5 mb-6">
                    <span
                      className="font-heading font-extralight text-[clamp(5rem,11vw,9rem)] leading-[0.8] tracking-[-0.04em]"
                      style={{ color: accent }}
                    >
                      <NumberTicker
                        value={m.count}
                        className="font-heading font-extralight"
                        style={{ color: accent } as React.CSSProperties}
                      />
                    </span>
                    <span
                      className="font-sans text-[10px] tracking-[0.3em] uppercase pb-4"
                      style={{ color: sub }}
                    >
                      mock exams
                    </span>
                  </div>

                  <h4
                    className="relative font-heading font-light text-2xl sm:text-3xl tracking-[-0.01em] mb-3"
                    style={{ color: fg }}
                  >
                    {m.title}
                  </h4>

                  <p
                    className="relative font-sans text-sm leading-relaxed max-w-md"
                    style={{ color: sub }}
                  >
                    {m.detail}
                  </p>

                  <Corner tl color={accent} />
                  <Corner br color={accent} />
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Outcome quote */}
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="relative max-w-3xl mx-auto text-center mt-12"
        >
          <span
            className="font-heading italic text-5xl absolute -top-4 left-1/2 -translate-x-1/2 opacity-40"
            style={{ color: accent }}
          >
            &ldquo;
          </span>
          <p
            className="font-heading italic font-light text-2xl sm:text-3xl lg:text-4xl leading-[1.3] tracking-[-0.01em] pt-8"
            style={{ color: fg }}
          >
            {program.outcome}
          </p>
        </motion.blockquote>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  TEST FORMAT                                                        */
/* ------------------------------------------------------------------ */

function TestFormatSection() {
  return (
    <section
      id="test-format"
      className="relative py-28 sm:py-36 lg:py-44 bg-[#F5EDE3] overflow-hidden scroll-mt-20"
    >
      {/* Ledger */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, #1A0507 39px, #1A0507 40px)',
        }}
      />

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-20 lg:mb-24 items-end">
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-3 font-sans text-[11px] tracking-[0.3em] uppercase mb-6 text-[#A86E58]"
            >
              <span className="w-8 h-px bg-[#A86E58]" />
              Chapter Three / The Test
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="font-heading font-light text-[#1A0507] text-[clamp(2.7rem,7.5vw,6.5rem)] leading-[0.9] tracking-[-0.03em]"
            >
              One format. <em className="font-extralight text-[#760F13]">Ninety minutes.</em>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="lg:col-span-4 font-sans text-[#1A0507]/60 text-sm sm:text-base leading-relaxed max-w-sm lg:justify-self-end"
          >
            Every mock we run matches the real paper exactly. MCQ plus written, split down
            the middle, scored against the same formula the admission committee uses.
          </motion.p>
        </div>

        {/* Test breakdown — split composition */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Big total time */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="lg:col-span-5 relative border border-[#1A0507]/10 rounded-sm p-10 sm:p-14 overflow-hidden bg-[#FAF5EF]"
          >
            <span className="absolute top-5 left-6 font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58]">
              Total
            </span>

            <div className="mt-6 font-sans text-[10px] tracking-[0.3em] uppercase text-[#1A0507]/50">
              Duration
            </div>
            <div className="font-heading font-extralight text-[clamp(5rem,13vw,11rem)] leading-[0.88] tracking-[-0.04em] text-[#760F13]">
              {testFormat.total}
            </div>

            <div className="mt-8 font-sans text-[10px] tracking-[0.3em] uppercase text-[#1A0507]/50">
              Marks
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-heading font-light text-6xl text-[#1A0507]">
                <NumberTicker value={testFormat.marks} />
              </span>
              <span className="font-sans text-xs tracking-[0.25em] uppercase text-[#1A0507]/50">
                total
              </span>
            </div>

            <Corner tl color="#A86E58" />
            <Corner br color="#A86E58" />
          </motion.div>

          {/* Right: breakdown rows */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {testFormat.breakdown.map((row, i) => (
              <motion.div
                key={row.section}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.9, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="relative group border border-[#1A0507]/10 rounded-sm p-8 sm:p-10 bg-[#FAF5EF] overflow-hidden"
              >
                {/* Section number */}
                <div className="flex items-baseline justify-between mb-6">
                  <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58]">
                    Section 0{i + 1}
                  </span>
                  <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#1A0507]/40">
                    {row.note}
                  </span>
                </div>

                <div className="grid grid-cols-12 items-baseline gap-4">
                  <h3 className="col-span-6 sm:col-span-5 font-heading font-light text-4xl sm:text-5xl tracking-[-0.02em] text-[#1A0507]">
                    {row.section}
                  </h3>

                  <div className="col-span-3 sm:col-span-3 flex flex-col">
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#1A0507]/50">
                      Time
                    </span>
                    <span className="font-heading font-light text-2xl sm:text-3xl text-[#1A0507]">
                      {row.time}
                    </span>
                  </div>

                  <div className="col-span-3 sm:col-span-4 flex flex-col">
                    <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#1A0507]/50">
                      Marks
                    </span>
                    <span className="font-heading font-light text-2xl sm:text-3xl text-[#760F13]">
                      <NumberTicker
                        value={row.marks}
                        className="font-heading font-light text-[#760F13]"
                      />
                    </span>
                  </div>
                </div>

                {/* Sweep line on hover */}
                <motion.span
                  className="absolute left-0 bottom-0 h-px bg-[#760F13]"
                  initial={{ width: '0%' }}
                  whileHover={{ width: '100%' }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Scoring beats — ticker strip */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mt-16 border-t border-[#1A0507]/10 pt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6"
        >
          {testFormat.beats.map((b, i) => (
            <motion.div
              key={b.k}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.4 + i * 0.06 }}
              className="flex flex-col"
            >
              <span className="font-sans text-[9px] tracking-[0.3em] uppercase text-[#A86E58] mb-2">
                {b.k}
              </span>
              <span className="font-heading font-light text-xl tracking-[-0.01em] text-[#1A0507]">
                {b.v}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  REGISTER CTA                                                       */
/* ------------------------------------------------------------------ */

function RegisterSection() {
  return (
    <section className="relative py-32 sm:py-40 lg:py-48 bg-[#1A0507] text-[#FAF5EF] overflow-hidden">
      {/* Flickering atmosphere */}
      <div className="absolute inset-0 opacity-[0.12]">
        <FlickeringGrid
          squareSize={3}
          gridGap={9}
          color="#D4B094"
          maxOpacity={0.3}
          flickerChance={0.07}
        />
      </div>

      {/* Warm bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 70%, rgba(212,176,148,0.22), transparent 60%)',
        }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex items-center justify-center gap-3 font-sans text-[11px] tracking-[0.3em] uppercase text-[#D4B094] mb-8"
        >
          <span className="w-8 h-px bg-[#D4B094]" />
          Chapter Four / The Invitation
          <span className="w-8 h-px bg-[#D4B094]" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="font-heading font-light text-[clamp(2.5rem,7vw,6rem)] leading-[0.9] tracking-[-0.03em] max-w-[18ch] mx-auto"
        >
          Ready to <em className="font-extralight text-[#D4B094]">begin</em>?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="mt-10 font-sans text-[#FAF5EF]/65 text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
        >
          Pick the program that fits. Register once — we&rsquo;ll take it from there.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <Link
            href="/registration"
            className="relative group inline-flex items-center gap-3 px-10 py-5 rounded-full overflow-hidden bg-[#FAF5EF] text-[#1A0507]"
          >
            <BorderBeam
              size={80}
              duration={8}
              colorFrom="#D4B094"
              colorTo="#760F13"
            />
            <span className="relative font-sans text-sm font-medium tracking-[0.15em] uppercase">
              Register now
            </span>
            <span className="relative w-4 h-4 overflow-hidden">
              <ArrowUpRight
                className="absolute inset-0 w-4 h-4 transition-transform duration-300 group-hover:translate-x-4 group-hover:-translate-y-4"
                strokeWidth={1.75}
              />
              <ArrowUpRight
                className="absolute inset-0 w-4 h-4 -translate-x-4 translate-y-4 transition-transform duration-300 group-hover:translate-x-0 group-hover:translate-y-0"
                strokeWidth={1.75}
              />
            </span>
          </Link>

          <Link
            href="/eligibility-checker"
            className="group inline-flex items-baseline gap-3 text-[#D4B094]/80 hover:text-[#D4B094] transition-colors"
          >
            <span className="font-sans text-[10px] tracking-[0.3em] uppercase">Or</span>
            <span className="relative font-heading italic text-xl font-light">
              check your eligibility
              <span className="absolute left-0 -bottom-1 h-px w-0 bg-[#D4B094] transition-all duration-500 group-hover:w-full" />
            </span>
          </Link>
        </motion.div>

        {/* Folio end */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-28 flex items-center justify-center gap-4 font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/40"
        >
          <span className="w-10 h-px bg-[#D4B094]/30" />
          End of Prospectus · Volume I
          <span className="w-10 h-px bg-[#D4B094]/30" />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function Corner({
  tl,
  br,
  color,
}: {
  tl?: boolean;
  br?: boolean;
  color: string;
}) {
  if (tl) {
    return (
      <>
        <span
          className="absolute top-4 left-4 w-3 h-px"
          style={{ backgroundColor: color, opacity: 0.6 }}
        />
        <span
          className="absolute top-4 left-4 w-px h-3"
          style={{ backgroundColor: color, opacity: 0.6 }}
        />
      </>
    );
  }
  if (br) {
    return (
      <>
        <span
          className="absolute bottom-4 right-4 w-3 h-px"
          style={{ backgroundColor: color, opacity: 0.6 }}
        />
        <span
          className="absolute bottom-4 right-4 w-px h-3"
          style={{ backgroundColor: color, opacity: 0.6 }}
        />
      </>
    );
  }
  return null;
}
