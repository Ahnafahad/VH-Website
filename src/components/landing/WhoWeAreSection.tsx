'use client';

import { motion } from 'motion/react';
import { useState } from 'react';

const principles = [
  {
    index: 'I.',
    title: 'Taught by those who sat the same exams',
    body:
      'Every instructor is a graduate of IBA DU, BUP, or DU FBS \u2014 from an English-medium background. No translated curriculum, no Bangla-first pedagogy.',
  },
  {
    index: 'II.',
    title: 'A curriculum that bridges the gap',
    body:
      'Original materials written to connect IAL fundamentals with the HSC-style reasoning admission exams require. Nothing imported from elsewhere.',
  },
  {
    index: 'III.',
    title: 'A schedule built around your A-levels',
    body:
      'Three sessions a week starting July. Offline classes in Dhanmondi, or online. Built to run alongside your exam season, not fight it.',
  },
];

export function WhoWeAreSection() {
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouse({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section
      onMouseMove={handleMove}
      className="relative bg-[#1A0507] text-[#FAF5EF] py-28 sm:py-36 lg:py-44 overflow-hidden"
    >
      {/* Cursor-following spotlight */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at ${mouse.x}% ${mouse.y}%, rgba(212,176,148,0.10), transparent 50%)`,
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

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#D4B094] mb-5 flex items-center gap-3"
        >
          <span className="w-8 h-px bg-[#D4B094]" />
          Chapter Two / Who We Are
        </motion.div>

        {/* Oversized editorial heading */}
        <h2 className="font-heading text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] tracking-[-0.02em] font-light max-w-4xl">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block"
          >
            Built by the students
          </motion.span>
          <br />
          <motion.em
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block font-extralight text-[#D4B094]"
          >
            who became the graduates.
          </motion.em>
        </h2>

        {/* Three principles — tri-column editorial grid */}
        <div className="mt-20 lg:mt-28 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 lg:gap-16">
          {principles.map((p, i) => (
            <motion.div
              key={p.index}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-12%' }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="group relative border-t border-[#D4B094]/20 pt-7"
            >
              <div className="flex items-baseline gap-4 mb-4">
                <span className="font-heading italic text-[#D4B094] text-xl">
                  {p.index}
                </span>
                <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#FAF5EF]/40">
                  Principle
                </span>
              </div>
              <h3 className="font-heading text-[#FAF5EF] text-2xl lg:text-[1.75rem] font-light leading-[1.15] tracking-[-0.01em]">
                {p.title}
              </h3>
              <p className="mt-5 font-sans text-[#FAF5EF]/55 text-sm sm:text-base leading-relaxed">
                {p.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
