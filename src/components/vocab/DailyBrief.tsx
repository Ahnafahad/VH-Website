'use client';

import { BookOpenText, X } from 'lucide-react';

export function DailyBrief({ message, onOpen, onDismiss }: { message: string; onOpen: () => void; onDismiss: () => void }) {
  return (
    <aside className="lx-daily-brief" aria-label="Today’s note from L">
      <button className="lx-daily-brief-main" type="button" onClick={onOpen}>
        <span className="lx-daily-brief-icon" aria-hidden><BookOpenText size={18} /></span>
        <span className="lx-daily-brief-copy">
          <strong>Today’s note from L</strong>
          <span>{message}</span>
        </span>
        <span className="lx-daily-brief-open" aria-hidden>Read</span>
      </button>
      <button className="lx-daily-brief-close" type="button" onClick={onDismiss} aria-label="Dismiss today’s note"><X size={16} /></button>
    </aside>
  );
}
