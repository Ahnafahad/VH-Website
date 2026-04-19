'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { ScrambleNumber } from './ScrambleNumber';

const stats = [
  {
    value: 1.2,
    decimals: 1,
    suffix: '%',
    label: 'IBA acceptance rate',
    context: 'More selective than Harvard (3.5%)',
    year: '2024',
  },
  {
    value: 46.7,
    decimals: 1,
    suffix: '%',
    label: 'Our success rate',
    context: '14 of 30 students placed',
    year: '2024',
  },
  {
    value: 14,
    decimals: 0,
    suffix: '',
    label: 'Students placed',
    context: 'Across IBA DU, BUP, and DU FBS',
    year: '2024',
  },
];

export function SocialProofSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const textY = useTransform(scrollYProgress, [0, 1], ['20%', '-20%']);

  return (
    <section
      ref={ref}
      className="relative bg-[#FAF5EF] text-[#1A0507] py-28 sm:py-36 lg:py-44 overflow-hidden"
    >
      {/* Baseline ledger rule */}
      <div
        className="absolute inset-x-0 top-0 h-px bg-[#1A0507]/10"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-px bg-[#1A0507]/10"
        aria-hidden
      />

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Section label + small heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-20 sm:mb-28"
        >
          <div>
            <div className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#A86E58] mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-[#A86E58]" />
              Chapter Three / The Record
            </div>
            <h2 className="font-heading text-[#1A0507] text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.02em] font-light max-w-2xl">
              Numbers that <em className="font-extralight text-[#760F13]">aren&rsquo;t</em> rounded.
            </h2>
          </div>
          <motion.div
            style={{ y: textY }}
            className="font-sans text-xs tracking-[0.2em] uppercase text-[#A86E58] text-right"
          >
            <div>Placements</div>
            <div className="text-[#1A0507]/40">2024 Cycle</div>
          </motion.div>
        </motion.div>

        {/* Stats grid — asymmetric */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-y-20 md:gap-y-24 md:gap-x-8">
          {stats.map((s, i) => {
            // Asymmetric positions: 1st col spans 5, 2nd 4 offset 1, 3rd 5 offset 1
            const colClass =
              i === 0
                ? 'md:col-span-5'
                : i === 1
                ? 'md:col-span-4 md:col-start-6 md:mt-16'
                : 'md:col-span-6 md:col-start-4 md:mt-8';

            return (
              <motion.article
                key={s.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 1, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className={`relative ${colClass}`}
              >
                {/* Index + year row */}
                <div className="flex items-center gap-4 mb-5">
                  <span className="font-heading italic text-[#D4B094] text-base">
                    0{i + 1}
                  </span>
                  <span className="flex-1 h-px bg-[#1A0507]/10" />
                  <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58]">
                    {s.year}
                  </span>
                </div>

                {/* Oversized number */}
                <div className="font-heading text-[#1A0507] leading-[0.85] tracking-[-0.05em]">
                  <ScrambleNumber
                    value={s.value}
                    decimals={s.decimals}
                    suffix={s.suffix}
                    className="text-[clamp(5rem,16vw,11rem)] font-light block"
                    delay={i * 150}
                  />
                </div>

                {/* Label — large serif italic */}
                <p className="mt-6 font-heading italic text-[#760F13] text-xl sm:text-2xl font-light leading-tight tracking-[-0.01em]">
                  {s.label}.
                </p>

                {/* Context — small sans */}
                <p className="mt-3 font-sans text-sm text-[#1A0507]/50 leading-relaxed max-w-xs">
                  {s.context}
                </p>

                {/* Footnote mark */}
                <span className="absolute -top-2 -right-2 font-heading italic text-[#D4B094] text-sm">
                  {['\u2020', '\u2021', '\u00a7'][i]}
                </span>
              </motion.article>
            );
          })}
        </div>

        {/* Footnote bar — editorial reference */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-24 pt-8 border-t border-[#1A0507]/10 grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans text-[11px] text-[#1A0507]/50 leading-relaxed"
        >
          <p>
            <span className="font-heading italic text-[#760F13] mr-1">{'\u2020'}</span>
            IBA acceptance based on ~3,200 applicants annually for 120 seats.
          </p>
          <p>
            <span className="font-heading italic text-[#760F13] mr-1">{'\u2021'}</span>
            Success = admission offer received at any target institution.
          </p>
          <p>
            <span className="font-heading italic text-[#760F13] mr-1">{'\u00a7'}</span>
            Across four target programs, 2024 cohort of 30 students.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
