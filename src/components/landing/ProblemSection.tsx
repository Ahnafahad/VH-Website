'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useRef } from 'react';

const painPoints = [
  {
    index: '01',
    kicker: 'The gap nobody names',
    body:
      'The NCTB syllabus and your IAL curriculum only half-overlap. You know the A-level frame, not the Bangla-medium cadence of HSC-style questions.',
  },
  {
    index: '02',
    kicker: 'Coaching that doesn\u2019t speak your language',
    body:
      'Every major coaching center teaches in Bangla, assumes HSC-style baseline, and treats English-medium backgrounds as a handicap rather than an advantage.',
  },
  {
    index: '03',
    kicker: 'You\u2019re not behind \u2014 you\u2019re mis-prepared',
    body:
      'EM students consistently out-score HSC peers on IBA and BUP when the content bridges correctly. The failure is translation, not talent.',
  },
  {
    index: '04',
    kicker: 'Time you don\u2019t have',
    body:
      'A-levels finish. Admission exams arrive four months later. There is no second attempt and no second curriculum.',
  },
];

const N = painPoints.length;

export function ProblemSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const activeIndex = useTransform(scrollYProgress, (v) =>
    Math.min(N - 1, Math.max(0, Math.floor(v * N))),
  );

  return (
    <section className="relative bg-[#FAF5EF] text-[#1A0507]">
      {/* Editorial baseline grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, #1A0507 39px, #1A0507 40px)',
        }}
      />

      {/* Scroll driver */}
      <div ref={sectionRef} className="relative" style={{ height: `${N * 100}vh` }}>
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <div className="relative max-w-[1400px] mx-auto w-full px-6 sm:px-10 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            {/* LEFT — pinned statement */}
            <div className="lg:col-span-5 relative">
              <div className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#A86E58] mb-6 flex items-center gap-3">
                <span className="w-8 h-px bg-[#A86E58]" />
                Chapter One / The Problem
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-15%' }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="font-heading text-[#1A0507] text-[clamp(2.25rem,5vw,4.5rem)] leading-[0.95] tracking-[-0.02em] font-light"
              >
                You aren&rsquo;t
                <br />
                <em className="text-[#760F13] font-extralight">behind</em>{' '}
                <span className="text-[#D4B094]">&mdash;</span>
                <br />
                you&rsquo;re
                <br />
                <em className="font-extralight">mis-prepared.</em>
              </motion.h2>

              {/* Giant decorative quote mark */}
              <div
                aria-hidden
                className="absolute -right-4 -top-10 lg:-top-16 font-heading text-[#D4B094]/20 text-[160px] sm:text-[220px] lg:text-[280px] leading-none pointer-events-none select-none font-medium"
              >
                &ldquo;
              </div>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-15%' }}
                transition={{ duration: 0.9, delay: 0.2 }}
                className="relative mt-8 font-sans text-[#760F13]/70 text-base sm:text-lg max-w-md leading-relaxed"
              >
                We were once the students in your shoes. We built what was missing.
              </motion.p>

              {/* Segment dots — progress indicator */}
              <div className="mt-12 flex items-center gap-3">
                {painPoints.map((_, i) => (
                  <SegmentDot
                    key={i}
                    i={i}
                    progress={scrollYProgress}
                    activeIndex={activeIndex}
                  />
                ))}
              </div>
            </div>

            {/* RIGHT — stacking cards */}
            <div className="lg:col-span-7 relative h-[62vh] sm:h-[60vh] lg:h-[58vh]">
              {painPoints.map((p, i) => (
                <StackCard
                  key={p.index}
                  point={p}
                  i={i}
                  progress={scrollYProgress}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StackCard({
  point,
  i,
  progress,
}: {
  point: { index: string; kicker: string; body: string };
  i: number;
  progress: MotionValue<number>;
}) {
  const isFirst = i === 0;
  const topOffset = i * 22; // stacked depth in px
  // target scale when fully receded behind all later cards
  const targetScale = 1 - (N - 1 - i) * 0.04;

  // Entry: slide from below during this card's segment
  // For card 0 there's no entry — already in position from scroll start
  const y = useTransform(
    progress,
    isFirst ? [0, 1] : [(i - 1) / N, i / N],
    isFirst ? ['0%', '0%'] : ['110%', '0%'],
  );

  // Push-back scale: from this card's segment end (i+1)/N to end of scroll,
  // scale down to targetScale (progressive recession behind later cards)
  const scale = useTransform(
    progress,
    [i / N, 1],
    [1, targetScale],
  );

  // Subtle opacity dip when receded (for atmosphere, not occlusion)
  const opacity = useTransform(
    progress,
    i === N - 1 ? [0, 1] : [i / N, (i + 1) / N, 1],
    i === N - 1 ? [1, 1] : [1, 1, 0.82],
  );

  return (
    <motion.article
      style={{
        y,
        scale,
        opacity,
        top: `${topOffset}px`,
        zIndex: i,
        transformOrigin: 'center top',
      }}
      className="absolute inset-x-0 will-change-transform"
    >
      <div className="relative h-[60vh] sm:h-[58vh] lg:h-[56vh] rounded-2xl bg-[#FAF5EF] border border-[#D4B094]/30 shadow-[0_30px_80px_-30px_rgba(90,11,15,0.25),0_6px_20px_-10px_rgba(90,11,15,0.08)] p-8 sm:p-10 lg:p-14 flex flex-col justify-center overflow-hidden">
        {/* Corner brackets */}
        <span className="absolute top-6 left-6 w-4 h-px bg-[#A86E58]/50" />
        <span className="absolute top-6 left-6 w-px h-4 bg-[#A86E58]/50" />
        <span className="absolute bottom-6 right-6 w-4 h-px bg-[#A86E58]/50" />
        <span className="absolute bottom-6 right-6 w-px h-4 -translate-y-4 bg-[#A86E58]/50" />

        {/* Ghost index numeral */}
        <span
          aria-hidden
          className="absolute -top-8 -right-4 font-heading italic text-[#D4B094]/15 text-[10rem] sm:text-[14rem] leading-none font-extralight pointer-events-none select-none"
        >
          {point.index}
        </span>

        {/* Index rule */}
        <div className="relative flex items-center gap-4 mb-8">
          <span className="font-heading text-[#D4B094] text-2xl tracking-[0.2em]">
            {point.index}
          </span>
          <span className="flex-1 h-px bg-[#D4B094]/40" />
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58]">
            {i + 1} / {N}
          </span>
        </div>

        {/* Kicker */}
        <h3 className="relative font-heading text-[#1A0507] text-[clamp(1.75rem,3.4vw,3.25rem)] leading-[1.08] tracking-[-0.015em] font-light">
          {point.kicker}
        </h3>

        {/* Body */}
        <p className="relative mt-7 font-sans text-[#1A0507]/70 text-base sm:text-lg leading-relaxed max-w-xl">
          {point.body}
        </p>

        {/* Bottom rule */}
        <div className="relative mt-9 h-px bg-gradient-to-r from-[#A86E58]/60 to-transparent max-w-md" />
      </div>
    </motion.article>
  );
}

function SegmentDot({
  i,
  progress,
  activeIndex,
}: {
  i: number;
  progress: MotionValue<number>;
  activeIndex: MotionValue<number>;
}) {
  const start = i / N;
  const end = (i + 1) / N;

  const fillScale = useTransform(progress, [start, end], [0, 1]);
  const isActive = useTransform(activeIndex, (v) => (v === i ? 1 : 0)) as MotionValue<number>;
  const width = useTransform(isActive, [0, 1], [28, 56]);
  const opacity = useTransform(isActive, [0, 1], [0.45, 1]);

  return (
    <motion.div
      style={{ width, opacity }}
      className="relative h-px bg-[#A86E58]/30 overflow-hidden"
    >
      <motion.span
        style={{ scaleX: fillScale, transformOrigin: 'left' }}
        className="absolute inset-0 bg-[#760F13]"
      />
    </motion.div>
  );
}
