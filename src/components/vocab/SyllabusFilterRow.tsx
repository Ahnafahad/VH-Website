'use client';

/**
 * Small syllabus checkbox filter — shown at the top of Study and Practice.
 * Unchecked syllabuses drop out of the unlocked word set everywhere
 * (access-check.ts), for both trial and full-access users. An empty
 * selection means "no filter set" so every checkbox starts checked.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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

  if (syllabuses.length < 2) return null;

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size === 1) return; // at least one syllabus must stay selected
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
    startTransition(async () => {
      await fetch('/api/vocab/syllabuses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', syllabusIds: [...next] }),
      });
      router.refresh();
    });
  };

  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, opacity: isPending ? 0.6 : 1 }}
      aria-label="Filter by syllabus"
    >
      {syllabuses.map(s => {
        const on = selected.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            aria-pressed={on}
            disabled={isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 9px 3px 6px',
              borderRadius: 999,
              fontFamily: "'Sora', sans-serif",
              fontSize: '0.62rem',
              fontWeight: 600,
              background: on ? 'rgba(230,57,70,0.10)' : 'var(--color-lx-elevated)',
              border: `1px solid ${on ? 'var(--color-lx-accent-red)' : 'var(--color-lx-border)'}`,
              color: on ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-muted)',
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 12, height: 12, borderRadius: 3,
                background: on ? 'var(--color-lx-accent-red)' : 'transparent',
                border: `1px solid ${on ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-muted)'}`,
                flexShrink: 0,
              }}
            >
              {on && <Check size={9} strokeWidth={3} color="#fff" />}
            </span>
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
