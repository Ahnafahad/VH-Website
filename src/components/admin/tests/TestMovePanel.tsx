'use client';

/**
 * TestMovePanel — inline "Move to…" chooser shared by the library rows, the bulk
 * bar and the test page header. Deliberately an inline block, not a popover: the
 * library rows scroll horizontally inside their own container, which would clip
 * a floating menu.
 */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  BORDER, BORDER_FIELD, INK_SOFT, MUTED, R_SM, RED, SLATE, SURFACE, SURFACE_ALT, T_BASE, T_SM, T_XS,
} from '../lms/tokens';
import { UNSORTED, CATEGORY_MAX_LENGTH, normalizeCategory } from '@/lib/tests/library';

export interface TestMovePanelProps {
  /** Existing named categories. */
  categories: string[];
  /** The category the selection currently sits in (single move), to mark it. */
  current?: string | null;
  /** How many tests will move. */
  count: number;
  busy?: boolean;
  onMove: (category: string | null) => void;
  onClose: () => void;
}

export default function TestMovePanel({ categories, current, count, busy, onMove, onClose }: TestMovePanelProps) {
  const [name, setName] = useState('');
  const fresh = normalizeCategory(name);

  const chip = (label: string, value: string | null) => {
    const isCurrent = current !== undefined && (current ?? null) === value;
    return (
      <button
        key={label}
        type="button"
        className="lms-btn lms-btn-ghost"
        disabled={busy || isCurrent}
        aria-pressed={isCurrent}
        onClick={() => onMove(value)}
        style={{
          padding: '5px 10px', borderRadius: R_SM, fontSize: T_SM, fontWeight: 600,
          background: isCurrent ? SURFACE_ALT : SURFACE, color: SLATE,
          border: `1px solid ${isCurrent ? BORDER_FIELD : BORDER}`,
          cursor: busy || isCurrent ? 'default' : 'pointer',
        }}
      >
        {label}{isCurrent ? ' (current)' : ''}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={`Move ${count} test${count === 1 ? '' : 's'} to a category`}
      style={{
        border: `1px solid ${BORDER}`, background: SURFACE_ALT, borderRadius: R_SM,
        padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: T_XS, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: MUTED }}>
          Move {count} test{count === 1 ? '' : 's'} to…
        </span>
        <button
          type="button" onClick={onClose} aria-label="Close move panel"
          className="lms-iconbtn"
          style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid transparent`, borderRadius: R_SM, padding: 4, cursor: 'pointer', color: INK_SOFT, display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {categories.map(c => chip(c, c))}
        {chip(UNSORTED, null)}
      </div>
      <form
        onSubmit={e => { e.preventDefault(); if (fresh) onMove(fresh); }}
        style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <input
          className="lms-field"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={CATEGORY_MAX_LENGTH}
          placeholder="New category name"
          aria-label="New category name"
          style={{
            flex: '1 1 180px', minWidth: 0, padding: '6px 10px', borderRadius: R_SM,
            border: `1px solid ${BORDER_FIELD}`, fontSize: T_BASE, background: SURFACE, color: SLATE,
          }}
        />
        <button
          type="submit"
          className="lms-btn lms-btn-primary"
          disabled={busy || !fresh}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: R_SM,
            border: 'none', background: RED, color: SURFACE, fontSize: T_SM, fontWeight: 600,
            cursor: busy || !fresh ? 'not-allowed' : 'pointer', opacity: busy || !fresh ? 0.6 : 1,
          }}
        >
          <Plus size={13} /> Create and move
        </button>
      </form>
    </div>
  );
}
