'use client';

/**
 * MaterialViewer — PDF viewer with anchored per-user highlights.
 *
 * Dynamically imported (ssr: false) at the page level because pdf.js needs window.
 * Uses react-pdf-highlighter-extended@8.1.0 (peer-dep warning vs React 19 is accepted).
 *
 * Position shape stored verbatim (ScaledPosition from the library):
 *   {
 *     boundingRect: { x1, y1, x2, y2, width, height, pageNumber },
 *     rects: Array<{ x1, y1, x2, y2, width, height, pageNumber }>,
 *     usePdfCoordinates?: boolean
 *   }
 * pageNumber is duplicated as a top-level column on material_highlights for sidebar ordering.
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import {
  ArrowLeft, Download, ZoomIn, ZoomOut, X, Pencil, Trash2,
  BookMarked, ChevronDown, FileText, PenLine, Undo2, Eraser, Check,
} from 'lucide-react';
import type {
  Highlight,
  GhostHighlight,
  PdfHighlighterUtils,
  PdfSelection,
  ScaledPosition,
  ViewportHighlight,
} from 'react-pdf-highlighter-extended';
import { trackFeature } from '@/lib/analytics/tracker';
import type { SerializedDrawing, SerializedHighlight, SerializedMaterial } from '@/app/dashboard/materials/[id]/page';
import DrawingLayer, { type Stroke } from './DrawingLayer';

// ─── Lazy-load pdf highlighter (needs window) ─────────────────────────────────

const PdfLoader = dynamic(
  () => import('react-pdf-highlighter-extended').then((m) => m.PdfLoader),
  { ssr: false },
);

const PdfHighlighter = dynamic(
  () => import('react-pdf-highlighter-extended').then((m) => m.PdfHighlighter),
  { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppHighlight extends Highlight {
  dbId: number;
  selectedText: string;
  note: string | null;
  color: string;
  pageNumber: number;
}

const COLOR_MAP: Record<string, string> = {
  yellow: 'rgba(255, 213, 0, 0.35)',
  green:  'rgba(34, 197, 94, 0.30)',
  blue:   'rgba(59, 130, 246, 0.30)',
  pink:   'rgba(236, 72, 153, 0.30)',
};

const COLOR_SWATCH: Record<string, string> = {
  yellow: '#FFD500',
  green:  '#22C55E',
  blue:   '#3B82F6',
  pink:   '#EC4899',
};

interface Props {
  material: SerializedMaterial;
  initialHighlights: SerializedHighlight[];
  initialDrawings: SerializedDrawing[];
  isAdmin?: boolean;
}

// ─── Pen tool config ──────────────────────────────────────────────────────────

const PEN_COLORS: { id: string; hex: string; label: string }[] = [
  { id: 'ink',   hex: '#1A0507', label: 'Ink' },
  { id: 'red',   hex: '#760F13', label: 'Red' },
  { id: 'blue',  hex: '#1D4ED8', label: 'Blue' },
  { id: 'green', hex: '#15803D', label: 'Green' },
];

const PEN_SIZES = { thin: 2.5, thick: 6 } as const;
type PenSize = keyof typeof PEN_SIZES;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializedToApp(h: SerializedHighlight): AppHighlight {
  return {
    id: String(h.id),
    dbId: h.id,
    position: h.position,
    selectedText: h.selectedText,
    note: h.note,
    color: h.color,
    pageNumber: h.pageNumber,
  };
}

// ─── Tip component: shown when user makes a text selection ────────────────────

interface SelectionTipProps {
  onSave: (note: string, color: string) => void;
  onCancel: () => void;
}

function SelectionTip({ onSave, onCancel }: SelectionTipProps) {
  const [note, setNote] = useState('');
  const [color, setColor] = useState('yellow');

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ type: 'spring' as const, stiffness: 340, damping: 28 }}
      className="bg-white rounded-xl shadow-xl border border-[#E8DDD5] p-3 w-64 z-50"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Color swatches */}
      <div className="flex gap-2 mb-3">
        {Object.entries(COLOR_SWATCH).map(([c, hex]) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors hover:bg-[#FAF5EF]"
            style={{
              borderColor: color === c ? '#1A0507' : 'transparent',
            }}
            aria-label={c}
          >
            <span className="block w-6 h-6 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
          </button>
        ))}
      </div>

      {/* Note input */}
      <textarea
        className="w-full text-xs border border-[#E8DDD5] rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#A86E58] text-[#1A0507] placeholder:text-[#D4B094]"
        rows={2}
        placeholder="Add a note (optional)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onSave(note, color)}
          className="flex-1 text-xs bg-[#5A0B0F] text-white rounded-lg py-1.5 font-medium hover:bg-[#760F13] transition-colors"
        >
          Highlight
        </button>
        <button
          onClick={onCancel}
          className="px-3 text-xs text-[#A86E58] hover:text-[#5A0B0F] transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ─── Highlight popup: click an existing highlight ─────────────────────────────

interface HighlightPopupProps {
  highlight: ViewportHighlight<AppHighlight>;
  onEdit: (id: string, note: string, color: string) => void;
  onDelete: (id: string) => void;
}

function HighlightPopup({ highlight, onEdit, onDelete }: HighlightPopupProps) {
  const [note, setNote] = useState(highlight.note ?? '');
  const [color, setColor] = useState(highlight.color ?? 'yellow');
  const [editing, setEditing] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ type: 'spring' as const, stiffness: 340, damping: 28 }}
      className="bg-white rounded-xl shadow-xl border border-[#E8DDD5] p-3 w-64 z-50"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] text-[#A86E58] uppercase tracking-widest mb-1">Highlight</p>
      <p className="text-xs text-[#1A0507] italic line-clamp-3 mb-2">
        &ldquo;{highlight.selectedText}&rdquo;
      </p>

      {editing ? (
        <>
          <div className="flex gap-2 mb-2">
            {Object.entries(COLOR_SWATCH).map(([c, hex]) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: hex,
                  borderColor: color === c ? '#1A0507' : 'transparent',
                }}
              />
            ))}
          </div>
          <textarea
            className="w-full text-xs border border-[#E8DDD5] rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#A86E58] mb-2"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { onEdit(highlight.id, note, color); setEditing(false); }}
              className="flex-1 text-xs bg-[#5A0B0F] text-white rounded-lg py-1.5 font-medium hover:bg-[#760F13] transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 text-xs text-[#A86E58] hover:text-[#5A0B0F] transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {highlight.note && (
            <p className="text-xs text-[#5A0B0F] bg-[#FAF5EF] rounded-lg p-2 mb-2">
              {highlight.note}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-[#A86E58] hover:text-[#5A0B0F] transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={() => onDelete(highlight.id)}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors ml-auto"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── HighlightContainer: rendered once per highlight inside PdfHighlighter ────

interface HighlightContainerProps {
  editHighlight: (id: string, note: string, color: string) => void;
  deleteHighlight: (id: string) => void;
}

// We use a separate inner component because useHighlightContainerContext must
// be called inside PdfHighlighter's tree. We defer the import via dynamic().
const HighlightContainerInner = dynamic(
  () =>
    import('react-pdf-highlighter-extended').then((mod) => {
      const { useHighlightContainerContext, TextHighlight, MonitoredHighlightContainer } = mod;

      function Inner({
        editHighlight,
        deleteHighlight,
      }: HighlightContainerProps) {
        const { highlight, isScrolledTo } = useHighlightContainerContext<AppHighlight>();

        const color = highlight.color ?? 'yellow';
        const bgColor = COLOR_MAP[color] ?? COLOR_MAP['yellow'];

        const component = (
          <TextHighlight
            isScrolledTo={isScrolledTo}
            highlight={highlight}
            style={{ background: bgColor }}
          />
        );

        const tip = {
          position: highlight.position,
          content: (
            <HighlightPopup
              highlight={highlight}
              onEdit={editHighlight}
              onDelete={deleteHighlight}
            />
          ),
        };

        return (
          <MonitoredHighlightContainer highlightTip={tip} key={highlight.id}>
            {component}
          </MonitoredHighlightContainer>
        );
      }

      Inner.displayName = 'HighlightContainerInner';
      return { default: Inner };
    }),
  { ssr: false },
);

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  highlights: AppHighlight[];
  onClickHighlight: (h: AppHighlight) => void;
  onClose?: () => void;
}

const sidebarVariants: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 280, damping: 30 } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
};

function HighlightSidebar({ highlights, onClickHighlight, onClose }: SidebarProps) {
  return (
    <motion.aside
      variants={sidebarVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full bg-[#FAF5EF] border-l border-[#E8DDD5] w-72 flex-shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8DDD5]">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-[#A86E58]" strokeWidth={1.5} />
          <span className="text-sm font-medium text-[#1A0507]">
            My Highlights
            {highlights.length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#A86E58] font-sans">
                ({highlights.length})
              </span>
            )}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[#A86E58] hover:text-[#5A0B0F] transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
            <FileText className="w-8 h-8 text-[#D4B094]" strokeWidth={1.25} />
            <p className="text-xs text-[#A86E58]/70">
              Select text in the PDF to add your first highlight.
            </p>
          </div>
        ) : (
          highlights.map((h) => (
            <motion.button
              key={h.id}
              whileHover={{ x: 2 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
              onClick={() => onClickHighlight(h)}
              className="w-full text-left px-4 py-2.5 border-b border-[#F0E8E0] hover:bg-white/60 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0"
                  style={{ backgroundColor: COLOR_SWATCH[h.color] ?? COLOR_SWATCH['yellow'] }}
                />
                <div className="min-w-0">
                  <p className="text-xs text-[#A86E58] mb-0.5">Page {h.pageNumber}</p>
                  <p className="text-xs text-[#1A0507] line-clamp-2 italic">
                    &ldquo;{h.selectedText}&rdquo;
                  </p>
                  {h.note && (
                    <p className="text-[10px] text-[#A86E58] mt-1 line-clamp-2">{h.note}</p>
                  )}
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </motion.aside>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MaterialViewer({ material, initialHighlights, initialDrawings, isAdmin = false }: Props) {
  const [highlights, setHighlights] = useState<AppHighlight[]>(
    initialHighlights.map(serializedToApp),
  );
  const [scale, setScale] = useState<number | 'page-width'>('page-width');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [viewerKey, setViewerKey] = useState(0);
  const [showSelectionTip, setShowSelectionTip] = useState(false);
  const [selectionTipContent, setSelectionTipContent] = useState<PdfSelection | null>(null);

  // ─── Drawing state ──────────────────────────────────────────────────────────
  const [drawMode, setDrawMode] = useState(false);
  const [penMenuOpen, setPenMenuOpen] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].hex);
  const [penSize, setPenSize] = useState<PenSize>('thin');
  const [drawings, setDrawings] = useState<Record<number, Stroke[]>>(() => {
    const map: Record<number, Stroke[]> = {};
    for (const d of initialDrawings) map[d.pageNumber] = d.strokes;
    return map;
  });
  const [activePage, setActivePage] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);
  const pdfPaneRef = useRef<HTMLDivElement>(null);
  const penMenuRef = useRef<HTMLDivElement>(null);
  const saveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the worker inside the application bundle. A public-CDN worker was
  // blocked by the site CSP and by restricted student networks.
  const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  useEffect(() => {
    trackFeature('material_opened', 'lms', { materialId: material.id, type: material.type });
  }, [material.id, material.type]);

  // ─── Drawing persistence ────────────────────────────────────────────────────

  const saveDrawingsForPage = useCallback(
    async (pageNumber: number, strokes: Stroke[]) => {
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/lms/materials/${material.id}/drawings/${pageNumber}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strokes }),
        });
        if (!res.ok) throw new Error('Failed to save drawing');
        setSaveStatus('saved');
        if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
        savedIndicatorTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1800);
      } catch (e) {
        console.error('Network error saving drawing', e);
        setSaveStatus('idle');
      }
    },
    [material.id],
  );

  const scheduleSave = useCallback(
    (pageNumber: number, strokes: Stroke[]) => {
      const timers = saveTimersRef.current;
      if (timers[pageNumber]) clearTimeout(timers[pageNumber]);
      timers[pageNumber] = setTimeout(() => {
        void saveDrawingsForPage(pageNumber, strokes);
      }, 700);
    },
    [saveDrawingsForPage],
  );

  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    };
  }, []);

  const handleStrokeComplete = useCallback(
    (pageNumber: number, stroke: Stroke) => {
      setDrawings((prev) => {
        const next = { ...prev, [pageNumber]: [...(prev[pageNumber] ?? []), stroke] };
        scheduleSave(pageNumber, next[pageNumber]);
        return next;
      });
      trackFeature('material_drawing_added', 'lms', { materialId: material.id, pageNumber });
    },
    [material.id, scheduleSave],
  );

  const handleUndo = useCallback(() => {
    if (!activePage) return;
    setDrawings((prev) => {
      const pageStrokes = prev[activePage];
      if (!pageStrokes || pageStrokes.length === 0) return prev;
      const next = { ...prev, [activePage]: pageStrokes.slice(0, -1) };
      scheduleSave(activePage, next[activePage]);
      return next;
    });
  }, [activePage, scheduleSave]);

  const handleClearPage = useCallback(() => {
    if (!activePage) return;
    setDrawings((prev) => {
      if (!prev[activePage] || prev[activePage].length === 0) return prev;
      const next = { ...prev, [activePage]: [] };
      scheduleSave(activePage, []);
      return next;
    });
  }, [activePage, scheduleSave]);

  const hasActivePageStrokes = activePage != null && (drawings[activePage]?.length ?? 0) > 0;

  // Pen button cycles: off → on+menu-open → on+menu-closed → off.
  const handlePenButtonClick = useCallback(() => {
    if (!drawMode) {
      setDrawMode(true);
      setPenMenuOpen(true);
    } else if (penMenuOpen) {
      setPenMenuOpen(false);
    } else {
      setDrawMode(false);
    }
  }, [drawMode, penMenuOpen]);

  // Dismiss the pen popover on outside click (draw mode itself stays on).
  useEffect(() => {
    if (!penMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (penMenuRef.current && !penMenuRef.current.contains(e.target as Node)) {
        setPenMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [penMenuOpen]);

  // ─── Optimistic add after POST ─────────────────────────────────────────────

  const handleSaveHighlight = useCallback(
    async (note: string, color: string) => {
      if (!selectionTipContent) return;

      const ghost: GhostHighlight = selectionTipContent.makeGhostHighlight();
      const position = ghost.position as ScaledPosition;
      const pageNumber = position.boundingRect.pageNumber;
      const selectedText = ghost.content.text ?? '';

      setShowSelectionTip(false);
      setSelectionTipContent(null);
      highlighterUtilsRef.current?.removeGhostHighlight();

      if (!selectedText.trim()) return;

      try {
        const res = await fetch(`/api/lms/materials/${material.id}/highlights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageNumber, position, selectedText, note: note || null, color }),
        });

        if (!res.ok) {
          console.error('Failed to save highlight');
          return;
        }

        const created = await res.json() as {
          id: number;
          materialId: number;
          pageNumber: number;
          position: ScaledPosition;
          selectedText: string;
          note: string | null;
          color: string;
          updatedAt: number;
        };

        const appHighlight: AppHighlight = {
          id: String(created.id),
          dbId: created.id,
          position: created.position,
          selectedText: created.selectedText,
          note: created.note,
          color: created.color,
          pageNumber: created.pageNumber,
        };

        setHighlights((prev) =>
          [...prev, appHighlight].sort((a, b) => a.pageNumber - b.pageNumber),
        );
      } catch (e) {
        console.error('Network error saving highlight', e);
      }
    },
    [material.id, selectionTipContent],
  );

  // ─── Edit ──────────────────────────────────────────────────────────────────

  const handleEditHighlight = useCallback(
    async (id: string, note: string, color: string) => {
      const h = highlights.find((x) => x.id === id);
      if (!h) return;

      // Optimistic
      setHighlights((prev) =>
        prev.map((x) => (x.id === id ? { ...x, note: note || null, color } : x)),
      );
      highlighterUtilsRef.current?.setTip(null);

      try {
        await fetch(`/api/lms/materials/${material.id}/highlights/${h.dbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: note || null, color }),
        });
      } catch (e) {
        console.error('Network error patching highlight', e);
      }
    },
    [highlights, material.id],
  );

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteHighlight = useCallback(
    async (id: string) => {
      const h = highlights.find((x) => x.id === id);
      if (!h) return;

      // Optimistic
      setHighlights((prev) => prev.filter((x) => x.id !== id));
      highlighterUtilsRef.current?.setTip(null);

      try {
        await fetch(`/api/lms/materials/${material.id}/highlights/${h.dbId}`, {
          method: 'DELETE',
        });
      } catch (e) {
        console.error('Network error deleting highlight', e);
      }
    },
    [highlights, material.id],
  );

  // ─── Sidebar scroll-to ────────────────────────────────────────────────────

  const handleSidebarClick = useCallback((h: AppHighlight) => {
    highlighterUtilsRef.current?.scrollToHighlight(h);
  }, []);

  // ─── Zoom ─────────────────────────────────────────────────────────────────

  const handleZoomIn = () => {
    setScale((prev) => (typeof prev === 'number' ? Math.min(prev + 0.25, 3) : 1.5));
  };
  const handleZoomOut = () => {
    setScale((prev) => (typeof prev === 'number' ? Math.max(prev - 0.25, 0.5) : 0.75));
  };

  // ─── Selection tip ────────────────────────────────────────────────────────

  const handleSelection = useCallback((selection: PdfSelection) => {
    if (!selection.content.text?.trim()) return;
    setSelectionTipContent(selection);
    setShowSelectionTip(true);
  }, []);

  const handleCancelSelection = useCallback(() => {
    setShowSelectionTip(false);
    setSelectionTipContent(null);
    highlighterUtilsRef.current?.removeGhostHighlight();
  }, []);

  // ─── Error state ──────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FAF5EF] flex flex-col items-center justify-center gap-4 p-6">
        <FileText className="w-12 h-12 text-[#D4B094]" strokeWidth={1.25} />
        <h1 className="text-xl font-semibold text-[#1A0507]">The PDF did not load</h1>
        <p className="max-w-sm text-base leading-6 text-[#6F4A43] text-center">
          Your place is safe. Retry the viewer or download the file and open it on your device.
        </p>
        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              trackFeature('material_retry', 'lms', { materialId: material.id });
              setLoadError(null);
              setViewerKey((key) => key + 1);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#760F13] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5A0B0F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#760F13]"
          >
            Retry viewer
          </button>
          <a
            href={material.blobUrl}
            download={material.fileName ?? material.title}
            onClick={() => trackFeature('material_downloaded', 'lms', { materialId: material.id, from: 'error' })}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D8C7BA] bg-white px-4 py-2 text-sm font-semibold text-[#5A0B0F] transition-colors hover:bg-[#F4ECE5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#760F13]"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        </div>
        <a
          href="/dashboard"
          className="text-xs text-[#A86E58] hover:text-[#5A0B0F] transition-colors"
        >
          ← Back to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#F2EBE3] overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-3 sm:px-5 py-3 bg-white/95 backdrop-blur-sm border-b border-[#E8DDD5] shadow-[0_1px_2px_rgba(26,5,7,0.05)] z-30 flex-shrink-0">
        <a
          href="/dashboard"
          className="flex min-h-11 items-center gap-1.5 px-2 -ml-2 rounded-lg text-xs font-medium text-[#A86E58] hover:text-[#5A0B0F] hover:bg-[#FAF5EF] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </a>

        <div className="w-px h-5 bg-[#E8DDD5] flex-shrink-0" />

        <div className="flex-1 min-w-0 flex items-baseline gap-2.5">
          <h1 className="font-heading text-[15px] sm:text-base font-medium tracking-[-0.01em] text-[#1A0507] truncate">
            {material.title}
          </h1>
          <AnimatePresence>
            {saveStatus !== 'idle' && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden sm:flex items-center gap-1 text-[11px] text-[#A86E58]/80 flex-shrink-0"
              >
                {saveStatus === 'saving' ? (
                  <>
                    <span className="w-3 h-3 border-[1.5px] border-[#A86E58]/40 border-t-[#A86E58] rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    Saved
                  </>
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Unified control pill */}
        <div className="flex items-center gap-0.5 flex-shrink-0 bg-[#FAF5EF] border border-[#E8DDD5]/70 rounded-full p-1">
          {/* Zoom */}
          <button
            onClick={handleZoomOut}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#A86E58] hover:bg-white hover:text-[#5A0B0F] transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-[#A86E58] w-9 text-center font-mono flex-shrink-0">
            {typeof scale === 'number' ? `${Math.round(scale * 100)}%` : 'fit'}
          </span>
          <button
            onClick={handleZoomIn}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#A86E58] hover:bg-white hover:text-[#5A0B0F] transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-[#E8DDD5] mx-0.5" />

          {/* Draw toggle + popover */}
          <div className="relative" ref={penMenuRef}>
            <button
              onClick={handlePenButtonClick}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                drawMode
                  ? 'bg-[#5A0B0F] text-white'
                  : 'text-[#A86E58] hover:bg-white hover:text-[#5A0B0F]'
              }`}
              aria-label="Draw on PDF"
              aria-pressed={drawMode}
            >
              <PenLine className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {penMenuOpen && drawMode && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ type: 'spring' as const, stiffness: 340, damping: 28 }}
                  className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-[#E8DDD5] p-3 w-56 z-50"
                >
                  <p className="text-[10px] text-[#A86E58] uppercase tracking-widest mb-2">Pen</p>

                  <div className="flex gap-2 mb-3">
                    {PEN_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setPenColor(c.hex)}
                        className="w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors hover:bg-[#FAF5EF]"
                        style={{ borderColor: penColor === c.hex ? '#1A0507' : 'transparent' }}
                        aria-label={c.label}
                        aria-pressed={penColor === c.hex}
                      >
                        <span className="block w-5 h-5 rounded-full" style={{ backgroundColor: c.hex }} aria-hidden />
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-3">
                    {(Object.keys(PEN_SIZES) as PenSize[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => setPenSize(size)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          penSize === size
                            ? 'border-[#5A0B0F] bg-[#5A0B0F]/5 text-[#5A0B0F]'
                            : 'border-[#E8DDD5] text-[#A86E58] hover:bg-[#FAF5EF]'
                        }`}
                        aria-pressed={penSize === size}
                      >
                        <span
                          className="rounded-full bg-current"
                          style={{ width: size === 'thin' ? 4 : 8, height: size === 'thin' ? 4 : 8 }}
                          aria-hidden
                        />
                        {size === 'thin' ? 'Thin' : 'Thick'}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={!hasActivePageStrokes}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-[#5A0B0F] border border-[#E8DDD5] rounded-lg py-1.5 hover:bg-[#FAF5EF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Undo2 className="w-3 h-3" />
                      Undo
                    </button>
                    <button
                      onClick={handleClearPage}
                      disabled={!hasActivePageStrokes}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 border border-[#E8DDD5] rounded-lg py-1.5 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Eraser className="w-3 h-3" />
                      Clear page
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-px h-4 bg-[#E8DDD5] mx-0.5 lg:hidden" />

          {/* Sidebar toggle (mobile) */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden relative w-9 h-9 flex items-center justify-center rounded-full text-[#A86E58] hover:bg-white hover:text-[#5A0B0F] transition-colors"
            aria-label="Toggle highlights"
          >
            <BookMarked className="w-3.5 h-3.5" />
            {highlights.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-[#5A0B0F] text-white rounded-full w-4 h-4 flex items-center justify-center">
                {highlights.length}
              </span>
            )}
          </button>

          {/* Download — admins only */}
          {isAdmin && (
            <>
              <div className="w-px h-4 bg-[#E8DDD5] mx-0.5" />
              <a
                href={material.blobUrl}
                download={material.fileName ?? material.title}
                onClick={() => trackFeature('material_downloaded', 'lms', { materialId: material.id, from: 'toolbar' })}
                className="w-9 h-9 flex items-center justify-center rounded-full text-[#A86E58] hover:bg-white hover:text-[#5A0B0F] transition-colors"
                aria-label="Download PDF"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </>
          )}
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* PDF Viewer */}
        <div ref={pdfPaneRef} className="flex-1 relative overflow-hidden">
          <PdfLoader
            key={viewerKey}
            document={material.blobUrl}
            workerSrc={workerSrc}
            onError={(err) => {
              trackFeature('material_load_failed', 'lms', {
                materialId: material.id,
                message: err.message.slice(0, 160),
              });
              setLoadError(err);
            }}
            beforeLoad={(progress) => (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-2 border-[#A86E58]/30 border-t-[#A86E58] rounded-full animate-spin" />
                <p className="text-xs text-[#A86E58]">
                  Loading PDF…{' '}
                  {progress.total ? `${Math.round((progress.loaded / progress.total) * 100)}%` : ''}
                </p>
              </div>
            )}
            errorMessage={(err) => {
              // also set state so full error screen triggers
              setLoadError(err);
              return null;
            }}
          >
            {(pdfDocument) => (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                highlights={highlights}
                pdfScaleValue={scale}
                onSelection={handleSelection}
                selectionTip={
                  showSelectionTip && selectionTipContent ? (
                    <SelectionTip
                      onSave={handleSaveHighlight}
                      onCancel={handleCancelSelection}
                    />
                  ) : undefined
                }
                utilsRef={(utils) => {
                  highlighterUtilsRef.current = utils;
                }}
                style={{ height: '100%' }}
              >
                <HighlightContainerInner
                  editHighlight={handleEditHighlight}
                  deleteHighlight={handleDeleteHighlight}
                />
              </PdfHighlighter>
            )}
          </PdfLoader>

          <DrawingLayer
            containerRef={pdfPaneRef}
            active={drawMode}
            color={penColor}
            strokeWidthPx={PEN_SIZES[penSize]}
            drawings={drawings}
            onStrokeComplete={handleStrokeComplete}
            onActivePageChange={setActivePage}
            scale={scale}
          />
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:flex h-full">
          <AnimatePresence>
            {sidebarOpen && (
              <HighlightSidebar
                highlights={highlights}
                onClickHighlight={handleSidebarClick}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Mobile bottom sheet */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-[#FAF5EF] border-t border-[#E8DDD5] rounded-t-2xl shadow-2xl max-h-[50vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 30 } }}
              exit={{ y: '100%', transition: { duration: 0.2 } }}
            >
              <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#FAF5EF] border-b border-[#E8DDD5]">
                <div className="flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-[#A86E58]" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-[#1A0507]">
                    My Highlights ({highlights.length})
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-[#A86E58] hover:text-[#5A0B0F] transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {highlights.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2 text-center px-4">
                  <FileText className="w-7 h-7 text-[#D4B094]" strokeWidth={1.25} />
                  <p className="text-xs text-[#A86E58]/70">No highlights yet. Select text to add one.</p>
                </div>
              ) : (
                highlights.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      handleSidebarClick(h);
                      setSidebarOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 border-b border-[#F0E8E0] hover:bg-white/60 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: COLOR_SWATCH[h.color] ?? COLOR_SWATCH['yellow'] }}
                      />
                      <div>
                        <p className="text-[10px] text-[#A86E58] mb-0.5">Page {h.pageNumber}</p>
                        <p className="text-xs text-[#1A0507] italic line-clamp-2">
                          &ldquo;{h.selectedText}&rdquo;
                        </p>
                        {h.note && (
                          <p className="text-[10px] text-[#A86E58] mt-0.5 line-clamp-1">{h.note}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
