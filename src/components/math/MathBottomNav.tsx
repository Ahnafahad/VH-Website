'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Activity, BarChart3, Trophy, Settings } from 'lucide-react';

export type MathNavTab = 'play' | 'dashboard' | 'leaderboard' | 'settings';

export interface MathBottomNavProps {
  active:    MathNavTab;
  onChange:  (tab: MathNavTab) => void;
}

interface TabConfig {
  key:   MathNavTab;
  label: string;
  icon:  React.ElementType;
}

const TABS: TabConfig[] = [
  { key: 'play',        label: 'Play',        icon: Activity    },
  { key: 'dashboard',   label: 'Dashboard',   icon: BarChart3   },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy      },
  { key: 'settings',    label: 'Settings',    icon: Settings    },
];

export function MathBottomNav({ active, onChange }: MathBottomNavProps) {
  return (
    <nav
      aria-label="Mental math navigation"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2"
    >
      <div className="relative flex items-center gap-1 rounded-full border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/85 backdrop-blur-xl px-1.5 py-1.5 math-card-shadow">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className={[
                'relative flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 transition-colors duration-300',
                isActive
                  ? 'text-[var(--color-math-base)]'
                  : 'text-[var(--color-math-ink-muted)] hover:text-[var(--color-math-ink)]',
              ].join(' ')}
            >
              {isActive && (
                <motion.span
                  layoutId="math-bottom-limelight"
                  className="absolute inset-0 rounded-full bg-[var(--color-math-accent-gold)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  aria-hidden
                />
              )}
              <Icon size={15} className="relative z-10" strokeWidth={1.8} />
              <span
                className={`relative z-10 hidden sm:inline font-sans text-[10px] tracking-[0.2em] uppercase ${
                  isActive ? 'font-medium' : ''
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
