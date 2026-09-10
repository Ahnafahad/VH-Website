'use client';

/**
 * Small syllabus checkbox filter — shown at the top of Study and Practice.
 * Unchecked syllabuses drop out of the unlocked word set everywhere
 * (access-check.ts), for both trial and full-access users. An empty
 * selection means "no filter set" so every checkbox starts checked.
 */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Syllabus { id: number; name: string }

export default function SyllabusFilterRow({ syllabuses, selectedIds }: {
  syllabuses: Syllabus[];
  selectedIds: number[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(selectedIds.length > 0 ? selectedIds : syllabuses.map(s => s.id)),
  );
  const [failed, setFailed] = useState(false);

  // Re-sync when the server sends a fresh selection (e.g. after router.refresh()
  // or a change made elsewhere, like the reduced-onboarding flow) — the useState
  // initializer above only runs once on mount and would otherwise go stale.
  useEffect(() => {
    setSelected(new Set(selectedIds.length > 0 ? selectedIds : syllabuses.map(s => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(',')]);

  if (syllabuses.length < 2) return null;

  const toggle = (id: number) => {
    const previous = selected;
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size === 1) return; // at least one syllabus must stay selected
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
    setFailed(false);
    startTransition(async () => {
      const res = await fetch('/api/vocab/syllabuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', syllabusIds: [...next] }),
      });
      if (!res.ok) {
        setSelected(previous);
        setFailed(true);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, opacity: isPending ? 0.6 : 1 }}
        aria-label="Filter by syllabus"
      >
        {syllabuses.map(s => {
          const on = selected.has(s.id);
          return (
            <motion.button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={on}
              disabled={isPending}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                minHeight: 32,
                padding: '6px 12px 6px 8px',
                borderRadius: 999,
                fontFamily: "'Sora', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                background: on ? 'rgba(230,57,70,0.10)' : 'var(--color-lx-elevated)',
                border: `1px solid ${on ? 'var(--color-lx-accent-red)' : 'var(--color-lx-border)'}`,
                boxShadow: on ? '0 0 0 3px rgba(230,57,70,0.08)' : 'none',
                color: on ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-muted)',
                cursor: isPending ? 'default' : 'pointer',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 14, height: 14, borderRadius: 4,
                  background: on ? 'var(--color-lx-accent-red)' : 'transparent',
                  border: `1px solid ${on ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-muted)'}`,
                  flexShrink: 0,
                }}
              >
                {on && <Check size={10} strokeWidth={3} color="#fff" />}
              </span>
              {s.name}
            </motion.button>
          );
        })}
      </div>
      {failed && (
        <p
          role="alert"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.7rem',
            color: 'var(--color-lx-danger)',
            margin: 0,
          }}
        >
          Couldn’t save that — check your connection and try again.
        </p>
      )}
    </div>
  );
}
