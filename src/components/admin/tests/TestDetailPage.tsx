'use client';

/**
 * TestDetailPage — /admin/tests/[id]. Breadcrumb with category, stat strip,
 * score histogram with the pass line, and the per-test tabs (the panels that used
 * to live inside each expandable card on the old list).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { BUCKET_LABELS } from '@/lib/tests/types';
import {
  BORDER,
  BORDER_FIELD,
  FONT_HEADING,
  INFO,
  INK_SOFT,
  MUTED,
  R_SM,
  RED,
  SLATE,
  SURFACE,
  T_BASE,
  T_SM,
  T_XL,
  T_XS,
  T_2XL,
} from '../lms/tokens';
import { SPIN_CSS } from '../lms/lms-shared';
import { PASS_PERCENT, UNSORTED, type Histogram } from '@/lib/tests/library';
import {
  AnswerKeyEditor, AttemptsTable, Badge, C, SANS, SectionTitle, Spinner, TestSettings, Toast,
  WindowsManager, fmtDate, useToast, type AdminTest,
} from './TestPanels';
import TestAnalytics from './TestAnalytics';
import TestMovePanel from './TestMovePanel';
import { FONT_MONO } from './TestsAdminPage';

export type DetailTab = 'overview' | 'windows' | 'attempts' | 'analytics' | 'settings' | 'answerKey';

const TABS: { key: DetailTab; label: string; adminOnly?: boolean }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'windows',   label: 'Windows' },
  { key: 'attempts',  label: 'Attempts' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings',  label: 'Settings' },
  { key: 'answerKey', label: 'Answer key', adminOnly: true },
];

export function parseTab(raw: string | undefined | null): DetailTab {
  return TABS.some(t => t.key === raw) ? (raw as DetailTab) : 'overview';
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ padding: '12px 16px', borderRight: `1px solid ${BORDER}`, minWidth: 110, flex: '1 1 110px' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: T_2XL, fontWeight: 600, color: SLATE, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: T_XS, color: MUTED, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</div>
    </div>
  );
}

function ScoreHistogram({ h, totalMarks, count }: { h: Histogram; totalMarks: number; count: number }) {
  const passLeft = h.passBin * h.binWidthPct;
  return (
    <div>
      <div style={{ fontSize: T_XS, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        Score distribution (% of {totalMarks} marks)
      </div>
      <div
        role="img"
        aria-label={`Histogram of ${count} scores in ${h.bins.length} bands of ${h.binWidthPct} percent. The pass line is at ${PASS_PERCENT} percent.`}
        style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 3, height: 110, borderBottom: `1px solid ${BORDER_FIELD}`, paddingTop: 6 }}
      >
        {h.bins.map((n, i) => {
          const lo = Math.round(i * h.binWidthPct);
          const hi = Math.round((i + 1) * h.binWidthPct);
          const passed = i >= h.passBin;
          return (
            <div
              key={i}
              title={`${lo}–${hi}%: ${n} attempt${n === 1 ? '' : 's'}`}
              style={{
                flex: 1, minWidth: 6, borderRadius: '2px 2px 0 0',
                height: h.max > 0 ? `${Math.max(n > 0 ? 3 : 0, (n / h.max) * 100)}%` : 0,
                background: passed ? INFO : MUTED,
                opacity: n === 0 ? 0 : 1,
              }}
            />
          );
        })}
        {/* Pass line: a rule plus a label, so it never relies on colour. */}
        <div aria-hidden style={{ position: 'absolute', left: `calc(${passLeft}% - 1px)`, top: 0, bottom: 0, width: 0, borderLeft: `2px dashed ${RED}` }} />
      </div>
      <div style={{ position: 'relative', height: 18, fontFamily: FONT_MONO, fontSize: T_XS, color: MUTED, marginTop: 4 }}>
        <span style={{ position: 'absolute', left: 0 }}>0</span>
        <span style={{ position: 'absolute', left: `${passLeft}%`, transform: 'translateX(-50%)', color: RED, fontWeight: 700 }}>pass {PASS_PERCENT}</span>
        <span style={{ position: 'absolute', right: 0 }}>100</span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: T_XS, color: MUTED }}>
        Bars left of the pass line are grey, the rest blue. Hover a bar for its count.
      </p>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: `1px solid ${BORDER}`, fontSize: T_SM }}>
      <span style={{ width: 112, flexShrink: 0, color: MUTED }}>{label}</span>
      <span style={{ color: SLATE, minWidth: 0 }}>{children}</span>
    </div>
  );
}

export default function TestDetailPage({
  testId, isAdmin, initialTab,
}: {
  testId: number;
  isAdmin: boolean;
  initialTab: DetailTab;
}) {
  const router = useRouter();
  const { toast, show: showToast } = useToast();
  const [data, setData] = useState<{ test: AdminTest; histogram: Histogram } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>(initialTab === 'answerKey' && !isAdmin ? 'overview' : initialTab);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/tests/${testId}`);
      if (!res.ok) {
        setError(res.status === 404 ? 'This test does not exist.' : 'Failed to load the test.');
        return;
      }
      setData(await res.json());
      setError(null);
    } catch {
      setError('Failed to load the test.');
    }
  }, [testId]);

  useEffect(() => { load(); }, [load]);

  async function openMove() {
    const next = !moveOpen;
    setMoveOpen(next);
    if (!next) return;
    try {
      const res = await fetch('/api/admin/tests');
      const d = await res.json() as { tests?: Pick<AdminTest, 'category'>[] };
      setCategories([...new Set((d.tests ?? []).map(t => t.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)));
    } catch {
      showToast('error', 'Could not load the category list.');
    }
  }

  async function move(category: string | null) {
    setMoving(true);
    try {
      const res = await fetch(`/api/admin/tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) throw new Error('move failed');
      showToast('success', `Moved to ${category ?? UNSORTED}.`);
      setMoveOpen(false);
      await load();
    } catch {
      showToast('error', 'Could not move the test.');
    } finally {
      setMoving(false);
    }
  }

  function selectTab(t: DetailTab) {
    setTab(t);
    try {
      window.history.replaceState(null, '', `/admin/tests/${testId}${t === 'overview' ? '' : `?tab=${t}`}`);
    } catch { /* URL sync is a convenience only */ }
  }

  if (error) {
    return (
      <div style={{ fontFamily: SANS, maxWidth: 1100, margin: '0 auto', padding: '32px 0' }}>
        <Link href="/admin/tests" style={{ color: INFO, fontSize: T_BASE }}>Back to tests</Link>
        <p role="alert" style={{ color: C.danger, fontSize: T_BASE }}>{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.textSec, fontSize: T_BASE }}>
        <Spinner /> Loading test…
        <style>{SPIN_CSS}</style>
      </div>
    );
  }

  const { test, histogram } = data;
  const s = test.stats;
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);
  const link: React.CSSProperties = { color: INFO, textDecoration: 'none' };
  const live = test.windows.filter(w => w.state === 'open').length;

  return (
    <div style={{ fontFamily: SANS, color: C.text, maxWidth: 1100, margin: '0 auto', minWidth: 0 }}>
      {toast && <Toast toast={toast} onClose={() => {}} />}

      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: T_SM, color: MUTED, marginBottom: 8 }}>
        <Link href="/admin/tests" style={link}>Tests</Link>
        <ChevronRight size={12} aria-hidden />
        <Link href="/admin/tests" style={link}>{test.category ?? UNSORTED}</Link>
        <ChevronRight size={12} aria-hidden />
        <span aria-current="page" style={{ color: SLATE }}>{test.title}</span>
      </nav>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: T_XL, fontWeight: 700, fontFamily: FONT_HEADING, letterSpacing: '-0.025em' }}>{test.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <Badge value={test.status} />
            {live > 0 && <Badge value="open" />}
            <span style={{ fontSize: T_SM, color: MUTED }}>
              {BUCKET_LABELS[test.bucket]}
              {' · '}{test.allowedProducts?.length ? test.allowedProducts.join(', ') : 'all products'}
              {test.batches.length > 0 ? ` · batch ${test.batches.join(', ')}` : ''}
              {' · '}{test.totalQuestions} questions
            </span>
          </div>
        </div>
        <button
          type="button" aria-expanded={moveOpen} onClick={openMove} className="lms-btn lms-btn-ghost"
          style={{ padding: '8px 14px', borderRadius: R_SM, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: T_BASE, fontWeight: 600, cursor: 'pointer' }}
        >
          Move to…
        </button>
      </div>

      {moveOpen && (
        <div style={{ marginTop: 12, maxWidth: 560 }}>
          <TestMovePanel categories={categories} current={test.category} count={1} busy={moving} onMove={move} onClose={() => setMoveOpen(false)} />
        </div>
      )}

      {/* Stat strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 16, border: `1px solid ${BORDER}`, borderRadius: R_SM, background: SURFACE, overflow: 'hidden' }}>
        <Stat value={String(test.attemptCounts.submitted)} label="Attempts" />
        <Stat value={s ? `${s.averagePct}%` : '–'} label="Average" />
        <Stat value={s ? String(s.medianScore) : '–'} label="Median score" />
        <Stat value={s ? String(s.topScore) : '–'} label="Top score" />
        <Stat value={s ? `${s.passRate}%` : '–'} label={`Passed (${PASS_PERCENT}%+)`} />
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Test sections" style={{ display: 'flex', marginTop: 16, borderBottom: `1px solid ${BORDER}`, overflowX: 'auto' }}>
        {visibleTabs.map(t => (
          <button
            key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`panel-${t.key}`}
            onClick={() => selectTab(t.key)} className="lms-tab"
            style={{
              padding: '10px 14px', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: T_BASE, fontFamily: SANS, fontWeight: tab === t.key ? 600 : 400, whiteSpace: 'nowrap',
              color: tab === t.key ? C.red : C.textSec,
              borderBottom: tab === t.key ? `2px solid ${C.red}` : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} style={{ padding: '18px 0 28px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
              {s ? (
                <ScoreHistogram h={histogram} totalMarks={test.totalMarks} count={s.count} />
              ) : (
                <p style={{ margin: 0, padding: '24px 0', fontSize: T_BASE, color: MUTED }}>No submitted attempts yet, so there is no score distribution.</p>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <SectionTitle>At a glance</SectionTitle>
              <Fact label="Marking">{test.markingRule ?? '–'}</Fact>
              <Fact label="Windows">{test.windows.length}{live > 0 ? `, ${live} open now` : ''}</Fact>
              <Fact label="In progress">{test.attemptCounts.inProgress}</Fact>
              <Fact label="Banned">{test.attemptCounts.banned}</Fact>
              <Fact label="Last attempt">{test.lastAttemptAt ? fmtDate(test.lastAttemptAt) : '–'}</Fact>
              <Fact label="Answer key">
                {test.answerKey.total === 0 ? 'No questions'
                  : test.answerKey.keyed >= test.answerKey.total ? 'Complete'
                  : `${test.answerKey.keyed} of ${test.answerKey.total} keyed`}
              </Fact>
              <Fact label="Results">{test.resultsPublishedAt ? `Force-published ${fmtDate(test.resultsPublishedAt)}` : 'Auto-release when windows close'}</Fact>
              <button
                type="button" onClick={() => selectTab('analytics')} className="lms-btn lms-btn-ghost"
                style={{ marginTop: 10, padding: '6px 12px', borderRadius: R_SM, border: `1px solid ${C.border}`, background: SURFACE, color: INK_SOFT, fontSize: T_SM, fontWeight: 600, cursor: 'pointer' }}
              >
                Per-question analytics
              </button>
            </div>
          </div>
        )}
        {tab === 'windows' && <WindowsManager test={test} onRefresh={load} showToast={showToast} />}
        {tab === 'attempts' && <AttemptsTable testId={test.id} showToast={showToast} />}
        {tab === 'analytics' && <TestAnalytics testId={test.id} />}
        {tab === 'settings' && (
          <TestSettings
            test={test} isAdmin={isAdmin} onRefresh={load}
            onDeleted={() => router.push('/admin/tests')} showToast={showToast}
          />
        )}
        {tab === 'answerKey' && isAdmin && <AnswerKeyEditor testId={test.id} showToast={showToast} />}
      </div>

      <style>{SPIN_CSS}</style>
    </div>
  );
}
