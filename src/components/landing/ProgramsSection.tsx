'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { TiltCard } from './TiltCard';

const programs = [
  {
    index: 'Program I',
    name: 'IBA DU',
    fullName: 'Institute of Business Administration, Dhaka University',
    subtitle: 'The gold standard of business education in Bangladesh.',
    subjects: ['English', 'Mathematics', 'Analytical Ability'],
    includes: 'Prepares you for both IBA DU and BUP IBA.',
    detail:
      'Two exams, one curriculum. Weekly mocks cut from past papers. Writing sections workshopped live. Analytical drills tuned to each question family.',
    href: '/program#iba',
    cta: 'Read the prospectus',
    bgClass: 'bg-[#FAF5EF]',
    accent: '#760F13',
    fg: '#1A0507',
  },
  {
    index: 'Program II',
    name: 'DU FBS',
    fullName: 'Faculty of Business Studies, C-Unit',
    subtitle: 'Comprehensive preparation for DU FBS and BUP FBS.',
    subjects: ['Accounting', 'Finance', 'Marketing', 'Management'],
    includes: 'Covers both C-Unit and BUP FBS exam formats.',
    detail:
      'Built around the accounting-heavy reality of the C-unit test. Live problem-solving sessions. Founder-built question bank with 2,000+ drilled items.',
    href: '/program#fbs',
    cta: 'Read the prospectus',
    bgClass: 'bg-[#1A0507]',
    accent: '#D4B094',
    fg: '#FAF5EF',
  },
];

export function ProgramsSection() {
  return (
    <section className="relative bg-[#F5EDE3] py-28 sm:py-36 lg:py-44 overflow-hidden">
      {/* Baseline ledger texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, #1A0507 39px, #1A0507 40px)',
        }}
      />

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Header */}
        <div className="mb-20 lg:mb-28 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#A86E58] mb-5 flex items-center gap-3"
            >
              <span className="w-8 h-px bg-[#A86E58]" />
              Chapter Four / The Programs
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="font-heading text-[#1A0507] text-[clamp(2.5rem,7vw,6rem)] leading-[0.92] tracking-[-0.02em] font-light"
            >
              Two pathways,{' '}
              <em className="font-extralight text-[#760F13]">one chapter</em> each.
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="lg:col-span-4 font-sans text-[#1A0507]/60 text-sm sm:text-base leading-relaxed max-w-sm lg:justify-self-end"
          >
            We don&rsquo;t believe in generic prep. Each program is built around a single
            exam family. No filler, no optional modules.
          </motion.p>
        </div>

        {/* Asymmetric program layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {programs.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 1, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              className={i === 0 ? 'lg:col-span-7' : 'lg:col-span-5 lg:mt-24'}
            >
              <TiltCard
                className={`group relative ${p.bgClass} border border-[#1A0507]/10 rounded-2xl p-8 sm:p-10 lg:p-12 h-full overflow-hidden`}
                maxTilt={6}
                depth={20}
              >
                {/* Giant index watermark */}
                <span
                  className="absolute -top-6 -right-4 font-heading italic text-[clamp(4rem,10vw,8rem)] leading-none pointer-events-none select-none font-extralight"
                  style={{ color: p.accent, opacity: 0.12 }}
                >
                  0{i + 1}
                </span>

                {/* Top meta */}
                <div className="relative flex items-center gap-3 mb-10">
                  <span
                    className="font-sans text-[10px] tracking-[0.3em] uppercase"
                    style={{ color: p.accent }}
                  >
                    {p.index}
                  </span>
                  <span
                    className="flex-1 h-px"
                    style={{ backgroundColor: `${p.accent}40` }}
                  />
                </div>

                {/* Name — oversized serif */}
                <h3
                  className="relative font-heading text-[clamp(2.2rem,4.5vw,4rem)] leading-[1.02] tracking-[-0.02em] font-light mb-3"
                  style={{ color: p.fg }}
                >
                  {p.name}
                </h3>

                <p
                  className="relative font-sans text-xs tracking-[0.15em] uppercase mb-8"
                  style={{ color: `${p.accent}` }}
                >
                  {p.fullName}
                </p>

                <p
                  className="relative font-heading italic text-xl sm:text-2xl font-light leading-[1.25] max-w-md mb-10"
                  style={{ color: `${p.fg}cc` }}
                >
                  {p.subtitle}
                </p>

                {/* Subjects row */}
                <div className="relative flex flex-wrap gap-2 mb-10">
                  {p.subjects.map((s) => (
                    <span
                      key={s}
                      className="font-sans text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-full border"
                      style={{
                        color: p.accent,
                        borderColor: `${p.accent}40`,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Reveal-on-hover detail paragraph */}
                <div className="relative overflow-hidden mb-6">
                  <motion.p
                    initial={false}
                    className="font-sans text-sm leading-relaxed max-w-md"
                    style={{ color: `${p.fg}99` }}
                  >
                    {p.includes}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0, y: 8, height: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="font-sans text-sm leading-relaxed max-w-md mt-3 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all duration-500"
                    style={{ color: `${p.fg}77` }}
                  >
                    {p.detail}
                  </motion.p>
                </div>

                {/* CTA link with underline-draw */}
                <Link
                  href={p.href}
                  className="relative inline-flex items-center gap-3 group/cta"
                  style={{ color: p.accent }}
                >
                  <span className="font-sans text-sm font-medium tracking-wide">
                    {p.cta}
                  </span>
                  <span className="relative w-4 h-4 overflow-hidden">
                    <ArrowUpRight
                      className="absolute inset-0 w-4 h-4 transition-transform duration-300 group-hover/cta:translate-x-4 group-hover/cta:-translate-y-4"
                      strokeWidth={1.5}
                    />
                    <ArrowUpRight
                      className="absolute inset-0 w-4 h-4 -translate-x-4 translate-y-4 transition-transform duration-300 group-hover/cta:translate-x-0 group-hover/cta:translate-y-0"
                      strokeWidth={1.5}
                    />
                  </span>
                  <motion.span
                    className="absolute -bottom-1 left-0 h-px"
                    style={{ backgroundColor: p.accent, width: '0%' }}
                    whileHover={{ width: '100%' }}
                  />
                </Link>

                {/* Corner brackets */}
                <span
                  className="absolute top-6 left-8 w-4 h-px"
                  style={{ backgroundColor: `${p.accent}60` }}
                />
                <span
                  className="absolute top-6 left-8 w-px h-4"
                  style={{ backgroundColor: `${p.accent}60` }}
                />
                <span
                  className="absolute bottom-8 right-10 w-4 h-px"
                  style={{ backgroundColor: `${p.accent}60` }}
                />
                <span
                  className="absolute bottom-8 right-10 w-px h-4 -translate-y-4"
                  style={{ backgroundColor: `${p.accent}60` }}
                />
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
