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
  BookMarked, ChevronDown, FileText,
} from 'lucide-react';
import type {
  Highlight,
  GhostHighlight,
  PdfHighlighterUtils,
  PdfSelection,
  ScaledPosition,
  ViewportHighlight,
} from 'react-pdf-highlighter-extended';
import type { SerializedHighlight, SerializedMaterial } from '@/app/dashboard/materials/[id]/page';

// ─── Lazy-load pdf highlighter (needs window) ─────────────────────────────────

const PdfLoader = dynamic(
  () => import('react-pdf-highlighter-extended').then((m) => m.PdfLoader),
  { ssr: false },
);

const PdfHighlighter = dynamic(
  () => import('react-pdf-highlighter-extended').then((m) => m.PdfHighlighter),
  { ssr: false },
);

const TextHighlight = dynamic(
  () => import('react-pdf-highlighter-extended').then((m) => m.TextHighlight),
  { ssr: false },
);

const MonitoredHighlightContainer = dynamic(
  () => import('react-pdf-highlighter-extended').then((m) => m.MonitoredHighlightContainer),
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
  isAdmin?: boolean;
}

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
            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: hex,
              borderColor: color === c ? '#1A0507' : 'transparent',
            }}
            aria-label={c}
          />
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

export default function MaterialViewer({ material, initialHighlights, isAdmin = false }: Props) {
  const [highlights, setHighlights] = useState<AppHighlight[]>(
    initialHighlights.map(serializedToApp),
  );
  const [scale, setScale] = useState<number | 'page-width'>('page-width');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [pendingGhost, setPendingGhost] = useState<GhostHighlight | null>(null);
  const [showSelectionTip, setShowSelectionTip] = useState(false);
  const [selectionTipContent, setSelectionTipContent] = useState<PdfSelection | null>(null);

  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);

  // pdf.js workerSrc — use CDN matching pdfjs-dist version installed
  const workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

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
        <p className="text-sm text-[#A86E58] text-center">
          {isAdmin ? 'The PDF could not be loaded. You can still download it.' : 'The PDF could not be loaded. Please contact your instructor.'}
        </p>
        {isAdmin && (
          <a
            href={material.blobUrl}
            download={material.fileName ?? material.title}
            className="flex items-center gap-2 px-4 py-2 bg-[#5A0B0F] text-white text-sm rounded-lg hover:bg-[#760F13] transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        )}
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
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-[#E8DDD5] shadow-sm z-30 flex-shrink-0">
        <a
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-[#A86E58] hover:text-[#5A0B0F] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </a>

        <div className="w-px h-4 bg-[#E8DDD5] flex-shrink-0" />

        <h1 className="text-sm font-medium text-[#1A0507] truncate flex-1 min-w-0">
          {material.title}
        </h1>

        {/* Zoom */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#A86E58] hover:bg-[#FAF5EF] hover:text-[#5A0B0F] transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-[#A86E58] w-10 text-center font-mono">
            {typeof scale === 'number' ? `${Math.round(scale * 100)}%` : 'fit'}
          </span>
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#A86E58] hover:bg-[#FAF5EF] hover:text-[#5A0B0F] transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sidebar toggle (mobile) */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="lg:hidden flex items-center gap-1.5 text-xs text-[#A86E58] hover:text-[#5A0B0F] transition-colors flex-shrink-0"
          aria-label="Toggle highlights"
        >
          <BookMarked className="w-3.5 h-3.5" />
          {highlights.length > 0 && (
            <span className="text-[10px] bg-[#5A0B0F] text-white rounded-full w-4 h-4 flex items-center justify-center">
              {highlights.length}
            </span>
          )}
        </button>

        {/* Download — admins only */}
        {isAdmin && (
          <a
            href={material.blobUrl}
            download={material.fileName ?? material.title}
            className="flex items-center gap-1.5 text-xs text-[#A86E58] hover:text-[#5A0B0F] transition-colors flex-shrink-0"
            aria-label="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>
        )}
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* PDF Viewer */}
        <div className="flex-1 relative overflow-hidden">
          <PdfLoader
            document={material.blobUrl}
            workerSrc={workerSrc}
            onError={(err) => setLoadError(err)}
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
                style={{ height: '100%', position: 'relative' }}
              >
                <HighlightContainerInner
                  editHighlight={handleEditHighlight}
                  deleteHighlight={handleDeleteHighlight}
                />
              </PdfHighlighter>
            )}
          </PdfLoader>
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
