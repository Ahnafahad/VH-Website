'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Particles } from '@/components/ui/particles';

const bullets = [
  {
    k: 'Calendar',
    h: 'Classes begin July',
    s: 'Three sessions per week. Runs through the admission window.',
  },
  {
    k: 'Format',
    h: 'Online + Dhanmondi',
    s: 'Attend live or join in person. Same curriculum, same faculty.',
  },
  {
    k: 'Intake',
    h: 'Seats capped',
    s: 'We keep batches small so the founders can still teach every session.',
  },
  {
    k: 'Eligibility',
    h: 'Built for A-levels',
    s: 'If you\u2019re sitting the IAL, the course is already tuned to you.',
  },
];

export function RegistrationCTASection() {
  return (
    <section className="relative bg-[#1A0507] text-[#FAF5EF] overflow-hidden">
      {/* Particle field */}
      <Particles
        className="absolute inset-0"
        quantity={60}
        ease={70}
        color="#D4B094"
        staticity={30}
      />

      {/* Radial warm glow */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(212,176,148,0.18), transparent 60%)',
        }}
      />

      {/* Top horizon rule */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#D4B094]/40 to-transparent" />

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pt-28 pb-12 sm:pt-36 lg:pt-44">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#D4B094] mb-6 flex items-center gap-3"
        >
          <span className="w-8 h-px bg-[#D4B094]" />
          Chapter Five / The Invitation
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end">
          {/* LEFT — giant editorial headline */}
          <div className="lg:col-span-7">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="font-heading text-[clamp(2.8rem,8vw,7rem)] leading-[0.9] tracking-[-0.03em] font-light"
            >
              Your seat at the <em className="font-extralight text-[#D4B094]">same table</em> we once sat.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.2 }}
              className="mt-10 font-sans text-[#FAF5EF]/60 text-base sm:text-lg leading-relaxed max-w-xl"
            >
              Registration for the 2026 cohort is open. Three sessions a week, July through
              admissions season. Every instructor sat the exams you&rsquo;re about to write.
            </motion.p>
          </div>

          {/* RIGHT — CTA card stack */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5"
          >
            <div className="relative rounded-2xl border border-[#D4B094]/20 bg-gradient-to-br from-[#2A0708]/90 to-[#1A0507]/80 backdrop-blur-sm p-8 sm:p-10 overflow-hidden">
              {/* Corner index */}
              <span className="absolute -top-2 -right-2 font-heading italic text-[#D4B094]/20 text-[6rem] font-extralight leading-none pointer-events-none select-none">
                05
              </span>

              <div className="relative font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094] mb-8">
                The Invitation
              </div>

              <h3 className="relative font-heading font-light text-[#FAF5EF] text-3xl sm:text-4xl leading-[1.05] tracking-[-0.02em] mb-4">
                Save your seat.
              </h3>
              <p className="relative font-heading italic text-[#D4B094]/80 text-lg leading-snug mb-10 font-extralight max-w-xs">
                Before the batch closes.
              </p>

              <Link
                href="/registration"
                className="group/cta relative inline-flex items-center gap-3 rounded-full bg-[#FAF5EF] text-[#1A0507] px-8 py-4 font-sans text-sm sm:text-base font-medium tracking-wide transition-all duration-500 hover:bg-[#D4B094] hover:shadow-[0_10px_40px_-10px_rgba(212,176,148,0.5)]"
              >
                <span className="relative overflow-hidden">
                  <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:-translate-y-full">
                    Register for 2026
                  </span>
                  <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-y-0">
                    Register for 2026
                  </span>
                </span>
                <span className="relative w-5 h-5 overflow-hidden">
                  <ArrowUpRight
                    className="absolute inset-0 w-5 h-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-x-5 group-hover/cta:-translate-y-5"
                    strokeWidth={1.5}
                  />
                  <ArrowUpRight
                    className="absolute inset-0 w-5 h-5 -translate-x-5 translate-y-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-x-0 group-hover/cta:translate-y-0"
                    strokeWidth={1.5}
                  />
                </span>
              </Link>

              <Link
                href="/eligibility-checker"
                className="relative mt-5 inline-flex items-center gap-3 font-sans text-sm text-[#D4B094]/80 hover:text-[#FAF5EF] transition-colors group/check"
              >
                <span className="w-6 h-px bg-current transition-all duration-300 group-hover/check:w-10" />
                Check eligibility first
              </Link>

              {/* Corner brackets */}
              <span className="absolute top-6 left-6 w-4 h-px bg-[#D4B094]/40" />
              <span className="absolute top-6 left-6 w-px h-4 bg-[#D4B094]/40" />
              <span className="absolute bottom-6 right-6 w-4 h-px bg-[#D4B094]/40" />
              <span className="absolute bottom-6 right-6 w-px h-4 -translate-y-4 bg-[#D4B094]/40" />
            </div>
          </motion.div>
        </div>

        {/* Editorial bullet grid */}
        <div className="mt-24 lg:mt-32 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px border-t border-[#D4B094]/15 border-l">
          {bullets.map((b, i) => (
            <motion.div
              key={b.h}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative p-6 sm:p-8 border-r border-b border-[#D4B094]/15 group"
            >
              <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/60 mb-4 flex items-center gap-2">
                <span className="font-heading italic text-[#D4B094] not-italic-none">
                  0{i + 1}
                </span>
                <span className="flex-1 h-px bg-[#D4B094]/15" />
                {b.k}
              </div>
              <h4 className="font-heading text-[#FAF5EF] text-xl sm:text-2xl font-light leading-tight tracking-[-0.01em] mb-3">
                {b.h}
              </h4>
              <p className="font-sans text-sm text-[#FAF5EF]/50 leading-relaxed">
                {b.s}
              </p>
              {/* Reveal underline on hover */}
              <span className="absolute left-0 bottom-0 h-px bg-[#D4B094] w-0 group-hover:w-full transition-all duration-700 ease-out" />
            </motion.div>
          ))}
        </div>
      </div>

    </section>
  );
}
