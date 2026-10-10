'use client';

/**
 * MarkingWorkspace — the page-by-page marking screen for one essay series.
 *
 * One page on screen at a time. Next/previous (buttons, swipe-free arrow keys)
 * walk through every page of every script in the current filter: after the
 * last page of one student it moves to the first page of the next.
 *
 * Each page keeps its own markup + undo/redo history and autosaves ~1s after
 * the last change. Marks live in the side panel. A script is locked to the
 * grader while it is open (heartbeat every minute while they're active);
 * someone else's live lock makes the page read-only, and admins can take over.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleAlert, Loader2, Lock, PanelRightClose, PanelRightOpen, SkipForward, X } from 'lucide-react';
import {
  BG, BORDER, BORDER_FIELD, INFO, INK_SOFT, MUTED, OK, R_LG, R_MD, R_PILL, RED, SHADOW_LG, SLATE, SURFACE, SURFACE_ALT, SURFACE_SHELL,
  T_BASE, T_SM, T_XS, WARN, WARN_BG, Z_MODAL_BACKDROP,
} from '@/components/admin/lms/tokens';
import { FieldTextarea, FormActions, GhostBtn, Modal, PrimaryBtn, SPIN_CSS, Toast } from '@/components/admin/lms/lms-shared';
import MarkedScriptViewer from '@/components/essays/MarkedScriptViewer';
import { INK_COLORS, annotationBounds, scaleAnnotation, type EssayAnnotation } from '@/lib/essays/annotations';
import { newId } from '@/lib/essays/image-prep';
import { completeTotal } from '@/lib/essays/stats';
import MarkingCanvas, { TEXT_SCALES, type MarkingCanvasHandle, type ToolSettings } from './MarkingCanvas';
import MarkingSidePanel from './MarkingSidePanel';
import MarkingToolbar, { imageFilterCss, type ImageAdjust } from './MarkingToolbar';
import type { BankComment, MarksDraft, PageItems, ScriptDetail, ScriptListRow, SeriesInfo, SeriesStats } from './marking-types';

type Filter = 'submitted' | 'all' | 'graded' | 'rejected' | 'mine' | 'assigned';
type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';
type LockState = { kind: 'none' } | { kind: 'mine' } | { kind: 'other'; name: string };

const FILTER_LABEL: Record<Filter, string> = {
  submitted: 'Ungraded',
  all: 'All scripts',
  graded: 'Graded',
  rejected: 'Rejected',
  mine: 'Locked by me',
  assigned: 'Assigned to me',
};

const REJECT_REASONS = ['Photo is blurry / unreadable', 'Pages are missing', 'Wrong essay uploaded', 'Pages are in the wrong order', 'Photo is cut off'];
const HEARTBEAT_MS = 60_000;
const IDLE_MS = 10 * 60_000;
const UNDO_LIMIT = 100;

interface EditorState {
  kind: 'comment' | 'text';
  id: string | null;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  text: string;
  color: string;
}

function draftFrom(d: ScriptDetail): MarksDraft {
  return { marks: { ...d.marks }, sectionComments: { ...d.sectionComments }, overallFeedback: d.overallFeedback, privateNote: d.privateNote };
}

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T & { error?: string } }> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export default function MarkingWorkspace({ seriesId }: { seriesId: number }) {
  const router = useRouter();
  const search = useSearchParams();
  const initialScript = Number(search.get('script')) || null;

  // ── Series + queue ──────────────────────────────────────────────────────────
  const [series, setSeries] = useState<SeriesInfo | null>(null);
  const [rows, setRows] = useState<ScriptListRow[]>([]);
  const [stats, setStats] = useState<SeriesStats | null>(null);
  const [viewer, setViewer] = useState<{ id: number; isAdmin: boolean } | null>(null);
  const [filter, setFilter] = useState<Filter>(initialScript ? 'all' : 'submitted');
  const [scriptId, setScriptId] = useState<number | null>(initialScript);
  const [pageIndex, setPageIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Current script ─────────────────────────────────────────────────────────
  const [detail, setDetail] = useState<ScriptDetail | null>(null);
  const detailCache = useRef(new Map<number, ScriptDetail>());
  const [items, setItems] = useState<PageItems>({});
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const history = useRef<Record<number, { past: EssayAnnotation[][]; future: EssayAnnotation[][] }>>({});
  const [historyTick, setHistoryTick] = useState(0);
  const [draft, setDraft] = useState<MarksDraft | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [lock, setLock] = useState<LockState>({ kind: 'none' });
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const pendingSaves = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const lastActivity = useRef(Date.now());
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState(false);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<ToolSettings>({ tool: 'pen', color: INK_COLORS[0], hlColor: '#FDE047', sizeIndex: 1, eraserMode: 'stroke', shape: 'line', stamp: 'tick' });
  const [zoom, setZoom] = useState(1);
  const [adjust, setAdjust] = useState<ImageAdjust>({ brightness: 100, contrast: 100, scan: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [stylusOnly, setStylusOnly] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [bank, setBank] = useState<BankComment[]>([]);
  const [references, setReferences] = useState<{ id: number; label: string | null; total: number | null; name: string; essayIndex: number }[]>([]);
  const [reference, setReference] = useState<ScriptDetail | null>(null);
  const canvasRef = useRef<MarkingCanvasHandle>(null);

  // ── Loading ────────────────────────────────────────────────────────────────
  const loadSeries = useCallback(async () => {
    const r = await api<{ series: SeriesInfo; scripts: ScriptListRow[]; stats: SeriesStats; viewer: { id: number; isAdmin: boolean } }>(`/api/admin/essays/series/${seriesId}/scripts`);
    if (!r.ok) { setLoadError(r.body.error ?? 'Could not load this series'); return null; }
    setSeries(r.body.series);
    setRows(r.body.scripts);
    setStats(r.body.stats);
    setViewer(r.body.viewer);
    return r.body.scripts;
  }, [seriesId]);

  const loadReferences = useCallback(async () => {
    const r = await api<{ references: typeof references }>(`/api/admin/essays/series/${seriesId}/references`);
    if (r.ok) setReferences(r.body.references);
  }, [seriesId]);

  useEffect(() => {
    void loadSeries();
    void loadReferences();
    void api<{ comments: BankComment[] }>('/api/admin/essays/comment-bank').then(r => r.ok && setBank(r.body.comments));
  }, [loadSeries, loadReferences]);

  const matches = useCallback((r: ScriptListRow, f: Filter) => {
    switch (f) {
      case 'all': return true;
      case 'mine': return r.lockedBy?.id === viewer?.id;
      case 'assigned': return r.assignedTo?.id === viewer?.id;
      default: return r.status === f;
    }
  }, [viewer]);

  // The queue keeps the current script visible even after it stops matching (e.g. just graded).
  const queue = useMemo(() => rows.filter(r => matches(r, filter) || r.id === scriptId), [rows, filter, matches, scriptId]);
  const queuePos = queue.findIndex(r => r.id === scriptId);

  // Pick a starting script once the list arrives.
  useEffect(() => {
    if (scriptId !== null || rows.length === 0) return;
    const first = rows.find(r => matches(r, filter)) ?? rows[0];
    setScriptId(first.id);
  }, [rows, scriptId, filter, matches]);

  const fetchDetail = useCallback(async (id: number, force = false) => {
    if (!force && detailCache.current.has(id)) return detailCache.current.get(id)!;
    const r = await api<ScriptDetail>(`/api/admin/essays/scripts/${id}`);
    if (!r.ok) throw new Error(r.body.error ?? 'Could not load script');
    detailCache.current.set(id, r.body);
    return r.body;
  }, []);

  // ── Locking ────────────────────────────────────────────────────────────────
  const acquire = useCallback(async (id: number, force = false): Promise<LockState> => {
    const r = await api<{ lockExpiresAt: string }>(`/api/admin/essays/scripts/${id}/lock${force ? '?force=1' : ''}`, { method: 'POST' });
    if (r.ok) return { kind: 'mine' };
    if (r.status === 409) return { kind: 'other', name: (r.body.error ?? '').replace(/^Being marked by /, '') || 'another grader' };
    return { kind: 'none' };
  }, []);

  const flushSaves = useRef<() => Promise<void>>(async () => {});

  // Open a script: flush the previous one, release its lock, load + lock this one.
  useEffect(() => {
    if (scriptId === null) return;
    let cancelled = false;
    const prevId = scriptId;
    setDetail(null);
    setEditor(null);
    setSelected(new Set());
    setReference(null);
    (async () => {
      try {
        const d = await fetchDetail(scriptId, true);
        if (cancelled) return;
        const lockState = d.status === 'rejected' ? { kind: 'none' as const } : await acquire(scriptId);
        if (cancelled) return;
        setDetail(d);
        setItems(Object.fromEntries(d.pages.map(p => [p.id, p.annotations])));
        setRotations(Object.fromEntries(d.pages.map(p => [p.id, p.rotation])));
        history.current = {};
        setDraft(draftFrom(d));
        setDraftDirty(false);
        setNotify(false);
        setLock(lockState);
        setSaveState('saved');
        setPageIndex(i => Math.min(i, Math.max(0, d.pages.length - 1)));
        // Prefetch the next script's first page so moving on is instant.
        const next = queue[queue.findIndex(r => r.id === scriptId) + 1];
        if (next) void fetchDetail(next.id).then(nd => { if (nd.pages[0]) { const im = new Image(); im.src = nd.pages[0].imageUrl; } }).catch(() => {});
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load script');
      }
    })();
    const url = new URL(window.location.href);
    url.searchParams.set('script', String(scriptId));
    window.history.replaceState(null, '', url.toString());
    return () => {
      cancelled = true;
      void flushSaves.current().finally(() => {
        fetch(`/api/admin/essays/scripts/${prevId}/lock`, { method: 'DELETE', keepalive: true }).catch(() => {});
      });
    };
    // queue is only read for prefetch; re-running on queue changes would reload the script.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId, fetchDetail, acquire]);

  // Heartbeat while active; release on tab close.
  useEffect(() => {
    if (scriptId === null || lock.kind !== 'mine') return;
    const t = setInterval(() => {
      if (Date.now() - lastActivity.current < IDLE_MS) {
        void acquire(scriptId).then(s => { if (s.kind === 'other') setLock(s); });
      }
    }, HEARTBEAT_MS);
    const onHide = () => { fetch(`/api/admin/essays/scripts/${scriptId}/lock`, { method: 'DELETE', keepalive: true }).catch(() => {}); };
    window.addEventListener('pagehide', onHide);
    return () => { clearInterval(t); window.removeEventListener('pagehide', onHide); };
  }, [scriptId, lock.kind, acquire]);

  const readOnly = !detail || detail.status === 'rejected' || lock.kind !== 'mine';

  // ── Pages + markup ─────────────────────────────────────────────────────────
  const page = detail?.pages[pageIndex] ?? null;
  const pageItems = page ? items[page.id] ?? [] : [];

  const savePage = useCallback(async (pageId: number) => {
    const t = pendingSaves.current.get(pageId);
    if (t) clearTimeout(t);
    pendingSaves.current.delete(pageId);
    setSaveState('saving');
    const r = await api<{ savedAt: string }>(`/api/admin/essays/pages/${pageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations: itemsRef.current[pageId] ?? [], rotation: rotationsRef.current[pageId] }),
    });
    if (r.ok) {
      setSaveState(pendingSaves.current.size ? 'unsaved' : 'saved');
      const cached = detailCache.current.get(scriptIdRef.current ?? -1);
      if (cached) cached.pages = cached.pages.map(p => (p.id === pageId ? { ...p, annotations: itemsRef.current[pageId] ?? [], rotation: rotationsRef.current[pageId] ?? p.rotation } : p));
    } else {
      setSaveState('error');
      if (r.status === 409) { setLock({ kind: 'other', name: (r.body.error ?? '').replace(/^Being marked by /, '') }); setToast(r.body.error ?? 'Someone else took over this script'); }
      else setToast(r.body.error ?? 'Could not save the markings');
    }
  }, []);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const rotationsRef = useRef(rotations);
  rotationsRef.current = rotations;
  const scriptIdRef = useRef(scriptId);
  scriptIdRef.current = scriptId;

  flushSaves.current = async () => {
    const ids = [...pendingSaves.current.keys()];
    await Promise.all(ids.map(id => savePage(id)));
  };

  const queueSave = useCallback((pageId: number) => {
    const t = pendingSaves.current.get(pageId);
    if (t) clearTimeout(t);
    pendingSaves.current.set(pageId, setTimeout(() => { void savePage(pageId); }, 1000));
    setSaveState('unsaved');
  }, [savePage]);

  const changeItems = useCallback((next: EssayAnnotation[]) => {
    if (!page || readOnly) return;
    lastActivity.current = Date.now();
    const h = (history.current[page.id] ??= { past: [], future: [] });
    h.past.push(itemsRef.current[page.id] ?? []);
    if (h.past.length > UNDO_LIMIT) h.past.shift();
    h.future = [];
    setItems(prev => ({ ...prev, [page.id]: next }));
    itemsRef.current = { ...itemsRef.current, [page.id]: next };
    setHistoryTick(t => t + 1);
    queueSave(page.id);
  }, [page, readOnly, queueSave]);

  const undo = useCallback(() => {
    if (!page || readOnly) return;
    const h = history.current[page.id];
    if (!h?.past.length) return;
    h.future.push(itemsRef.current[page.id] ?? []);
    const prev = h.past.pop()!;
    setItems(p => ({ ...p, [page.id]: prev }));
    itemsRef.current = { ...itemsRef.current, [page.id]: prev };
    setHistoryTick(t => t + 1);
    queueSave(page.id);
  }, [page, readOnly, queueSave]);

  const redo = useCallback(() => {
    if (!page || readOnly) return;
    const h = history.current[page.id];
    if (!h?.future.length) return;
    h.past.push(itemsRef.current[page.id] ?? []);
    const next = h.future.pop()!;
    setItems(p => ({ ...p, [page.id]: next }));
    itemsRef.current = { ...itemsRef.current, [page.id]: next };
    setHistoryTick(t => t + 1);
    queueSave(page.id);
  }, [page, readOnly, queueSave]);

  void historyTick; // re-render trigger for undo/redo availability
  const canUndo = !!page && !!history.current[page.id]?.past.length;
  const canRedo = !!page && !!history.current[page.id]?.future.length;

  const rotatePage = () => {
    if (!page || readOnly || pageItems.length) return;
    const next = ((rotations[page.id] ?? 0) + 90) % 360;
    setRotations(r => ({ ...r, [page.id]: next }));
    rotationsRef.current = { ...rotationsRef.current, [page.id]: next };
    queueSave(page.id);
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goScript = useCallback((id: number | null, atEnd = false) => {
    if (id === null || id === scriptId) return;
    setPageIndex(atEnd ? Number.MAX_SAFE_INTEGER : 0);
    setZoom(1);
    setScriptId(id);
  }, [scriptId]);

  const nextPage = useCallback(() => {
    if (!detail) return;
    if (pageIndex < detail.pages.length - 1) { setPageIndex(i => i + 1); setSelected(new Set()); return; }
    const next = queue[queuePos + 1];
    if (next) goScript(next.id);
    else setToast('That was the last script in this list');
  }, [detail, pageIndex, queue, queuePos, goScript]);

  const prevPage = useCallback(() => {
    if (pageIndex > 0) { setPageIndex(i => i - 1); setSelected(new Set()); return; }
    const prev = queue[queuePos - 1];
    if (prev) goScript(prev.id, true);
  }, [pageIndex, queue, queuePos, goScript]);

  // Clamp after jumping to "the last page" of the previous script.
  useEffect(() => {
    if (detail && pageIndex > detail.pages.length - 1) setPageIndex(detail.pages.length - 1);
  }, [detail, pageIndex]);

  const nextUngraded = useCallback((after: number | null) => {
    const start = rows.findIndex(r => r.id === after);
    const ordered = [...rows.slice(start + 1), ...rows.slice(0, Math.max(0, start))];
    return ordered.find(r => r.status === 'submitted' && r.id !== after && !(r.lockedBy && r.lockedBy.id !== viewer?.id)) ?? null;
  }, [rows, viewer]);

  // ── Marks ──────────────────────────────────────────────────────────────────
  const updateDraft = (d: MarksDraft) => { lastActivity.current = Date.now(); setDraft(d); setDraftDirty(true); };

  const saveMarks = async (action: 'save' | 'grade') => {
    if (!detail || !draft) return;
    setSaving(true);
    await flushSaves.current();
    const r = await api<{ status: string; total: number | null; published: boolean }>(`/api/admin/essays/scripts/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, action, notify }),
    });
    setSaving(false);
    if (!r.ok) {
      if (r.status === 409 && r.body.error?.startsWith('Being marked')) setLock({ kind: 'other', name: r.body.error.replace(/^Being marked by /, '') });
      setToast(r.body.error ?? 'Could not save');
      return;
    }
    setDraftDirty(false);
    const fresh = await loadSeries();
    if (r.body.published) setToast('All scripts checked — results published to students');
    else setToast(action === 'grade' ? `Graded · ${r.body.total} / ${series?.totalMarks}` : 'Saved');
    if (action === 'grade' && fresh) {
      const after = fresh.findIndex(x => x.id === detail.id);
      const ordered = [...fresh.slice(after + 1), ...fresh.slice(0, Math.max(0, after))];
      const nxt = ordered.find(x => x.status === 'submitted' && !(x.lockedBy && x.lockedBy.id !== viewer?.id));
      if (nxt) goScript(nxt.id);
      else {
        const d = await fetchDetail(detail.id, true);
        setDetail(d);
        setDraft(draftFrom(d));
      }
    } else {
      const d = await fetchDetail(detail.id, true);
      setDetail(d);
    }
  };

  // Autosave the draft of an ungraded script a couple of seconds after typing stops.
  useEffect(() => {
    if (!draftDirty || !detail || detail.status !== 'submitted' || readOnly) return;
    const t = setTimeout(() => {
      void api(`/api/admin/essays/scripts/${detail.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, action: 'save' }),
      }).then(r => { if (r.ok) setDraftDirty(false); });
    }, 2500);
    return () => clearTimeout(t);
  }, [draft, draftDirty, detail, readOnly]);

  const reject = async () => {
    if (!detail || !rejectReason.trim()) return;
    setSaving(true);
    const r = await api<{ published: boolean }>(`/api/admin/essays/scripts/${detail.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectReason }),
    });
    setSaving(false);
    if (!r.ok) { setToast(r.body.error ?? 'Could not reject'); return; }
    setRejectOpen(false);
    setRejectReason('');
    setToast(r.body.published ? 'Rejected — and all scripts are now checked, results published' : 'Rejected — the student has been asked to resubmit');
    await loadSeries();
    const nxt = nextUngraded(detail.id);
    if (nxt) goScript(nxt.id);
    else { const d = await fetchDetail(detail.id, true); setDetail(d); setLock({ kind: 'none' }); }
  };

  const toggleReference = async () => {
    if (!detail) return;
    let label: string | null = null;
    if (!detail.isReference) {
      label = window.prompt('Label for this reference script (e.g. "Strong 16/20"):', `${detail.total}/${series?.totalMarks}`);
      if (label === null) return;
    }
    const r = await api(`/api/admin/essays/scripts/${detail.id}/reference`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isReference: !detail.isReference, label }),
    });
    if (!r.ok) { setToast(r.body.error ?? 'Could not update'); return; }
    setDetail(await fetchDetail(detail.id, true));
    void loadReferences();
  };

  const openReference = async (id: number) => {
    try { setReference(await fetchDetail(id, true)); } catch { setToast('Could not open reference'); }
  };

  // ── Comment / text editors ─────────────────────────────────────────────────
  const openEditor = (req: { kind: 'comment' | 'text'; id: string | null; x: number; y: number; clientX: number; clientY: number }) => {
    const existing = req.id ? pageItems.find(a => a.id === req.id) : undefined;
    setEditor({
      ...req,
      text: existing && (existing.t === 'comment' || existing.t === 'text') ? existing.text : '',
      color: existing ? existing.color : settings.color,
    });
  };

  const commitEditor = () => {
    if (!editor || !page) return;
    const text = editor.text.trim();
    if (readOnly) { setEditor(null); return; }
    if (!text) {
      if (editor.id) changeItems(pageItems.filter(a => a.id !== editor.id));
      setEditor(null);
      return;
    }
    if (editor.id) {
      changeItems(pageItems.map(a => (a.id === editor.id && (a.t === 'comment' || a.t === 'text') ? { ...a, text, color: editor.color } : a)));
    } else if (editor.kind === 'comment') {
      changeItems([...pageItems, { id: newId(), t: 'comment', color: editor.color, x: editor.x, y: editor.y, text }]);
    } else {
      changeItems([...pageItems, { id: newId(), t: 'text', color: editor.color, x: editor.x, y: editor.y, text, scale: TEXT_SCALES[settings.sizeIndex] }]);
    }
    setEditor(null);
  };

  const saveToBank = async (shared: boolean) => {
    if (!editor?.text.trim()) return;
    const r = await api<{ comment: BankComment }>('/api/admin/essays/comment-bank', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: editor.text.trim(), shared }),
    });
    if (r.ok) { setBank(b => [...b, r.body.comment]); setToast(shared ? 'Added to the shared comment bank' : 'Saved to your comment bank'); }
    else setToast(r.body.error ?? 'Could not save');
  };

  const removeFromBank = async (id: number) => {
    const r = await api(`/api/admin/essays/comment-bank/${id}`, { method: 'DELETE' });
    if (r.ok) setBank(b => b.filter(x => x.id !== id));
    else setToast(r.body.error ?? 'Could not remove');
  };

  // ── Selection actions ──────────────────────────────────────────────────────
  const deleteSelection = () => { changeItems(pageItems.filter(a => !selected.has(a.id))); setSelected(new Set()); };
  const scaleSelection = (f: number) => {
    const sel = pageItems.filter(a => selected.has(a.id));
    if (!sel.length) return;
    const b = sel.map(annotationBounds).reduce((acc, x) => ({ x1: Math.min(acc.x1, x.x1), y1: Math.min(acc.y1, x.y1), x2: Math.max(acc.x2, x.x2), y2: Math.max(acc.y2, x.y2) }));
    const cx = (b.x1 + b.x2) / 2; const cy = (b.y1 + b.y2) / 2;
    changeItems(pageItems.map(a => (selected.has(a.id) ? scaleAnnotation(a, f, cx, cy) : a)));
  };
  const recolorSelection = (c: string) => changeItems(pageItems.map(a => (selected.has(a.id) ? { ...a, color: c } : a)));

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod) return;
      const toolKeys: Record<string, ToolSettings['tool']> = { p: 'pen', h: 'hl', e: 'eraser', s: 'shape', k: 'stamp', t: 'text', c: 'comment', l: 'lasso', v: 'hand' };
      const k = e.key.toLowerCase();
      if (k === 'arrowright') { e.preventDefault(); nextPage(); }
      else if (k === 'arrowleft') { e.preventDefault(); prevPage(); }
      else if (k === ']') { const n = queue[queuePos + 1]; if (n) goScript(n.id); }
      else if (k === '[') { const p = queue[queuePos - 1]; if (p) goScript(p.id); }
      else if (k === 'n') { const n = nextUngraded(scriptId); if (n) goScript(n.id); }
      else if (k === 'f') setFocus(f => !f);
      else if (k === '1' || k === '2' || k === '3') setSettings(s => ({ ...s, sizeIndex: (Number(k) - 1) as 0 | 1 | 2 }));
      else if (k === '+' || k === '=') canvasRef.current?.zoomBy(1.25);
      else if (k === '-') canvasRef.current?.zoomBy(0.8);
      else if (k === '0') setZoom(1);
      else if ((k === 'delete' || k === 'backspace') && selected.size) { e.preventDefault(); deleteSelection(); }
      else if (k === 'escape') { setSelected(new Set()); setEditor(null); if (focus) setFocus(false); }
      else if (toolKeys[k]) setSettings(s => ({ ...s, tool: toolKeys[k] }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (pendingSaves.current.size || draftDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [draftDirty]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: RED, fontSize: T_BASE }}>{loadError}</p>
        <Link href={`/admin/essays/${seriesId}`} style={{ color: INFO, fontSize: T_SM }}>Back to the series</Link>
      </div>
    );
  }

  const done = rows.filter(r => r.status !== 'submitted').length;
  const progressPct = rows.length ? (done / rows.length) * 100 : 0;
  const draftTotal = draft && series ? completeTotal(draft.marks, series.sections) : null;
  const currentRow = rows.find(r => r.id === scriptId);

  const saveLabel = { saved: 'All changes saved', saving: 'Saving…', unsaved: 'Unsaved changes…', error: 'Save failed' }[saveState];
  const saveColor = { saved: OK, saving: MUTED, unsaved: WARN, error: RED }[saveState];

  const navBtn = { height: 36, minWidth: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 10px', borderRadius: R_MD, border: `1px solid ${BORDER}`, background: SURFACE, color: INK_SOFT, cursor: 'pointer', fontSize: T_SM, fontWeight: 600 } as const;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z_MODAL_BACKDROP - 100, background: BG, display: 'flex', flexDirection: 'column' }}>
      <style>{SPIN_CSS}</style>

      {/* ── Header ── */}
      {!focus && (
        <div style={{ flexShrink: 0, background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { void flushSaves.current().then(() => router.push(`/admin/essays/${seriesId}`)); }} style={navBtn} aria-label="Back to series">
              <ArrowLeft size={16} aria-hidden />
            </button>
            <div style={{ minWidth: 0, flex: '1 1 220px' }}>
              <div style={{ fontSize: T_XS, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{series?.title ?? 'Loading…'}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: SLATE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {detail?.student?.name ?? currentRow?.studentName ?? '—'}
                {series && series.essayCount > 1 && detail ? <span style={{ fontWeight: 500, color: MUTED }}> · Essay {detail.essayIndex}</span> : null}
              </div>
            </div>
            <span style={{ fontSize: T_SM, color: SLATE, whiteSpace: 'nowrap' }}>
              Page <strong>{detail ? pageIndex + 1 : '–'}</strong> of {detail?.pages.length ?? '–'} · Script <strong>{queuePos + 1}</strong> of {queue.length}
            </span>
            <span style={{ fontSize: T_XS, fontWeight: 700, color: saveColor, whiteSpace: 'nowrap' }}>{readOnly ? '' : saveLabel}</span>
            <select aria-label="Filter scripts" value={filter} onChange={e => setFilter(e.target.value as Filter)} style={{ height: 36, border: `1px solid ${BORDER_FIELD}`, borderRadius: R_MD, padding: '0 8px', fontSize: T_SM, color: SLATE, background: SURFACE }}>
              {(Object.keys(FILTER_LABEL) as Filter[]).map(f => <option key={f} value={f}>{FILTER_LABEL[f]} ({rows.filter(r => matches(r, f)).length})</option>)}
            </select>
            <select aria-label="Jump to student" value={scriptId ?? ''} onChange={e => goScript(Number(e.target.value))} style={{ height: 36, maxWidth: 200, border: `1px solid ${BORDER_FIELD}`, borderRadius: R_MD, padding: '0 8px', fontSize: T_SM, color: SLATE, background: SURFACE }}>
              {rows.map(r => (
                <option key={r.id} value={r.id}>
                  {r.status === 'graded' ? '✓ ' : r.status === 'rejected' ? '✗ ' : ''}{r.studentName}{series && series.essayCount > 1 ? ` (E${r.essayIndex})` : ''}
                </option>
              ))}
            </select>
            <button type="button" style={navBtn} onClick={() => { const n = nextUngraded(scriptId); if (n) goScript(n.id); else setToast('No other ungraded scripts'); }} title="Next ungraded (N)">
              <SkipForward size={14} aria-hidden /> Next ungraded
            </button>
            <button type="button" style={navBtn} onClick={() => setPanelOpen(o => !o)} aria-label={panelOpen ? 'Hide panel' : 'Show panel'}>
              {panelOpen ? <PanelRightClose size={16} aria-hidden /> : <PanelRightOpen size={16} aria-hidden />}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 8px' }}>
            <div style={{ flex: 1, height: 5, borderRadius: R_PILL, background: SURFACE_ALT, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: OK }} />
            </div>
            <span style={{ fontSize: T_XS, color: MUTED, whiteSpace: 'nowrap' }}>{done} / {rows.length} checked</span>
          </div>
        </div>
      )}

      {!focus && (
        <MarkingToolbar
          settings={settings}
          onSettings={s => setSettings(prev => ({ ...prev, ...s }))}
          canUndo={canUndo && !readOnly} canRedo={canRedo && !readOnly} onUndo={undo} onRedo={redo}
          zoom={zoom} onZoomIn={() => canvasRef.current?.zoomBy(1.25)} onZoomOut={() => canvasRef.current?.zoomBy(0.8)} onFit={() => setZoom(1)}
          onRotate={rotatePage} canRotate={!readOnly && !!page && pageItems.length === 0}
          adjust={adjust} onAdjust={setAdjust}
          onClearPage={() => { if (window.confirm('Clear every mark on this page?')) changeItems([]); }} canClear={!readOnly && pageItems.length > 0}
          focus={focus} onFocus={() => setFocus(f => !f)}
          stylusOnly={stylusOnly} onStylusOnly={() => setStylusOnly(s => !s)}
          readOnly={readOnly}
          hasSelection={selected.size > 0} onDeleteSelection={deleteSelection} onScaleSelection={scaleSelection} onRecolorSelection={recolorSelection}
        />
      )}

      {/* ── Lock / status banners ── */}
      {!focus && detail && lock.kind === 'other' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: WARN_BG, color: WARN, fontSize: T_SM, flexShrink: 0 }}>
          <Lock size={14} aria-hidden /> Being marked by {lock.name} — view only.
          {viewer?.isAdmin && (
            <button type="button" style={{ ...navBtn, height: 28 }} onClick={async () => { const s = await acquire(detail.id, true); setLock(s); if (s.kind === 'mine') setToast('You now hold this script'); }}>
              Take over
            </button>
          )}
          <button type="button" style={{ ...navBtn, height: 28 }} onClick={async () => setLock(await acquire(detail.id))}>Try again</button>
        </div>
      )}
      {!focus && detail && detail.status !== 'rejected' && lock.kind === 'none' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: WARN_BG, color: WARN, fontSize: T_SM, flexShrink: 0 }}>
          <CircleAlert size={14} aria-hidden /> Couldn&apos;t lock this script for marking.
          <button type="button" style={{ ...navBtn, height: 28 }} onClick={async () => setLock(await acquire(detail.id))}>Retry</button>
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, background: SURFACE_ALT }}
            onPointerDown={() => { lastActivity.current = Date.now(); }}>
            {page ? (
              <MarkingCanvas
                ref={canvasRef}
                page={{ id: page.id, imageUrl: page.imageUrl, width: page.width, height: page.height, rotation: rotations[page.id] ?? page.rotation }}
                items={pageItems}
                settings={settings}
                readOnly={readOnly}
                zoom={zoom}
                onZoomChange={setZoom}
                imageFilter={imageFilterCss(adjust)}
                selectedIds={selected}
                onSelect={setSelected}
                onChange={changeItems}
                onEditRequest={openEditor}
                onStylusSeen={() => setStylusOnly(true)}
                stylusOnly={stylusOnly}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: T_SM, gap: 8 }}>
                {rows.length === 0 && series ? 'No scripts submitted yet.' : <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Loading…</>}
              </div>
            )}

            {/* Page navigation — always on screen, also in focus mode */}
            <button type="button" onClick={prevPage} aria-label="Previous page" style={{ ...navBtn, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', height: 56, width: 40, boxShadow: SHADOW_LG, opacity: 0.92 }}>
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button type="button" onClick={nextPage} aria-label="Next page" style={{ ...navBtn, position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', height: 56, width: 40, boxShadow: SHADOW_LG, opacity: 0.92 }}>
              <ChevronRight size={22} aria-hidden />
            </button>

            {focus && (
              <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_PILL, boxShadow: SHADOW_LG, fontSize: T_SM, color: SLATE }}>
                <strong>{detail?.student?.name}</strong>
                <span style={{ color: MUTED }}>p{pageIndex + 1}/{detail?.pages.length}</span>
                {(['pen', 'hl', 'eraser', 'comment', 'hand'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setSettings(s => ({ ...s, tool: t }))} style={{ border: 'none', borderRadius: R_PILL, padding: '4px 8px', background: settings.tool === t ? `${RED}14` : 'transparent', color: settings.tool === t ? RED : INK_SOFT, fontSize: T_XS, fontWeight: 700, cursor: 'pointer' }}>
                    {{ pen: 'Pen', hl: 'Highlight', eraser: 'Erase', comment: 'Comment', hand: 'Move' }[t]}
                  </button>
                ))}
                <button type="button" onClick={undo} disabled={!canUndo} style={{ border: 'none', background: 'transparent', color: INK_SOFT, fontSize: T_XS, fontWeight: 700, cursor: 'pointer' }}>Undo</button>
                <span style={{ fontWeight: 800, color: RED }}>{draftTotal ?? '—'}/{series?.totalMarks}</span>
                <button type="button" onClick={() => setFocus(false)} aria-label="Exit focus mode" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={16} aria-hidden /></button>
              </div>
            )}

            {editor && (
              <EditorPopover
                editor={editor}
                readOnly={readOnly}
                bank={bank}
                isAdmin={!!viewer?.isAdmin}
                onChange={setEditor}
                onCommit={commitEditor}
                onCancel={() => setEditor(null)}
                onDelete={() => { if (editor.id) changeItems(pageItems.filter(a => a.id !== editor.id)); setEditor(null); }}
                onSaveToBank={saveToBank}
                onRemoveFromBank={removeFromBank}
              />
            )}
          </div>

          {/* Thumbnails for the current script */}
          {!focus && detail && (
            <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: 8, overflowX: 'auto', background: SURFACE_SHELL, borderTop: `1px solid ${BORDER}` }}>
              {detail.pages.map((p, i) => {
                const marked = (items[p.id] ?? []).length > 0;
                const rot = rotations[p.id] ?? p.rotation;
                return (
                  <button key={p.id} type="button" onClick={() => { setPageIndex(i); setSelected(new Set()); }} aria-label={`Page ${i + 1}`}
                    style={{ position: 'relative', flexShrink: 0, width: 48, height: 64, padding: 0, borderRadius: R_MD, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${i === pageIndex ? RED : BORDER}`, background: SURFACE }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `rotate(${rot}deg)` }} />
                    <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 10, background: `${SLATE}AA`, color: SURFACE, textAlign: 'center' }}>{i + 1}</span>
                    {marked && <span style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: R_PILL, background: RED, border: `1px solid ${SURFACE}` }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Reference script, side by side */}
        {!focus && reference && (
          <div style={{ width: 'min(42vw, 560px)', flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: SURFACE, overflowY: 'auto', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: T_XS, color: MUTED }}>Reference · {reference.referenceLabel ?? ''}</div>
                <div style={{ fontSize: T_BASE, fontWeight: 700, color: SLATE }}>{reference.student?.name} · {reference.total}/{series?.totalMarks}</div>
              </div>
              <button type="button" style={navBtn} onClick={() => setReference(null)} aria-label="Close reference"><X size={14} aria-hidden /></button>
            </div>
            <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
              {series?.sections.map(sec => (
                <div key={sec.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: T_XS, color: SLATE }}>
                  <span>{sec.name}</span><span>{reference.marks[sec.key] ?? '—'} / {sec.max}</span>
                </div>
              ))}
            </div>
            <MarkedScriptViewer pages={reference.pages} tone="light" />
          </div>
        )}

        {/* Side panel */}
        {!focus && panelOpen && series && detail && draft && (
          <div style={{ width: 340, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: SURFACE, overflowY: 'auto' }}>
            <MarkingSidePanel
              series={series}
              detail={detail}
              draft={draft}
              onDraft={updateDraft}
              draftDirty={draftDirty}
              readOnly={readOnly}
              saving={saving}
              onSaveDraft={() => saveMarks('save')}
              onGrade={() => saveMarks('grade')}
              onReject={() => setRejectOpen(true)}
              notify={notify}
              onNotify={setNotify}
              stats={stats}
              pageItems={pageItems}
              onOpenComment={id => {
                const c = pageItems.find(a => a.id === id);
                if (c && c.t === 'comment') openEditor({ kind: 'comment', id, x: c.x, y: c.y, clientX: window.innerWidth / 2, clientY: window.innerHeight / 3 });
              }}
              bank={bank}
              onToggleReference={toggleReference}
              references={references}
              onOpenReference={openReference}
            />
          </div>
        )}
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject this script" width={460}>
        <p style={{ margin: '0 0 10px', fontSize: T_SM, color: MUTED }}>
          The student is told why and can upload the essay again — even after the deadline. Any marks on this attempt are cleared when they resubmit.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {REJECT_REASONS.map(r => (
            <button key={r} type="button" onClick={() => setRejectReason(r)} style={{ border: `1px solid ${rejectReason === r ? RED : BORDER}`, background: rejectReason === r ? `${RED}10` : SURFACE, color: rejectReason === r ? RED : INK_SOFT, borderRadius: R_PILL, padding: '5px 10px', fontSize: T_XS, cursor: 'pointer' }}>
              {r}
            </button>
          ))}
        </div>
        <FieldTextarea rows={3} value={rejectReason} placeholder="Reason the student will see" onChange={e => setRejectReason(e.target.value)} />
        <FormActions>
          <GhostBtn onClick={() => setRejectOpen(false)}>Cancel</GhostBtn>
          <PrimaryBtn onClick={reject} loading={saving} disabled={!rejectReason.trim()}>Reject & ask to resubmit</PrimaryBtn>
        </FormActions>
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function EditorPopover({ editor, readOnly, bank, isAdmin, onChange, onCommit, onCancel, onDelete, onSaveToBank, onRemoveFromBank }: {
  editor: EditorState;
  readOnly: boolean;
  bank: BankComment[];
  isAdmin: boolean;
  onChange: (e: EditorState) => void;
  onCommit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onSaveToBank: (shared: boolean) => void;
  onRemoveFromBank: (id: number) => void;
}) {
  const W = 320;
  const left = Math.max(8, Math.min(editor.clientX - W / 2, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 8));
  const top = Math.max(8, Math.min(editor.clientY + 16, (typeof window !== 'undefined' ? window.innerHeight : 800) - 360));
  const q = editor.text.trim().toLowerCase();
  const suggestions = editor.kind === 'comment' ? bank.filter(b => !q || b.text.toLowerCase().includes(q)).slice(0, 8) : [];
  const isComment = editor.kind === 'comment';

  return (
    <div style={{ position: 'fixed', left, top, width: W, zIndex: Z_MODAL_BACKDROP - 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, boxShadow: SHADOW_LG, padding: 12, display: 'grid', gap: 8 }}
      onPointerDown={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: T_SM, color: SLATE }}>{isComment ? (editor.id ? 'Comment' : 'New comment') : editor.id ? 'Edit text' : 'Write on the page'}</strong>
        <button type="button" onClick={onCancel} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={14} aria-hidden /></button>
      </div>
      {readOnly ? (
        <p style={{ margin: 0, fontSize: T_SM, color: SLATE, whiteSpace: 'pre-wrap' }}>{editor.text}</p>
      ) : (
        <>
          <textarea
            autoFocus
            rows={isComment ? 4 : 2}
            value={editor.text}
            placeholder={isComment ? 'Type a comment — the student taps the pin to read it' : 'e.g. 8/10'}
            onChange={e => onChange({ ...editor, text: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onCommit(); if (e.key === 'Escape') onCancel(); }}
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER_FIELD}`, borderRadius: R_MD, padding: 8, fontSize: T_BASE, color: SLATE, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {INK_COLORS.map(c => (
              <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => onChange({ ...editor, color: c })}
                style={{ width: 22, height: 22, borderRadius: R_PILL, background: c, cursor: 'pointer', border: editor.color === c ? `3px solid ${SLATE}` : `2px solid ${SURFACE}`, boxShadow: `0 0 0 1px ${BORDER}` }} />
            ))}
          </div>
          {suggestions.length > 0 && (
            <div style={{ maxHeight: 130, overflowY: 'auto', display: 'grid', gap: 4 }}>
              {suggestions.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button type="button" onClick={() => onChange({ ...editor, text: b.text })}
                    style={{ flex: 1, textAlign: 'left', border: `1px solid ${BORDER}`, background: BG, borderRadius: R_MD, padding: '4px 8px', fontSize: T_XS, color: INK_SOFT, cursor: 'pointer' }}>
                    {b.text}{b.shared && <span style={{ color: MUTED }}> · shared</span>}
                  </button>
                  {(!b.shared || isAdmin) && (
                    <button type="button" aria-label="Remove from comment bank" onClick={() => onRemoveFromBank(b.id)} style={{ border: 'none', background: 'transparent', color: MUTED, cursor: 'pointer', display: 'flex' }}><X size={12} aria-hidden /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <PrimaryBtn small onClick={onCommit}>{editor.id ? 'Save' : 'Add'}</PrimaryBtn>
            {editor.id && <GhostBtn small onClick={onDelete}>Delete</GhostBtn>}
            {isComment && editor.text.trim() && (
              <>
                <GhostBtn small onClick={() => onSaveToBank(false)}>Save to my bank</GhostBtn>
                {isAdmin && <GhostBtn small onClick={() => onSaveToBank(true)}>Share</GhostBtn>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
