'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { WordRotate } from '@/components/ui/word-rotate';
import { FlickeringGrid } from '@/components/ui/flickering-grid';
import { ArrowUpRight } from 'lucide-react';

export function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '-20%']);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const gridY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);

  return (
    <section
      ref={ref}
      className="relative min-h-dvh flex flex-col justify-end pt-40 sm:pt-44 lg:pt-48 pb-20 sm:pb-24 lg:pb-28 bg-[#1A0507] overflow-hidden"
    >
      {/* Flickering grid — editorial animated base */}
      <motion.div
        className="absolute inset-0"
        style={{ y: gridY }}
        aria-hidden
      >
        <FlickeringGrid
          className="absolute inset-0 size-full"
          squareSize={3}
          gridGap={7}
          flickerChance={0.18}
          color="rgb(212, 176, 148)"
          maxOpacity={0.22}
        />
      </motion.div>

      {/* Vignette — keeps text readable against animated grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 50% 35%, transparent 0%, rgba(26,5,7,0.55) 60%, rgba(26,5,7,0.95) 100%)',
        }}
      />

      {/* Bottom warm bloom — pulls eye toward CTA without landscape metaphor */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(122,20,25,0.25) 60%, rgba(163,90,61,0.35) 100%)',
        }}
      />

      {/* Horizon rule — single thin line separator */}
      <motion.div
        className="absolute bottom-[14%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4B094]/60 to-transparent pointer-events-none"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
      />

      {/* Grain texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='400' height='400' filter='url(%23n)' opacity='0.9'/></svg>\")",
        }}
      />

      {/* Edge credits — folio markers, docked to bottom corners */}
      <div className="hidden md:block absolute bottom-6 left-6 sm:left-10 z-10 font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/55 pointer-events-none">
        <div>Est. 2021</div>
        <div className="mt-1">Dhanmondi · Dhaka</div>
      </div>
      <div className="hidden md:block absolute bottom-6 right-6 sm:right-10 z-10 font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/55 pointer-events-none text-right">
        <div>№ 01</div>
        <div className="mt-1">Chapter One</div>
      </div>

      {/* Main content — bottom-anchored editorial */}
      <motion.div
        className="relative z-10 w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16"
        style={{ y: textY, opacity: textOpacity }}
      >
        {/* Tiny editorial tag */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mb-8 sm:mb-10 flex items-center gap-3 font-sans text-[11px] sm:text-xs tracking-[0.3em] uppercase text-[#D4B094]/70"
        >
          <span className="inline-block w-8 h-px bg-[#D4B094]/60" />
          A Chapter for English-Medium Students
        </motion.div>

        {/* Oversized display headline — asymmetric */}
        <h1 className="font-heading text-[#FAF5EF] leading-[0.88] tracking-[-0.03em] font-light">
          <AnimatedHeading />
        </h1>

        {/* Word rotator kicker */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-5">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.4 }}
            className="font-sans text-sm sm:text-base text-[#FAF5EF]/60 tracking-wide"
          >
            Preparation —
          </motion.span>
          <WordRotate
            className="font-heading text-2xl sm:text-3xl md:text-4xl italic text-[#D4B094] font-light"
            words={['for IBA DU', 'for BUP IBA', 'for DU FBS', 'for BUP FBS', 'for you']}
            duration={2200}
          />
        </div>

        {/* Grand editorial statement — spans the full width, "only" as the centerpiece */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-16 sm:mt-20 relative"
        >
          {/* Kicker row — spans full width, anchored meta on both ends */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.25 }}
            className="flex items-center gap-4 font-sans text-[10px] sm:text-[11px] tracking-[0.35em] uppercase text-[#D4B094]/70 mb-8"
          >
            <span className="w-8 h-px bg-[#D4B094]/50" />
            <span>A Singular Proposition</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.4, delay: 1.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: 'left' }}
              className="flex-1 h-px bg-[#D4B094]/25"
            />
            <span className="text-[#D4B094]/50 hidden sm:inline">Est. 2021</span>
          </motion.div>

          {/* The statement — generous clamp, spans wider, multi-line rhythm */}
          <p className="font-heading text-[clamp(1.6rem,3.4vw,3rem)] leading-[1.2] tracking-[-0.015em] font-extralight max-w-[62rem]">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.3 }}
              className="text-[#FAF5EF]/55"
            >
              The{' '}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative inline-block italic font-light align-baseline"
              style={{ color: '#D4B094' }}
            >
              <span
                aria-hidden
                className="absolute -inset-x-4 -inset-y-1 -z-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 90% at 50% 55%, rgba(212,176,148,0.22), transparent 70%)',
                }}
              />
              <span className="relative z-[1]">only</span>
              <motion.svg
                className="absolute left-0 -bottom-2 w-full h-[10px] overflow-visible pointer-events-none z-[1]"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                aria-hidden
              >
                <motion.path
                  d="M1,7 Q 25,2 50,5 T 99,5"
                  fill="none"
                  stroke="#D4B094"
                  strokeWidth={2}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.3, delay: 1.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </motion.svg>
            </motion.span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.5 }}
              className="text-[#FAF5EF]"
            >
              {' '}admission program in Bangladesh{' '}
            </motion.span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.65 }}
              className="text-[#FAF5EF]/55"
            >
              built{' '}
              <em className="not-italic text-[#FAF5EF]/90 font-light">by</em>
              {' '}English-medium students{' '}
              <em className="not-italic text-[#FAF5EF]/90 font-light">for</em>
              {' '}English-medium students.
            </motion.span>
          </p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2 }}
            className="mt-8 font-heading italic text-[#FAF5EF]/55 text-base sm:text-lg leading-snug"
          >
            Every founder sat the same exams you&rsquo;re about to.
          </motion.p>
        </motion.div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.7 }}
          className="mt-12 sm:mt-14 flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10"
        >
          <Link
            href="/registration"
            className="group/save relative inline-flex items-center gap-3 rounded-full border border-[#D4B094]/40 bg-[#FAF5EF] text-[#1A0507] px-7 sm:px-9 py-4 sm:py-[18px] font-sans text-sm sm:text-base font-medium tracking-wide transition-all duration-500 hover:bg-[#D4B094] hover:shadow-[0_12px_40px_-12px_rgba(212,176,148,0.55)]"
          >
            <span className="relative overflow-hidden">
              <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/save:-translate-y-full">
                Save your seat
              </span>
              <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/save:translate-y-0">
                Save your seat
              </span>
            </span>
            <span className="relative w-5 h-5 overflow-hidden">
              <ArrowUpRight className="absolute inset-0 w-5 h-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/save:translate-x-5 group-hover/save:-translate-y-5" strokeWidth={1.5} />
              <ArrowUpRight className="absolute inset-0 w-5 h-5 -translate-x-5 translate-y-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/save:translate-x-0 group-hover/save:translate-y-0" strokeWidth={1.5} />
            </span>
          </Link>

          <Link
            href="/eligibility-checker"
            className="font-sans text-sm text-[#D4B094] hover:text-[#FAF5EF] transition-colors inline-flex items-center gap-2 group/check"
          >
            <span className="w-6 h-px bg-current transition-all duration-300 group-hover/check:w-10" />
            Check eligibility
          </Link>
        </motion.div>

      </motion.div>
    </section>
  );
}

/**
 * Animated oversized display heading.
 * Breaks a 2-line statement into words, springs each word in with variable timing.
 */
function AnimatedHeading() {
  const line1 = ['Beyond', 'the'];
  const line2 = ['your', 'next', 'chapter.'];

  return (
    <>
      <span className="block whitespace-nowrap">
        <Line words={line1} baseDelay={0.2} />
        <EmphasisLine words={['horizons,']} baseDelay={0.45} />
      </span>
      <Line words={line2} baseDelay={0.75} color="#D4B094" italic light />
    </>
  );
}

function Line({
  words,
  baseDelay,
  color = '#FAF5EF',
  italic = false,
  light = false,
}: {
  words: string[];
  baseDelay: number;
  color?: string;
  italic?: boolean;
  light?: boolean;
}) {
  return (
    <span
      className={`inline-block text-[clamp(2.5rem,7.5vw,6.5rem)] ${italic ? 'italic' : ''} ${
        light ? 'font-extralight' : 'font-light'
      }`}
      style={{ color }}
    >
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          transition={{
            duration: 1,
            delay: baseDelay + i * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block mr-[0.2em] overflow-hidden align-baseline"
          style={{ transformOrigin: 'bottom' }}
        >
          <motion.span className="inline-block">{w}</motion.span>
        </motion.span>
      ))}
    </span>
  );
}

/**
 * Italic emphasis line with SVG stroke-draw underline that scribes as the words arrive.
 */
function EmphasisLine({ words, baseDelay }: { words: string[]; baseDelay: number }) {
  return (
    <span className="relative inline-block text-[clamp(2.5rem,7.5vw,6.5rem)] italic font-light text-[#FAF5EF]">
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          transition={{
            duration: 1,
            delay: baseDelay + i * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block mr-[0.2em]"
        >
          {w}
        </motion.span>
      ))}
      {/* Hand-drawn underline */}
      <motion.svg
        className="absolute left-0 -bottom-4 w-full h-4 overflow-visible pointer-events-none"
        viewBox="0 0 600 20"
        preserveAspectRatio="none"
        aria-hidden
      >
        <motion.path
          d="M5,14 Q 150,6 300,12 T 595,10"
          fill="none"
          stroke="#D4B094"
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, delay: baseDelay + 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </motion.svg>
    </span>
  );
}
