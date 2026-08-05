'use client';

/**
 * TestAnalytics — teacher/admin overview tab for a single test.
 * Fed by GET /api/admin/tests/[id]/analytics. Staff-only (isStaffRole),
 * same audience as the rest of the admin Tests page — no adminOnly gate here.
 *
 * No topic tags anywhere (explicitly vetoed) — "commonly got wrong" is
 * per-question only. FBS diagnostics are excluded server-side (400
 * DIAGNOSTIC_EXCLUDED) and shown as a plain message, not an error.
 */

import { useCallback, useEffect, useState } from 'react';
import { Eye, ShieldAlert } from 'lucide-react';
import { C, SANS, Spinner, SectionTitle } from './TestsAdminPage';
import type {
  TestAnalytics as TestAnalyticsData,
  ViolationStats,
} from '@/lib/tests/analytics';

interface Props {
  testId: number;
}

interface ApiOk {
  analytics: TestAnalyticsData;
  violations: ViolationStats;
}

export default function TestAnalytics({ testId }: Props) {
  const [data, setData] = useState<ApiOk | null>(null);
  const [loading, setLoading] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setExcluded(false);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/tests/${testId}/analytics`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; code?: string };
        if (body.code === 'DIAGNOSTIC_EXCLUDED') {
          setExcluded(true);
        } else {
          setErrorMsg(body.error ?? 'Failed to load analytics.');
        }
        return;
      }
      const body = (await res.json()) as ApiOk;
      setData(body);
    } catch {
      setErrorMsg('Network error.');
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 8, color: C.textSec, fontSize: 13, fontFamily: SANS }}>
        <Spinner /> Loading analytics…
      </div>
    );
  }

  if (excluded) {
    return (
      <p style={{ fontSize: 13, color: C.textMuted, fontFamily: SANS, margin: 0 }}>
        Analytics are not available for FBS diagnostic tests (excluded per spec).
      </p>
    );
  }

  if (errorMsg) {
    return (
      <p style={{ fontSize: 13, color: C.danger, fontFamily: SANS, margin: 0 }}>{errorMsg}</p>
    );
  }

  if (!data) return null;

  const { analytics: a, violations } = data;

  if (a.participation.attempted === 0) {
    return (
      <div>
        <SectionTitle>Analytics</SectionTitle>
        <p style={{ fontSize: 13, color: C.textMuted, fontFamily: SANS, margin: 0 }}>
          No one has attempted this test yet — {a.participation.eligible} student
          {a.participation.eligible !== 1 ? 's are' : ' is'} eligible.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <SectionTitle>Analytics</SectionTitle>

      {/* Participation & completion */}
      <Grid>
        <Stat label="Attempted" value={`${a.participation.attempted} / ${a.participation.eligible}`}
          sub={`${a.participation.attemptedPercent}% of eligible students`} />
        <Stat label="Completed" value={`${a.completion.submitted} / ${a.completion.attempted}`}
          sub={`${a.completion.completionPercent}% submitted after starting`} />
        <Stat label="Average score" value={`${a.averageScore}`} sub={`${a.averagePercentage}%`} />
        <Stat label="Median score" value={`${a.medianScore}`} />
        <Stat label="Highest score" value={`${a.highestScore}`} />
        <Stat label="Lowest score" value={`${a.lowestScore}`} />
        <Stat label="Std. deviation" value={`${a.stdDevScore}`} />
      </Grid>

      {/* Score distribution */}
      <div>
        <Label>Score distribution</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {a.scoreDistribution.map(b => (
            <DistributionBar key={b.label} label={b.label} count={b.count}
              max={Math.max(1, ...a.scoreDistribution.map(x => x.count))} />
          ))}
        </div>
      </div>

      {/* Per-section */}
      {a.sections.length > 0 && (
        <div>
          <Label>Per-section</Label>
          <Table
            headers={['Section', 'Avg score', 'Avg %', 'Accuracy']}
            rows={a.sections.map(s => [
              s.title,
              `${s.averageScore} / ${s.maxScore}`,
              `${s.averagePercentage}%`,
              s.accuracy != null ? `${s.accuracy}%` : '—',
            ])}
          />
        </div>
      )}

      {/* Most commonly wrong */}
      {a.mostWrong.length > 0 && (
        <div>
          <Label>Most commonly wrong questions</Label>
          <Table
            headers={['Q#', 'Wrong', 'Correct', 'Skipped', 'Accuracy']}
            rows={a.mostWrong.map(q => [
              `#${q.number}`, `${q.wrongCount}`, `${q.correctCount}`, `${q.skippedCount}`,
              q.accuracy != null ? `${q.accuracy}%` : '—',
            ])}
          />
        </div>
      )}

      {/* Most skipped */}
      {a.mostSkipped.length > 0 && (
        <div>
          <Label>Most skipped questions</Label>
          <Table
            headers={['Q#', 'Skipped', 'Correct', 'Wrong', 'Accuracy']}
            rows={a.mostSkipped.map(q => [
              `#${q.number}`, `${q.skippedCount}`, `${q.correctCount}`, `${q.wrongCount}`,
              q.accuracy != null ? `${q.accuracy}%` : '—',
            ])}
          />
        </div>
      )}

      {/* Per-question accuracy (full list) */}
      {a.questions.length > 0 && (
        <details>
          <summary style={{
            fontSize: 12, fontWeight: 700, color: C.textSec, fontFamily: SANS,
            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', marginBottom: 8,
          }}>
            Per-question accuracy (all {a.questions.length})
          </summary>
          <Table
            headers={['Q#', 'Correct', 'Wrong', 'Skipped', 'Accuracy']}
            rows={a.questions.map(q => [
              `#${q.number}`, `${q.correctCount}`, `${q.wrongCount}`, `${q.skippedCount}`,
              q.accuracy != null ? `${q.accuracy}%` : '—',
            ])}
          />
        </details>
      )}

      {/* Top 5 / bottom performers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <div>
          <Label>Top 5</Label>
          <StudentTable testId={testId} rows={a.top5} />
        </div>
        <div>
          <Label>Bottom performers</Label>
          <StudentTable testId={testId} rows={a.bottomPerformers} />
        </div>
      </div>

      {/* Proctoring violations */}
      {violations.totalCount > 0 && (
        <div>
          <Label>Proctoring violations</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <ShieldAlert size={14} style={{ color: C.warn }} />
            <span style={{ fontSize: 13, color: C.text, fontFamily: SANS }}>
              {violations.totalCount} total
              {Object.entries(violations.byAction).map(([action, count]) => (
                <span key={action} style={{ color: C.textSec }}> · {count} {action}</span>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small building blocks ─────────────────────────────────────────────────────

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: SANS, marginTop: 2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: C.textSec, fontFamily: SANS, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0, fontSize: 12, fontWeight: 700, color: C.textSec, fontFamily: SANS,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {children}
    </p>
  );
}

function DistributionBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 64, fontSize: 11, color: C.textSec, fontFamily: SANS, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: C.surface, borderRadius: 4, height: 14, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: C.red, height: '100%' }} />
      </div>
      <span style={{ width: 24, fontSize: 11, color: C.textSec, fontFamily: SANS, textAlign: 'right', flexShrink: 0 }}>
        {count}
      </span>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: SANS }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {headers.map(h => (
              <th key={h} style={{
                padding: '6px 10px', textAlign: 'left', fontSize: 11,
                fontWeight: 700, color: C.textMuted, textTransform: 'uppercase',
                letterSpacing: '0.05em', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '6px 10px', color: C.text }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentTable({
  testId, rows,
}: {
  testId: number;
  rows: TestAnalyticsData['top5'];
}) {
  if (rows.length === 0) {
    return <p style={{ fontSize: 12, color: C.textMuted, fontFamily: SANS, margin: '8px 0 0' }}>No submitted attempts.</p>;
  }
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: SANS }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Student', 'Score', '%', ''].map(h => (
              <th key={h} style={{
                padding: '6px 10px', textAlign: 'left', fontSize: 11,
                fontWeight: 700, color: C.textMuted, textTransform: 'uppercase',
                letterSpacing: '0.05em', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.attemptId} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '6px 10px', color: C.text }}>{r.name ?? r.email}</td>
              <td style={{ padding: '6px 10px', color: C.text }}>{r.totalScore}</td>
              <td style={{ padding: '6px 10px', color: C.textSec }}>{r.percentage}%</td>
              <td style={{ padding: '6px 10px' }}>
                <a
                  href={`/admin/tests/${testId}/attempts/${r.attemptId}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 600, color: C.textSec, textDecoration: 'none',
                  }}
                >
                  <Eye size={11} /> View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
