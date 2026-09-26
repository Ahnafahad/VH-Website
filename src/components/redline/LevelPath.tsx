'use client';

import Link from 'next/link';
import { Lock, Check } from 'lucide-react';
import type { RedlineLevelTile } from '@/lib/redline/types';

const CHAPTER_SIZE = 6;
const CHAPTERS = ['Warm-up', 'Foundations', 'Core', 'Sharpening', 'Pressure', 'Trap alley', 'Redline'];

function Tile({ t }: { t: RedlineLevelTile }) {
  const base = 'relative rounded-xl border p-3 min-h-[84px] flex flex-col justify-between transition-colors';
  if (t.status === 'locked') {
    return (
      <div className={`${base} border-exam-border bg-exam-surface/60 text-exam-ink-faint`} aria-label={`Level ${t.level}, locked`}>
        <span className="font-serif text-2xl">{t.level}</span>
        <Lock className="w-4 h-4" aria-hidden />
      </div>
    );
  }
  const done = t.status === 'done';
  const href = done ? `/redline/level/${t.level}?replay=1` : `/redline/level/${t.level}`;
  return (
    <Link
      href={href}
      className={`${base} ${done ? 'border-exam-success/50 bg-exam-success/10 hover:border-exam-success' : 'border-exam-gold/60 bg-exam-elevated hover:border-exam-gold-bright'}`}
    >
      <div className="flex items-start justify-between">
        <span className="font-serif text-2xl text-exam-ink">{t.level}</span>
        {done && <Check className="w-4 h-4 text-exam-success" aria-hidden />}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wide text-exam-ink-muted">
        {done && t.firstScore ? `${t.firstScore.correct}/${t.firstScore.total} · replay` : t.inProgress ? 'Continue' : 'Start'}
      </span>
    </Link>
  );
}

export default function LevelPath({ levels }: { levels: RedlineLevelTile[] }) {
  const chapters: RedlineLevelTile[][] = [];
  for (let i = 0; i < levels.length; i += CHAPTER_SIZE) chapters.push(levels.slice(i, i + CHAPTER_SIZE));
  return (
    <div className="space-y-6">
      {chapters.map((tiles, ci) => (
        <div key={ci}>
          <p className="text-xs font-bold uppercase tracking-widest text-exam-ink-faint mb-2">
            {CHAPTERS[ci] ?? `Chapter ${ci + 1}`} <span className="font-normal normal-case tracking-normal">· levels {tiles[0].level}–{tiles[tiles.length - 1].level}</span>
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {tiles.map(t => <Tile key={t.level} t={t} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
