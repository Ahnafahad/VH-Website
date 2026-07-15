'use client';

/**
 * /admin/errors — LexiCore Error Logs
 *
 * Shows merged server-side failures (quiz generation, API 500s) and
 * client-side errors (from analytics events). Newest first. Admin only.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  TriangleAlert,
  Loader2,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Source = 'all' | 'quiz_generation' | 'api' | 'client';

interface ErrorLogRow {
  id:        string;
  createdAt: string;
  source:    'quiz_generation' | 'api' | 'client';
  severity:  'error' | 'warning';
  context:   string;
  message:   string;
  detail:    string | null;
  userEmail: string | null;
}

interface ApiResponse {
  rows:       ErrorLogRow[];
  counts:     { quiz_generation: number; api: number; client: number };
  nextBefore: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function prettyJson(raw: string | null): string {
  if (!raw) return '';
  try   { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

function sourceBadgeStyle(source: ErrorLogRow['source']): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    quiz_generation: { background: 'rgba(155,89,182,0.12)', color: '#8E44AD', border: '1px solid rgba(155,89,182,0.30)' },
    api:             { background: 'rgba(41,128,185,0.10)', color: '#2980B9', border: '1px solid rgba(41,128,185,0.28)' },
    client:          { background: 'rgba(243,156,18,0.10)', color: '#D68910', border: '1px solid rgba(243,156,18,0.30)' },
  };
  return map[source] ?? {};
}

function sourceLabel(source: ErrorLogRow['source']): string {
  const map: Record<string, string> = {
    quiz_generation: 'Quiz generation',
    api:             'API',
    client:          'Client',
  };
  return map[source] ?? source;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ErrorLogsClient() {
  const { data: session, status } = useSession();
  const router                    = useRouter();

  const [rows,       setRows]      = useState<ErrorLogRow[]>([]);
  const [counts,     setCounts]    = useState<ApiResponse['counts']>({ quiz_generation: 0, api: 0, client: 0 });
  const [source,     setSource]    = useState<Source>('all');
  const [loading,    setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [expanded,   setExpanded]  = useState<Set<string>>(new Set());
  const [clearing,   setClearing]  = useState(false);
  const [toast,      setToast]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated' && !session.user?.isAdmin) router.push('/');
  }, [status, session, router]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchRows = useCallback(async (src: Source, before?: string | null) => {
    const isPaginating = !!before;
    if (isPaginating) setLoadingMore(true);
    else              setLoading(true);

    try {
      const params = new URLSearchParams({ source: src, limit: '100' });
      if (before) params.set('before', before);
      const res  = await fetch(`/api/admin/errors?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as ApiResponse;

      if (isPaginating) {
        setRows(prev => [...prev, ...data.rows]);
      } else {
        setRows(data.rows);
        setCounts(data.counts);
      }
      setNextBefore(data.nextBefore);
    } catch {
      showToast('error', 'Failed to load error logs.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session.user?.isAdmin) {
      fetchRows(source);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  function handleSourceChange(s: Source) {
    setSource(s);
    setExpanded(new Set());
    setNextBefore(null);
    void fetchRows(s);
  }

  function handleRefresh() {
    setExpanded(new Set());
    setNextBefore(null);
    void fetchRows(source);
  }

  function handleLoadMore() {
    if (nextBefore) void fetchRows(source, nextBefore);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  async function handleClear() {
    if (!window.confirm('Clear all server-side error logs? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/admin/errors', { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      showToast('success', 'Error logs cleared.');
      void fetchRows(source);
    } catch {
      showToast('error', 'Failed to clear logs.');
    } finally {
      setClearing(false);
    }
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Render guards ──────────────────────────────────────────────────────────
  if (
    status === 'loading' ||
    status === 'unauthenticated' ||
    (status === 'authenticated' && !session?.user?.isAdmin)
  ) {
    return (
      <div style={S.center}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#D62B38' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const totalCount = counts.quiz_generation + counts.api + counts.client;

  const filterChips: { value: Source; label: string; count: number }[] = [
    { value: 'all',             label: 'All',             count: totalCount },
    { value: 'quiz_generation', label: 'Quiz generation', count: counts.quiz_generation },
    { value: 'api',             label: 'API',             count: counts.api },
    { value: 'client',          label: 'Client',          count: counts.client },
  ];

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, ...(toast.type === 'success' ? S.toastSuccess : S.toastError) }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TriangleAlert size={20} color="#D62B38" aria-hidden />
          <div>
            <h1 style={S.title}>Error Logs</h1>
            <p style={S.subtitle}>LexiCore failures — server and client</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleRefresh}
            style={S.iconBtn}
            aria-label="Refresh"
            disabled={loading}
          >
            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
          <button
            onClick={handleClear}
            disabled={clearing}
            style={S.clearBtn}
            aria-label="Clear server-side logs"
          >
            {clearing
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Trash2 size={13} />}
            Clear logs
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={S.chips}>
        {filterChips.map(chip => (
          <button
            key={chip.value}
            onClick={() => handleSourceChange(chip.value)}
            style={{
              ...S.chip,
              ...(source === chip.value ? S.chipActive : {}),
            }}
          >
            {chip.label}
            <span style={{
              ...S.chipCount,
              ...(source === chip.value ? S.chipCountActive : {}),
            }}>
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={S.center}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
        </div>
      ) : rows.length === 0 ? (
        <div style={S.emptyState}>
          <TriangleAlert size={32} color="#D1D5DB" aria-hidden />
          <p style={S.emptyTitle}>No failures logged. That&apos;s the goal.</p>
          <p style={S.emptyDesc}>
            Errors will appear here as quiz generation fails, API 500s occur,
            or client errors are reported.
          </p>
        </div>
      ) : (
        <div style={S.list}>
          {rows.map(row => {
            const isOpen = expanded.has(row.id);
            return (
              <div key={row.id} style={S.card}>
                {/* Row header — always visible */}
                <button
                  onClick={() => toggleExpand(row.id)}
                  style={S.rowBtn}
                  aria-expanded={isOpen}
                >
                  {/* Severity dot */}
                  <span
                    style={{
                      ...S.dot,
                      background: row.severity === 'error' ? '#E53E3E' : '#D97706',
                    }}
                    aria-label={row.severity}
                  />

                  {/* Timestamps */}
                  <span style={S.time} title={absoluteTime(row.createdAt)}>
                    {relativeTime(row.createdAt)}
                  </span>

                  {/* Source badge */}
                  <span style={{ ...S.badge, ...sourceBadgeStyle(row.source) }}>
                    {sourceLabel(row.source)}
                  </span>

                  {/* Context */}
                  <span style={S.context}>{row.context}</span>

                  {/* Message (truncated) */}
                  <span style={S.message}>{row.message}</span>

                  {/* User email (if present) */}
                  {row.userEmail && (
                    <span style={S.email}>{row.userEmail}</span>
                  )}

                  {/* Expand chevron */}
                  <span style={{ marginLeft: 'auto', flexShrink: 0, color: '#9CA3AF' }}>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={S.expandedPanel}>
                    <div style={S.expandedRow}>
                      <span style={S.expandedLabel}>Timestamp</span>
                      <span style={S.expandedValue}>{absoluteTime(row.createdAt)}</span>
                    </div>
                    <div style={S.expandedRow}>
                      <span style={S.expandedLabel}>Message</span>
                      <span style={S.expandedValue}>{row.message}</span>
                    </div>
                    {row.userEmail && (
                      <div style={S.expandedRow}>
                        <span style={S.expandedLabel}>User</span>
                        <span style={S.expandedValue}>{row.userEmail}</span>
                      </div>
                    )}
                    {row.detail && (
                      <div style={{ ...S.expandedRow, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                        <span style={S.expandedLabel}>Detail</span>
                        <pre style={S.pre}>{prettyJson(row.detail)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {nextBefore && !loading && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={S.loadMoreBtn}
          >
            {loadingMore
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SANS = "'Inter', 'Sora', system-ui, sans-serif";

const S = {
  page: {
    fontFamily: SANS,
    color:      '#111827',
    maxWidth:   900,
  } as React.CSSProperties,

  center: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      200,
  } as React.CSSProperties,

  toast: {
    position:     'fixed',
    top:          20,
    left:         '50%',
    transform:    'translateX(-50%)',
    zIndex:       9999,
    padding:      '10px 18px',
    borderRadius: 8,
    fontSize:     13,
    fontWeight:   500,
    boxShadow:    '0 4px 16px rgba(0,0,0,0.16)',
    whiteSpace:   'nowrap',
  } as React.CSSProperties,

  toastSuccess: {
    background: 'rgba(46,204,113,0.12)',
    color:      '#1D7A47',
    border:     '1px solid rgba(46,204,113,0.30)',
  } as React.CSSProperties,

  toastError: {
    background: 'rgba(229,57,70,0.10)',
    color:      '#B91C1C',
    border:     '1px solid rgba(229,57,70,0.28)',
  } as React.CSSProperties,

  header: {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   20,
    flexWrap:       'wrap' as const,
    gap:            12,
  } as React.CSSProperties,

  title: {
    margin:     0,
    fontSize:   20,
    fontWeight: 700,
    color:      '#111827',
  } as React.CSSProperties,

  subtitle: {
    margin:     '2px 0 0',
    fontSize:   13,
    color:      '#6B7280',
    fontWeight: 400,
  } as React.CSSProperties,

  iconBtn: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'transparent',
    border:         '1px solid #E5E7EB',
    borderRadius:   6,
    padding:        8,
    cursor:         'pointer',
    color:          '#6B7280',
    minWidth:       36,
    minHeight:      36,
  } as React.CSSProperties,

  clearBtn: {
    display:     'flex',
    alignItems:  'center',
    gap:         6,
    background:  'transparent',
    border:      '1px solid rgba(229,57,70,0.35)',
    borderRadius:6,
    padding:     '7px 12px',
    cursor:      'pointer',
    color:       '#D62B38',
    fontSize:    12,
    fontWeight:  500,
    minHeight:   36,
  } as React.CSSProperties,

  chips: {
    display:    'flex',
    gap:        8,
    flexWrap:   'wrap' as const,
    marginBottom: 16,
  } as React.CSSProperties,

  chip: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '6px 12px',
    borderRadius: 20,
    border:       '1px solid #E5E7EB',
    background:   'transparent',
    cursor:       'pointer',
    fontSize:     12,
    fontWeight:   500,
    color:        '#6B7280',
  } as React.CSSProperties,

  chipActive: {
    background:  'rgba(214,43,56,0.06)',
    border:      '1px solid rgba(214,43,56,0.25)',
    color:       '#D62B38',
  } as React.CSSProperties,

  chipCount: {
    background:   '#F3F4F6',
    borderRadius: 10,
    padding:      '1px 6px',
    fontSize:     11,
    color:        '#6B7280',
    fontWeight:   600,
  } as React.CSSProperties,

  chipCountActive: {
    background: 'rgba(214,43,56,0.12)',
    color:      '#D62B38',
  } as React.CSSProperties,

  emptyState: {
    display:        'flex',
    flexDirection:  'column' as const,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '48px 24px',
    gap:            10,
    textAlign:      'center' as const,
  } as React.CSSProperties,

  emptyTitle: {
    margin:     0,
    fontSize:   15,
    fontWeight: 600,
    color:      '#374151',
  } as React.CSSProperties,

  emptyDesc: {
    margin:     0,
    fontSize:   13,
    color:      '#9CA3AF',
    maxWidth:   340,
    lineHeight: 1.55,
  } as React.CSSProperties,

  list: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           6,
  } as React.CSSProperties,

  card: {
    background:   '#FAFAFA',
    border:       '1px solid #E5E7EB',
    borderRadius: 8,
    overflow:     'hidden',
  } as React.CSSProperties,

  rowBtn: {
    width:       '100%',
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    padding:     '10px 14px',
    background:  'transparent',
    border:      'none',
    cursor:      'pointer',
    textAlign:   'left' as const,
    minHeight:   44,
    flexWrap:    'wrap' as const,
  } as React.CSSProperties,

  dot: {
    width:        8,
    height:       8,
    borderRadius: '50%',
    flexShrink:   0,
  } as React.CSSProperties,

  time: {
    fontSize:   11,
    color:      '#9CA3AF',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as React.CSSProperties,

  badge: {
    padding:      '2px 7px',
    borderRadius: 4,
    fontSize:     10,
    fontWeight:   600,
    flexShrink:   0,
    letterSpacing:'0.02em',
    textTransform:'uppercase' as const,
  } as React.CSSProperties,

  context: {
    fontSize:     12,
    color:        '#6B7280',
    fontFamily:   "'Courier New', monospace",
    whiteSpace:   'nowrap' as const,
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    maxWidth:     180,
    flexShrink:   0,
  } as React.CSSProperties,

  message: {
    fontSize:     13,
    color:        '#374151',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap' as const,
    flex:         1,
    minWidth:     0,
  } as React.CSSProperties,

  email: {
    fontSize:   11,
    color:      '#9CA3AF',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as React.CSSProperties,

  expandedPanel: {
    borderTop:   '1px solid #E5E7EB',
    padding:     '12px 14px',
    background:  '#FFFFFF',
    display:     'flex',
    flexDirection:'column' as const,
    gap:         10,
  } as React.CSSProperties,

  expandedRow: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        12,
  } as React.CSSProperties,

  expandedLabel: {
    fontSize:   11,
    fontWeight: 600,
    color:      '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    minWidth:   70,
    paddingTop: 2,
    flexShrink: 0,
  } as React.CSSProperties,

  expandedValue: {
    fontSize:   13,
    color:      '#374151',
    lineHeight: 1.5,
    wordBreak:  'break-word' as const,
  } as React.CSSProperties,

  pre: {
    margin:       0,
    padding:      '10px 12px',
    background:   '#F9FAFB',
    border:       '1px solid #E5E7EB',
    borderRadius: 6,
    fontSize:     11,
    fontFamily:   "'Courier New', 'Consolas', monospace",
    color:        '#374151',
    overflowX:    'auto' as const,
    whiteSpace:   'pre' as const,
    maxHeight:    320,
    width:        '100%',
  } as React.CSSProperties,

  loadMoreBtn: {
    display:        'inline-flex',
    alignItems:     'center',
    gap:            6,
    padding:        '8px 20px',
    background:     'transparent',
    border:         '1px solid #E5E7EB',
    borderRadius:   6,
    cursor:         'pointer',
    fontSize:       13,
    color:          '#6B7280',
    fontWeight:     500,
  } as React.CSSProperties,
};
