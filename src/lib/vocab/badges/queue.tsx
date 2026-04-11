'use client';

/**
 * BadgeQueueProvider — T28
 *
 * Manages a FIFO queue of earned badges to be celebrated one at a time.
 * Components call `useBadgeQueue().push(badges)` to enqueue newly earned badges.
 * The provider renders <BadgeCelebration> for the current head of the queue;
 * when it dismisses, the next badge is dequeued automatically.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { EarnedBadge } from './checker';
import BadgeCelebration from '@/components/vocab/BadgeCelebration';
import { AnimatePresence } from 'framer-motion';

// ─── Context ─────────────────────────────────────────────────────────────────

interface BadgeQueueContextValue {
  /** Enqueue one or more newly earned badges to be celebrated. */
  push: (badges: EarnedBadge[]) => void;
}

const BadgeQueueContext = createContext<BadgeQueueContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BadgeQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<EarnedBadge[]>([]);

  // Add badges to the end of the queue (dedup by id to be safe).
  const push = useCallback((badges: EarnedBadge[]) => {
    if (badges.length === 0) return;
    setQueue(prev => {
      const existingIds = new Set(prev.map(b => b.id));
      const fresh = badges.filter(b => !existingIds.has(b.id));
      return [...prev, ...fresh];
    });
  }, []);

  // Called by BadgeCelebration when the user dismisses (or auto-dismiss fires).
  const dismiss = useCallback(() => {
    setQueue(prev => prev.slice(1));
  }, []);

  const current = queue[0] ?? null;

  return (
    <BadgeQueueContext.Provider value={{ push }}>
      {children}
      <AnimatePresence mode="wait">
        {current && (
          <BadgeCelebration
            key={current.id}
            badge={current}
            onDismiss={dismiss}
          />
        )}
      </AnimatePresence>
    </BadgeQueueContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBadgeQueue(): BadgeQueueContextValue {
  const ctx = useContext(BadgeQueueContext);
  if (!ctx) {
    throw new Error('useBadgeQueue must be used inside <BadgeQueueProvider>');
  }
  return ctx;
}
