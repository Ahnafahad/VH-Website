'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { BookOpenText, Calculator, ClipboardList, CalendarPlus, Route } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { DashboardGames } from '@/lib/lms/dashboard-data';

interface Props {
  games: DashboardGames;
}

interface GameBlock {
  name: string;
  href: string;
  icon: React.ComponentType<LucideProps>;
  stat: (games: DashboardGames) => string;
  secondary?: (games: DashboardGames) => string | null;
}

const BLOCKS: GameBlock[] = [
  {
    name: 'LexiCore',
    href: '/vocab/home',
    icon: BookOpenText,
    stat: (g) =>
      g.vocab
        ? `${g.vocab.totalPoints.toLocaleString('en-US')} pts · ${g.vocab.streakDays}-day streak`
        : 'Start learning →',
    secondary: (g) =>
      g.vocab
        ? `${g.vocab.masteredCount}/${g.vocab.totalTracked} words mastered`
        : null,
  },
  {
    name: 'Zap',
    href: '/games/mental-math',
    icon: Calculator,
    stat: (g) =>
      g.math
        ? `best ${g.math.bestScore} · ${g.math.overallAccuracy}% acc`
        : 'Play now →',
  },
  {
    name: 'FBS Accounting',
    href: '/games/fbs-accounting',
    icon: ClipboardList,
    stat: (g) =>
      g.accounting
        ? `${g.accounting.totalMastered}/${g.accounting.totalQuestions} mastered`
        : 'Start →',
  },
  {
    name: 'Book Session',
    href: '/dashboard/book',
    icon: CalendarPlus,
    stat: () => 'Book a 1-on-1 →',
  },
  {
    name: 'Marathon',
    href: '/marathon',
    icon: Route,
    stat: () => 'Chapter drills →',
  },
];

export default function GamesStrip({ games }: Props) {
  const prefersReduced = useReducedMotion();
  const visibleBlocks = BLOCKS.filter(block => block.href !== '/games/fbs-accounting' || games.accounting !== null);

  return (
    <div>
      {/* Section marker */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className="font-heading italic text-sm flex-shrink-0"
          style={{ color: '#D4B094' }}
        >
          study tools & support
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(212,176,148,0.16)' }}
      >
        {visibleBlocks.map((block, i) => {
          const Icon = block.icon;
          const statText = block.stat(games);
          const secondaryText = block.secondary?.(games);

          return (
            <motion.div
              key={block.href}
              whileTap={prefersReduced ? {} : { scale: 0.99 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
              style={{
                borderRight: '1px solid rgba(212,176,148,0.16)',
                borderBottom: i < visibleBlocks.length - 1 ? '1px solid rgba(212,176,148,0.16)' : undefined,
              }}
            >
              <Link
                href={block.href}
                className="flex flex-col gap-2 p-5 h-full transition-colors group"
                style={{ minHeight: '44px' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(250,245,239,0.04)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
              >
                <Icon
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: '#D4B094' }}
                  strokeWidth={1.5}
                />
                <span
                  className="font-heading text-lg leading-tight"
                  style={{ color: '#FAF5EF', letterSpacing: '-0.01em' }}
                >
                  {block.name}
                </span>
                <span
                  className="text-sm"
                  style={{
                    fontFamily: 'var(--font-math-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'rgba(250,245,239,0.64)',
                  }}
                >
                  {statText}
                </span>
                {secondaryText && (
                  <span
                    className="text-xs"
                    style={{
                      fontFamily: 'var(--font-math-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'rgba(250,245,239,0.40)',
                    }}
                  >
                    {secondaryText}
                  </span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
