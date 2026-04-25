'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { BorderBeam } from '@/components/ui/border-beam';

type Card = {
  index: string;
  kicker: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: readonly string[];
  href: string;
  cta: string;
  tone: 'quiet' | 'loud';
};

export default function RegistrationChooserPage() {
  const year = new Date().getFullYear();

  const cards: readonly Card[] = [
    {
      index: '01',
      kicker: 'No commitment',
      title: 'Just the games',
      subtitle: 'Free forever. 30 seconds to sign up.',
      description:
        'Play mental math drills. Work through LexiCore vocabulary. Use every free resource we publish. No calls, no fees.',
      bullets: ['Gmail + WhatsApp', 'Instant access after Google sign-in', 'Nothing else, ever'],
      href: '/registration/games',
      cta: 'Create free access',
      tone: 'quiet',
    },
    {
      index: '02',
      kicker: 'Early-bird advantage',
      title: 'The full program',
      subtitle: 'Register your interest. Lock in current rates.',
      description:
        `The ${year} cohort starts in July. Register now to secure a seat, unlock Early-bird rates, and get notified first when the cohort opens.`,
      bullets: [
        'Full program interest form',
        'Early-bird advantage locked in',
        'Invitation to the cohort WhatsApp group',
      ],
      href: '/registration/courses',
      cta: 'Register interest',
      tone: 'loud',
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#FAF5EF] text-[#1A0507] overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, #1A0507 39px, #1A0507 40px)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212,176,148,0.22), transparent 60%)',
        }}
      />

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 pb-24 sm:pt-28 lg:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#A86E58] mb-8 flex items-center gap-3"
        >
          <span className="w-8 h-px bg-[#A86E58]" />
          Chapter Four / Choose your path
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="font-heading text-[clamp(2.5rem,7vw,6rem)] leading-[0.92] tracking-[-0.02em] font-light max-w-5xl"
        >
          How close <em className="font-extralight text-[#760F13]">are you</em>
          <br />
          to us?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="mt-8 font-sans text-base sm:text-lg text-[#1A0507]/60 leading-relaxed max-w-xl"
        >
          Two doors. One opens to the free games and resources. The other to the full {year} cohort.
          You know which one.
        </motion.p>

        <div className="mt-16 lg:mt-20 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          {cards.map((c, i) => (
            <ChooserCard key={c.index} card={c} i={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-20 flex items-center gap-4 text-[#A86E58]/80 max-w-2xl"
        >
          <span className="flex-1 h-px bg-[#A86E58]/20" />
          <span className="font-heading italic text-sm font-extralight">
            Either way, you&rsquo;re already in the right place.
          </span>
          <span className="flex-1 h-px bg-[#A86E58]/20" />
        </motion.div>
      </div>
    </div>
  );
}

function ChooserCard({
  card,
  i,
}: {
  card: Card;
  i: number;
}) {
  const isLoud = card.tone === 'loud';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={card.href} className="block group">
        <motion.div
          whileHover={{ y: -6 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          className={[
            'relative h-full overflow-hidden rounded-2xl p-8 sm:p-10 lg:p-12 border transition-shadow duration-500',
            isLoud
              ? 'bg-[#1A0507] text-[#FAF5EF] border-[#D4B094]/30 shadow-[0_30px_80px_-30px_rgba(90,11,15,0.45),0_6px_20px_-10px_rgba(90,11,15,0.15)] group-hover:shadow-[0_40px_100px_-30px_rgba(90,11,15,0.65),0_10px_30px_-10px_rgba(212,176,148,0.2)]'
              : 'bg-white/60 backdrop-blur-sm text-[#1A0507] border-[#D4B094]/40 shadow-[0_20px_60px_-30px_rgba(90,11,15,0.18),0_4px_14px_-6px_rgba(90,11,15,0.08)] group-hover:shadow-[0_30px_90px_-30px_rgba(90,11,15,0.3),0_8px_24px_-8px_rgba(212,176,148,0.3)]',
          ].join(' ')}
        >
          {isLoud && (
            <BorderBeam
              size={260}
              duration={12}
              colorFrom="#D4B094"
              colorTo="#A86E58"
              borderWidth={1.5}
            />
          )}

          <span
            className={`absolute top-5 left-5 w-4 h-px ${isLoud ? 'bg-[#D4B094]/50' : 'bg-[#A86E58]/50'}`}
          />
          <span
            className={`absolute top-5 left-5 w-px h-4 ${isLoud ? 'bg-[#D4B094]/50' : 'bg-[#A86E58]/50'}`}
          />
          <span
            className={`absolute bottom-5 right-5 w-4 h-px ${isLoud ? 'bg-[#D4B094]/50' : 'bg-[#A86E58]/50'}`}
          />
          <span
            className={`absolute bottom-5 right-5 w-px h-4 -translate-y-4 ${isLoud ? 'bg-[#D4B094]/50' : 'bg-[#A86E58]/50'}`}
          />

          <span
            aria-hidden
            className={`absolute -top-6 -right-2 font-heading italic text-[7rem] sm:text-[9rem] leading-none font-extralight pointer-events-none select-none ${isLoud ? 'text-[#D4B094]/15' : 'text-[#D4B094]/30'}`}
          >
            {card.index}
          </span>

          <div className="relative">
            <div
              className={`font-sans text-[10px] tracking-[0.3em] uppercase mb-6 ${isLoud ? 'text-[#D4B094]' : 'text-[#A86E58]'}`}
            >
              {card.kicker}
            </div>

            <h2
              className={`font-heading text-[clamp(1.875rem,3.5vw,3rem)] leading-[1.05] tracking-[-0.015em] font-light ${isLoud ? 'text-[#FAF5EF]' : 'text-[#1A0507]'}`}
            >
              {card.title}
            </h2>

            <p
              className={`mt-3 font-heading italic text-lg sm:text-xl font-extralight leading-snug max-w-sm ${isLoud ? 'text-[#D4B094]/80' : 'text-[#760F13]/80'}`}
            >
              {card.subtitle}
            </p>

            <p
              className={`mt-8 font-sans text-sm sm:text-base leading-relaxed max-w-md ${isLoud ? 'text-[#FAF5EF]/70' : 'text-[#1A0507]/70'}`}
            >
              {card.description}
            </p>

            <ul className="mt-8 space-y-2.5">
              {card.bullets.map((b) => (
                <li
                  key={b}
                  className={`flex items-start gap-3 font-sans text-sm ${isLoud ? 'text-[#FAF5EF]/75' : 'text-[#1A0507]/75'}`}
                >
                  <span
                    className={`mt-2 w-4 h-px ${isLoud ? 'bg-[#D4B094]' : 'bg-[#A86E58]'}`}
                  />
                  {b}
                </li>
              ))}
            </ul>

            <div
              className={`mt-10 inline-flex items-center gap-3 font-sans text-sm tracking-wide ${isLoud ? 'text-[#FAF5EF]' : 'text-[#1A0507]'}`}
            >
              <span className="relative overflow-hidden inline-block">
                <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-full">
                  {card.cta}
                </span>
                <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0">
                  {card.cta}
                </span>
              </span>
              <span className="relative w-4 h-4 overflow-hidden">
                <ArrowUpRight
                  className="absolute inset-0 w-4 h-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-4 group-hover:-translate-y-4"
                  strokeWidth={1.5}
                />
                <ArrowUpRight
                  className="absolute inset-0 w-4 h-4 -translate-x-4 translate-y-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0 group-hover:translate-y-0"
                  strokeWidth={1.5}
                />
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
