'use client';

import React from 'react';
import { Video, PlayCircle, Paperclip, BookOpen } from 'lucide-react';
import { OK, INFO, SLATE, MUTED, BORDER_FIELD, T_SM } from '../tokens';
import type { ClassMarks } from './group-sort';

type MarkKey = 'bot' | 'rec' | 'mat' | 'hw';

const META: Record<MarkKey, { name: string; Icon: typeof Video; color: string }> = {
  bot: { name: 'Recording bot sent', Icon: Video, color: INFO },
  rec: { name: 'Recording ready', Icon: PlayCircle, color: OK },
  mat: { name: 'Material attached', Icon: Paperclip, color: SLATE },
  hw: { name: 'Homework set', Icon: BookOpen, color: SLATE },
};

function Mark({ k, on, count }: { k: MarkKey; on: boolean; count?: number }) {
  const { name, Icon, color } = META[k];
  return (
    <span
      role="img"
      aria-label={`${name}: ${on ? (count && count > 1 ? count : 'yes') : 'no'}`}
      title={on ? name : `${name}: none`}
      className={`kit-mark${on ? '' : ' kit-mark-off'}`}
      style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color }}
    >
      {on && <Icon size={14} aria-hidden />}
      {on && count != null && count > 1 && <span className="kit-count" aria-hidden>{count}</span>}
    </span>
  );
}

/**
 * Four fixed slots (bot, recording, material, homework). A missing mark is a
 * dashed empty box rather than nothing, so the column stays aligned and a gap
 * is visible by shape, not only by colour.
 */
export function StatusMarks({ marks }: { marks: ClassMarks }) {
  return (
    <span role="group" aria-label="Class status" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 22px)', gap: 2, flexShrink: 0 }}>
      <Mark k="bot" on={marks.bot} />
      <Mark k="rec" on={marks.rec} />
      <Mark k="mat" on={marks.materials > 0} count={marks.materials} />
      <Mark k="hw" on={marks.homework > 0} count={marks.homework} />
    </span>
  );
}

export function MarksLegend() {
  const keys: MarkKey[] = ['bot', 'rec', 'mat', 'hw'];
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: T_SM, color: MUTED, padding: '8px 14px' }}>
      <b style={{ color: SLATE, fontWeight: 600 }}>Marks</b>
      {keys.map((k) => {
        const { name, Icon, color } = META[k];
        return (
          <span key={k} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <Icon size={14} aria-hidden style={{ color }} />{name}
          </span>
        );
      })}
      <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
        <span aria-hidden style={{ width: 14, height: 14, border: `1px dashed ${BORDER_FIELD}`, borderRadius: 4 }} />
        none yet
      </span>
    </div>
  );
}
