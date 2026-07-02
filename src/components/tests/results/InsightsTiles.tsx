'use client';

import type { ResultsPayload, SectionScore } from '@/lib/tests/types';

type Me = NonNullable<ResultsPayload['me']>;
type Test = ResultsPayload['test'];

interface Props {
  me: Me;
  test: Test;
}

// ─── Insight tile ─────────────────────────────────────────────────────────────

interface TileData {
  label: string;
  value: string;
  sub?: string;
  color: string;
  caption?: string;
}

function InsightTile({ tile }: { tile: TileData }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--color-exam-surface)', border: '1px solid var(--color-exam-border)' }}
    >
      <span className="text-[var(--color-exam-ink-faint)] text-xs">{tile.label}</span>
      <span
        className="text-2xl font-bold leading-none"
        style={{ color: tile.color }}
      >
        {tile.value}
      </span>
      {tile.sub && (
        <span className="text-[var(--color-exam-ink-muted)] text-xs">{tile.sub}</span>
      )}
      {tile.caption && (
        <p className="text-[var(--color-exam-ink-faint)] text-xs leading-relaxed border-t border-[var(--color-exam-border)] pt-2 mt-1">
          {tile.caption}
        </p>
      )}
    </div>
  );
}

// ─── Compute insights ─────────────────────────────────────────────────────────

function computeInsights(me: Me, test: Test): TileData[] {
  const attempted = me.totalCorrect + me.totalWrong;
  const accuracy = attempted > 0 ? (me.totalCorrect / attempted) * 100 : 0;
  const attemptRate = test.totalQuestions > 0 ? (attempted / test.totalQuestions) * 100 : 0;

  // Worst section: most marks lost (score deficit + negative marking losses)
  let worstSection: SectionScore | null = null;
  let worstDeficit = -Infinity;
  let bestSection: SectionScore | null = null;
  let bestPct = -Infinity;

  for (const s of me.sections) {
    const deficit = s.maxScore - s.score;
    if (deficit > worstDeficit) { worstDeficit = deficit; worstSection = s; }
    if (s.percentage > bestPct) { bestPct = s.percentage; bestSection = s; }
  }

  const tiles: TileData[] = [
    {
      label: 'Accuracy',
      value: `${accuracy.toFixed(1)}%`,
      sub: `${me.totalCorrect} correct of ${attempted} tried`,
      color: accuracy >= 70
        ? 'var(--color-exam-success)'
        : accuracy >= 50
          ? 'var(--color-exam-warning)'
          : 'var(--color-exam-danger)',
      caption: accuracy >= 70
        ? 'Strong selection rate — you chose your battles well.'
        : accuracy < 50
          ? 'Many wrong answers negated your attempts — prefer fewer, more confident picks.'
          : 'Decent accuracy — a bit more selectivity could add marks.',
    },
    {
      label: 'Attempt Rate',
      value: `${attemptRate.toFixed(1)}%`,
      sub: `${attempted} of ${test.totalQuestions} questions`,
      color: 'var(--color-exam-gold)',
      caption: attemptRate >= 80
        ? 'High coverage — you attempted most of the paper.'
        : 'Leaving questions blank is safe when unsure, but practice can raise your comfort.',
    },
  ];

  if (worstSection) {
    tiles.push({
      label: 'Costliest Section',
      value: `−${worstDeficit % 1 === 0 ? worstDeficit : worstDeficit.toFixed(2)}`,
      sub: worstSection.title,
      color: 'var(--color-exam-danger)',
      caption: `${worstSection.title} cost you the most marks — focus revision here for the highest gain.`,
    });
  }

  if (bestSection) {
    tiles.push({
      label: 'Best Section',
      value: `${bestSection.percentage.toFixed(0)}%`,
      sub: bestSection.title,
      color: 'var(--color-exam-success)',
      caption: `Your strongest performance was in ${bestSection.title} — build on this confidence.`,
    });
  }

  return tiles;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InsightsTiles({ me, test }: Props) {
  const tiles = computeInsights(me, test);

  return (
    <div>
      <h2 className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase mb-4">
        Insights
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tiles.map((t) => (
          <InsightTile key={t.label} tile={t} />
        ))}
      </div>
    </div>
  );
}
