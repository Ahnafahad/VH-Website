/**
 * MasteryBar — a very small, non-cluttering mastery indicator.
 *
 * A 2px underline that fills proportionally to "familiar or above" mastery
 * (familiar + strong + mastered), the same threshold LetterCard's color
 * coding already uses. Deliberately no label/number — the picker rows it
 * sits under (ThemeRow, LetterCard) already show word counts elsewhere.
 */

const TRACK_COLOR = 'rgba(255,255,255,0.06)';

export function masteryBarColor(pct: number): string {
  if (pct <= 0)   return 'var(--color-lx-text-disabled)';
  if (pct >= 80)  return 'var(--color-lx-accent-gold)';
  if (pct >= 40)  return '#f97316';
  return 'var(--color-lx-accent-red)';
}

export function MasteryBar({
  pct, width = '100%',
}: { pct: number; width?: number | string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      aria-hidden
      style={{
        width,
        height:       2,
        borderRadius: 1,
        overflow:     'hidden',
        background:   TRACK_COLOR,
      }}
    >
      <div
        style={{
          height:       '100%',
          width:        `${clamped}%`,
          borderRadius: 1,
          background:   masteryBarColor(clamped),
          transition:   'width 0.3s ease, background-color 0.3s ease',
        }}
      />
    </div>
  );
}
