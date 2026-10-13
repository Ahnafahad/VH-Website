'use client';

/**
 * TestsAdminPage — the Tests library at /admin/tests.
 * One collapsible row per category (staff-defined, "Unsorted" for tests without
 * one); each expands to dense, hairline-ruled test rows carrying the detail
 * inline. Move tests with "Move to…" or tick several and move them together.
 * Everything per-test (windows, attempts, analytics, settings, answer key) lives
 * on /admin/tests/[id] (TestDetailPage).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FolderPlus,
  Info,
  Pencil,
  RefreshCw,
  ZapOff,
} from 'lucide-react';
import { useAdminProduct } from '@/components/admin/AdminProductContext';
import { BUCKET_LABELS, type TestBucket } from '@/lib/tests/types';
import {
  BORDER,
  BORDER_FIELD,
  FONT_HEADING,
  INK_SOFT,
  MUTED,
  OK,
  R_LG,
  R_SM,
  RED,
  SLATE,
  SURFACE,
  SURFACE_ALT,
  T_BASE,
  T_LG,
  T_SM,
  T_XL,
  T_XS,
  WARN,
} from '../lms/tokens';
import { SPIN_CSS } from '../lms/lms-shared';
import { CATEGORY_MAX_LENGTH, groupByCategory, normalizeCategory, pickWindow, UNSORTED } from '@/lib/tests/library';
import {
  Badge, C, SANS, Spinner, Toast, fmtDate, useToast,
  type AdminTest, type AdminWindow,
} from './TestPanels';
import TestMovePanel from './TestMovePanel';

export const FONT_MONO = "var(--font-math-mono), ui-monospace, 'SFMono-Regular', Menlo, monospace";

const UNSORTED_KEY = '\u0000unsorted';
const keyOf = (category: string | null) => category ?? UNSORTED_KEY;

/** "Oct 14, 14:00–15:30" (end shows its own date when the window crosses midnight). */
function fmtWindow(w: AdminWindow | null): string {
  if (!w) return 'None';
  const d = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const t = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const sameDay = d(w.opensAt) === d(w.closesAt);
  return `${d(w.opensAt)}, ${t(w.opensAt)}–${sameDay ? '' : `${d(w.closesAt)} `}${t(w.closesAt)}`;
}

const WINDOW_STATE_WORD: Record<AdminWindow['state'], string> = { open: 'open', upcoming: 'next', closed: 'ended' };

const TH: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: T_XS, fontWeight: 700, color: MUTED,
  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
  borderBottom: `1px solid ${BORDER}`,
};
const THN: React.CSSProperties = { ...TH, textAlign: 'right' };
const TD: React.CSSProperties = { padding: '10px', verticalAlign: 'top', borderBottom: `1px solid ${BORDER}`, fontSize: T_SM };
const TDN: React.CSSProperties = { ...TD, textAlign: 'right', fontFamily: FONT_MONO, whiteSpace: 'nowrap' };

function KeyState({ keyed, total }: { keyed: number; total: number }) {
  const [label, color] = total === 0
    ? ['No questions', MUTED]
    : keyed >= total ? ['Complete', OK]
    : keyed === 0 ? ['Missing', RED]
    : [`${keyed}/${total} keyed`, WARN];
  return <span style={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>;
}

const dash = (v: number | null | undefined, suffix = '') => (v == null ? '–' : `${v}${suffix}`);

function TestTableRow({
  test, selected, onSelect, moving, onToggleMove,
}: {
  test: AdminTest;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  moving: boolean;
  onToggleMove: () => void;
}) {
  const s = test.stats;
  const offline = pickWindow(test.windows, 'offline');
  const online = pickWindow(test.windows, 'online');
  const live = test.windows.some(w => w.state === 'open');
  const products = test.allowedProducts?.length ? test.allowedProducts.join(', ') : 'all products';
  const link: React.CSSProperties = { color: SLATE, fontWeight: 700, fontFamily: FONT_HEADING, fontSize: T_BASE, textDecoration: 'none' };
  const action: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', padding: '5px 8px', borderRadius: R_SM,
    border: `1px solid ${BORDER}`, background: SURFACE, color: SLATE, fontSize: T_SM, fontWeight: 600,
    fontFamily: SANS, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
  };

  return (
    <tr style={{ background: selected ? SURFACE_ALT : undefined }}>
      <td style={{ ...TD, width: 36 }}>
        <input
          type="checkbox" checked={selected} onChange={e => onSelect(e.target.checked)}
          aria-label={`Select ${test.title}`} style={{ width: 18, height: 18, accentColor: RED, cursor: 'pointer' }}
        />
      </td>
      <td style={{ ...TD, minWidth: 220 }}>
        <Link href={`/admin/tests/${test.id}`} className="lms-testlink" style={link}>{test.title}</Link>
        <div style={{ marginTop: 3, color: MUTED, fontSize: T_XS }}>
          {BUCKET_LABELS[test.bucket]} · {products}
          {test.batches.length > 0 ? ` · batch ${test.batches.join(', ')}` : ''}
          {' · '}{test.totalQuestions} Qs, {test.totalMarks} marks
        </div>
      </td>
      <td style={TD}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <Badge value={test.status} />
          {live && <Badge value="open" />}
        </div>
      </td>
      <td style={{ ...TD, minWidth: 210, fontFamily: FONT_MONO, fontSize: T_XS, lineHeight: 1.6 }}>
        <div><span style={{ color: MUTED }}>Offline </span>{fmtWindow(offline)}{offline ? ` (${WINDOW_STATE_WORD[offline.state]})` : ''}</div>
        <div><span style={{ color: MUTED }}>Online&nbsp; </span>{fmtWindow(online)}{online ? ` (${WINDOW_STATE_WORD[online.state]})` : ''}</div>
      </td>
      <td style={TDN}>
        {test.attemptCounts.submitted}
        {test.attemptCounts.inProgress > 0 && <span style={{ color: MUTED }}> +{test.attemptCounts.inProgress} live</span>}
      </td>
      <td style={TDN}>{dash(s?.averagePct, '%')}</td>
      <td style={TDN}>{dash(s?.medianScore)}</td>
      <td style={TDN}>{dash(s?.topScore)}</td>
      <td style={TDN}>{dash(s?.passRate, '%')}</td>
      <td style={{ ...TD, whiteSpace: 'nowrap', color: INK_SOFT }}>{test.markingRule ?? '–'}</td>
      <td style={{ ...TD, whiteSpace: 'nowrap', fontFamily: FONT_MONO, fontSize: T_XS }}>
        {test.lastAttemptAt ? fmtDate(test.lastAttemptAt) : '–'}
      </td>
      <td style={TD}><KeyState keyed={test.answerKey.keyed} total={test.answerKey.total} /></td>
      <td style={{ ...TD, whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href={`/admin/tests/${test.id}`} className="lms-btn lms-btn-ghost" style={action}>Open page</Link>
          <button type="button" className="lms-btn lms-btn-ghost" aria-expanded={moving} onClick={onToggleMove} style={action}>
            Move to…
          </button>
          <Link href={`/admin/tests/${test.id}?tab=windows`} className="lms-btn lms-btn-ghost" style={action}>Edit windows</Link>
        </div>
      </td>
    </tr>
  );
}

export default function TestsAdminPage({ isAdmin }: { isAdmin: boolean }) {
  const [tests, setTests] = useState<AdminTest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, show: showToast } = useToast();
  // The sidebar IBA/FBS switch decides which bucket of tests is listed.
  const { product } = useAdminProduct();
  const bucket: TestBucket = product === 'iba' ? 'iba' : 'du_fbs';

  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [moveFor, setMoveFor] = useState<number | 'bulk' | null>(null);
  const [moving, setMoving] = useState(false);
  const [extraCats, setExtraCats] = useState<string[]>([]);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tests');
      const d = await res.json() as { tests?: AdminTest[] };
      setTests(d.tests ?? []);
    } catch {
      showToast('error', 'Failed to load tests.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const bucketTests = useMemo(() => (tests ?? []).filter(t => t.bucket === bucket), [tests, bucket]);
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => bucketTests.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (q) return t.title.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q);
    return true;
  }), [bucketTests, filter, q]);

  // Every category name in play for this product (feeds the Move to… chooser).
  const allCategories = useMemo(
    () => groupByCategory(bucketTests, extraCats).filter(g => g.category !== null).map(g => g.category as string),
    [bucketTests, extraCats],
  );
  const filtering = q !== '' || filter !== 'all';
  // While filtering, hide empty groups; otherwise show every category (including new, empty ones).
  const groups = useMemo(
    () => groupByCategory(filtered, filtering ? [] : extraCats).filter(g => !filtering || g.tests.length > 0),
    [filtered, filtering, extraCats],
  );

  const firstOpenKey = groups.find(g => g.tests.length > 0);
  const isOpen = (key: string, count: number) =>
    key in open ? open[key] : filtering ? count > 0 : firstOpenKey !== undefined && keyOf(firstOpenKey.category) === key;
  const setGroupOpen = (key: string, value: boolean) => setOpen(o => ({ ...o, [key]: value }));

  async function moveTests(ids: number[], category: string | null) {
    const cat = normalizeCategory(category);
    setMoving(true);
    const previous = tests;
    setTests(ts => (ts ?? []).map(t => (ids.includes(t.id) ? { ...t, category: cat } : t)));
    try {
      const res = await fetch('/api/admin/tests/category', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, category: cat }),
      });
      if (!res.ok) throw new Error('move failed');
      showToast('success', `Moved ${ids.length} test${ids.length === 1 ? '' : 's'} to ${cat ?? UNSORTED}.`);
      if (cat) { setGroupOpen(keyOf(cat), true); setExtraCats(x => x.filter(c => c !== cat)); }
      setSelected(new Set());
      setMoveFor(null);
    } catch {
      setTests(previous);
      showToast('error', 'Could not move tests. Nothing was changed.');
    } finally {
      setMoving(false);
    }
  }

  async function renameCategory(from: string) {
    const to = normalizeCategory(renameTo);
    setRenaming(null);
    if (to === from) return;
    setMoving(true);
    try {
      const res = await fetch('/api/admin/tests/category', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromCategory: from, toCategory: to }),
      });
      if (!res.ok) throw new Error('rename failed');
      setExtraCats(x => x.filter(c => c !== from));
      showToast('success', to ? `Renamed to ${to}.` : `Moved all tests from ${from} to ${UNSORTED}.`);
      await load();
    } catch {
      showToast('error', 'Could not rename the category.');
    } finally {
      setMoving(false);
    }
  }

  function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = normalizeCategory(newCat);
    if (!name) return;
    if (!allCategories.includes(name)) setExtraCats(x => [...x, name]);
    setGroupOpen(keyOf(name), true);
    setNewCat('');
    setNewCatOpen(false);
    showToast('info', `${name} created. Use Move to… on tests to fill it; empty categories are not kept after a reload.`);
  }

  function toggleSelect(id: number, on: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  const selectedIds = [...selected];
  const field: React.CSSProperties = {
    padding: '7px 12px', borderRadius: R_SM, border: `1px solid ${BORDER_FIELD}`,
    fontSize: T_BASE, fontFamily: SANS, color: C.text, background: SURFACE,
  };
  const smallBtn: React.CSSProperties = {
    padding: '6px 12px', borderRadius: R_SM, fontSize: T_SM, fontWeight: 600,
    fontFamily: SANS, cursor: 'pointer',
  };

  return (
    <div style={{ fontFamily: SANS, color: C.text, maxWidth: 1280, margin: '0 auto', minWidth: 0 }}>
      {toast && <Toast toast={toast} onClose={() => {}} />}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ClipboardList size={20} style={{ color: C.red }} />
            <h1 style={{ margin: 0, fontSize: T_XL, fontWeight: 700, fontFamily: FONT_HEADING, letterSpacing: '-0.025em' }}>
              Tests and marks
            </h1>
            <span style={{ fontSize: T_XS, fontWeight: 700, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: R_SM, padding: '2px 6px' }}>
              {BUCKET_LABELS[bucket]}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: T_BASE, color: C.textSec }}>
            Sorted into categories you choose. Open a test for its windows, attempts, analytics and settings.
          </p>
        </div>
        <button
          type="button" onClick={() => setNewCatOpen(o => !o)} aria-expanded={newCatOpen}
          className="lms-btn lms-btn-ghost"
          style={{ ...smallBtn, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${C.border}`, color: C.text }}
        >
          <FolderPlus size={14} /> New category
        </button>
        <button
          type="button" onClick={load} disabled={loading} aria-label="Refresh" className="lms-iconbtn"
          style={{
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: R_SM,
            padding: 8, cursor: loading ? 'not-allowed' : 'pointer', color: C.textSec,
            display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36,
          }}
        >
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      {newCatOpen && (
        <form onSubmit={addCategory} style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            className="lms-field" autoFocus value={newCat} onChange={e => setNewCat(e.target.value)}
            maxLength={CATEGORY_MAX_LENGTH} placeholder="Category name, e.g. Vocabulary Quizzes"
            aria-label="New category name" style={{ ...field, flex: '1 1 260px', minWidth: 0 }}
          />
          <button
            type="submit" disabled={!normalizeCategory(newCat)} className="lms-btn lms-btn-primary"
            style={{ ...smallBtn, border: 'none', background: C.red, color: SURFACE, opacity: normalizeCategory(newCat) ? 1 : 0.6 }}
          >
            Add category
          </button>
        </form>
      )}

      {/* Search + status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search" className="lms-field" placeholder="Search by title, slug or category…"
          aria-label="Search tests" value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...field, flex: '1 1 240px', minWidth: 0 }}
        />
        {(['all', 'draft', 'published', 'archived'] as const).map(f => (
          <button
            key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className="lms-btn lms-btn-ghost"
            style={{
              ...smallBtn,
              background: filter === f ? C.redLight : 'transparent',
              color: filter === f ? C.red : C.textSec,
              border: `1px solid ${filter === f ? C.red : C.border}`,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'sticky', top: 0, marginBottom: 12, padding: '10px 12px', borderRadius: R_SM,
          background: SLATE, color: SURFACE, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: T_BASE }}>{selectedIds.length} selected</b>
            <span style={{ flex: 1 }} />
            <button
              type="button" aria-expanded={moveFor === 'bulk'} onClick={() => setMoveFor(m => (m === 'bulk' ? null : 'bulk'))}
              className="lms-btn" style={{ ...smallBtn, background: SURFACE, color: SLATE, border: `1px solid ${SURFACE}` }}
            >
              Move to…
            </button>
            <button
              type="button" onClick={() => { setSelected(new Set()); setMoveFor(null); }} className="lms-btn"
              style={{ ...smallBtn, background: 'transparent', color: SURFACE, border: `1px solid ${SURFACE}` }}
            >
              Clear
            </button>
          </div>
          {moveFor === 'bulk' && (
            <TestMovePanel
              categories={allCategories} count={selectedIds.length} busy={moving}
              onMove={c => moveTests(selectedIds, c)} onClose={() => setMoveFor(null)}
            />
          )}
        </div>
      )}

      {loading && !tests && (
        <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.textSec, fontSize: T_BASE }}>
          <Spinner /> Loading tests…
        </div>
      )}

      {!loading && tests && tests.length === 0 && (
        <div style={{ padding: '48px 0', textAlign: 'center', border: `1px dashed ${C.border}`, borderRadius: R_LG, background: SURFACE_ALT }}>
          <ZapOff size={28} style={{ color: C.textMuted, marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: T_BASE, color: C.textSec }}>No tests found.</p>
          <p style={{ margin: '4px 0 0', fontSize: T_SM, color: C.textMuted }}>
            Import a test via <code>scripts/import-test.mjs</code> to get started.
          </p>
        </div>
      )}

      {/* Category accordion */}
      {tests && tests.length > 0 && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: R_LG, background: SURFACE, overflow: 'hidden' }}>
          {groups.map((g, gi) => {
            const key = keyOf(g.category);
            const expanded = isOpen(key, g.tests.length);
            const panelId = `tests-cat-${gi}`;
            const allSelected = g.tests.length > 0 && g.tests.every(t => selected.has(t.id));
            return (
              <section key={key} style={{ borderTop: gi === 0 ? 'none' : `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', background: SURFACE_ALT }}>
                  {renaming === g.category && g.category !== null ? (
                    <form
                      onSubmit={e => { e.preventDefault(); renameCategory(g.category as string); }}
                      style={{ display: 'flex', gap: 6, padding: '6px 12px', flex: 1, flexWrap: 'wrap' }}
                    >
                      <input
                        className="lms-field" autoFocus value={renameTo} onChange={e => setRenameTo(e.target.value)}
                        maxLength={CATEGORY_MAX_LENGTH} aria-label={`Rename ${g.category}`}
                        style={{ ...field, flex: '1 1 200px', minWidth: 0 }}
                      />
                      <button type="submit" className="lms-btn lms-btn-primary" style={{ ...smallBtn, border: 'none', background: C.red, color: SURFACE }}>Save</button>
                      <button type="button" className="lms-btn lms-btn-ghost" onClick={() => setRenaming(null)} style={{ ...smallBtn, background: 'transparent', border: `1px solid ${C.border}`, color: C.text }}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button" aria-expanded={expanded} aria-controls={panelId}
                        onClick={() => setGroupOpen(key, !expanded)}
                        className="lms-tab"
                        style={{
                          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
                          minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: SLATE,
                        }}
                      >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{
                          fontFamily: FONT_HEADING, fontStyle: g.category === null ? 'normal' : 'italic',
                          fontSize: T_LG, fontWeight: 500, color: g.category === null ? INK_SOFT : SLATE,
                        }}>
                          {g.label}
                        </span>
                        <span style={{ fontFamily: FONT_MONO, fontSize: T_XS, color: g.category === null && g.tests.length > 0 ? RED : MUTED }}>
                          {g.tests.length} {g.tests.length === 1 ? 'test' : 'tests'}
                        </span>
                      </button>
                      {g.category !== null && (
                        <button
                          type="button" className="lms-iconbtn" aria-label={`Rename category ${g.category}`}
                          onClick={() => { setRenaming(g.category); setRenameTo(g.category ?? ''); }}
                          style={{ background: 'transparent', border: '1px solid transparent', borderRadius: R_SM, padding: 8, marginRight: 8, cursor: 'pointer', color: INK_SOFT, display: 'flex' }}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {expanded && (
                  <div id={panelId}>
                    {g.tests.length === 0 ? (
                      <p style={{ margin: 0, padding: '14px 16px', fontSize: T_SM, color: MUTED }}>
                        {g.category === null ? 'Every test has a category.' : 'No tests here yet. Use Move to… on a test, or tick several and move them together.'}
                      </p>
                    ) : (
                      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                        <table style={{ width: '100%', minWidth: 1240, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ ...TH, width: 36 }}>
                                <input
                                  type="checkbox" checked={allSelected} aria-label={`Select all in ${g.label}`}
                                  onChange={e => setSelected(prev => {
                                    const next = new Set(prev);
                                    g.tests.forEach(t => (e.target.checked ? next.add(t.id) : next.delete(t.id)));
                                    return next;
                                  })}
                                  style={{ width: 18, height: 18, accentColor: RED, cursor: 'pointer' }}
                                />
                              </th>
                              <th style={TH}>Test</th>
                              <th style={TH}>Status</th>
                              <th style={TH}>Windows</th>
                              <th style={THN}>Attempts</th>
                              <th style={THN}>Avg</th>
                              <th style={THN}>Median</th>
                              <th style={THN}>Top</th>
                              <th style={THN}>Pass</th>
                              <th style={TH}>Marking</th>
                              <th style={TH}>Last attempt</th>
                              <th style={TH}>Answer key</th>
                              <th style={TH}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.tests.flatMap(t => {
                              const rows = [
                                <TestTableRow
                                  key={t.id} test={t} selected={selected.has(t.id)}
                                  onSelect={on => toggleSelect(t.id, on)}
                                  moving={moveFor === t.id}
                                  onToggleMove={() => setMoveFor(m => (m === t.id ? null : t.id))}
                                />,
                              ];
                              if (moveFor === t.id) {
                                rows.push(
                                  <tr key={`${t.id}-move`}>
                                    <td colSpan={13} style={{ padding: 10, borderBottom: `1px solid ${BORDER}` }}>
                                      <div style={{ maxWidth: 560 }}>
                                        <TestMovePanel
                                          categories={allCategories} current={t.category} count={1} busy={moving}
                                          onMove={c => moveTests([t.id], c)} onClose={() => setMoveFor(null)}
                                        />
                                      </div>
                                    </td>
                                  </tr>,
                                );
                              }
                              return rows;
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!loading && tests && tests.length > 0 && filtered.length === 0 && (
        <p style={{ fontSize: T_BASE, color: C.textMuted, textAlign: 'center', padding: '32px 0' }}>
          {bucketTests.length === 0
            ? `No ${BUCKET_LABELS[bucket]} tests yet. Switch IBA/FBS in the sidebar to see the others.`
            : 'No tests match your filter.'}
        </p>
      )}

      {!isAdmin && (
        <div style={{
          marginTop: 24, padding: '10px 14px', borderRadius: R_LG,
          background: C.infoBg, border: `1px solid ${C.infoBdr}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <Info size={14} style={{ color: C.infoText, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: T_SM, color: C.infoText, fontFamily: SANS, lineHeight: 1.5 }}>
            You are viewing as <strong>Instructor</strong>. Answer key editing and deleting tests require Admin access.
          </p>
        </div>
      )}

      <style>{SPIN_CSS}</style>
      <style>{`.lms-testlink:hover{text-decoration:underline !important}.lms-testlink:focus-visible{outline:2px solid ${RED};outline-offset:2px}`}</style>
    </div>
  );
}
