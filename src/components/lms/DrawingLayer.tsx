'use client';

/**
 * DrawingLayer — freehand pen overlay for MaterialViewer.
 *
 * Renders one absolutely-positioned SVG per PDF page, aligned to that page's
 * on-screen rect (recomputed on scroll/resize/zoom/page-render via a
 * MutationObserver on the highlighter's DOM — see syncPageRects). Points and
 * stroke width are stored normalized to the page's own rect (0–1 fractions),
 * so a drawing replays at the same relative position and thickness at any
 * zoom level. Purely a controlled overlay: all stroke data lives in the
 * parent (MaterialViewer) and flows in as `drawings`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface StrokePoint {
  x: number; // 0–1, normalized to page width
  y: number; // 0–1, normalized to page height
}

export interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number; // 0–1, normalized to page width
}

interface PageRect {
  pageNumber: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
  color: string;
  strokeWidthPx: number; // desired on-screen width at the current zoom
  drawings: Record<number, Stroke[]>;
  onStrokeComplete: (pageNumber: number, stroke: Stroke) => void;
  onActivePageChange?: (pageNumber: number | null) => void;
  scale: number | 'page-width'; // trigger a resync when zoom changes
}

function strokeToPolylinePoints(stroke: Stroke, rect: PageRect): string {
  return stroke.points
    .map((p) => `${(p.x * rect.width).toFixed(1)},${(p.y * rect.height).toFixed(1)}`)
    .join(' ');
}

export default function DrawingLayer({
  containerRef,
  active,
  color,
  strokeWidthPx,
  drawings,
  onStrokeComplete,
  onActivePageChange,
  scale,
}: Props) {
  const [pageRects, setPageRects] = useState<PageRect[]>([]);
  const [liveStroke, setLiveStroke] = useState<{ pageNumber: number; points: StrokePoint[] } | null>(null);
  const drawingPageRef = useRef<number | null>(null);
  const ownRootRef = useRef<HTMLDivElement>(null);

  // ─── Keep page rects in sync with the underlying PDF DOM ────────────────────

  const pageRectsRef = useRef<PageRect[]>([]);

  const syncPageRects = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const highlighter = container.querySelector('.PdfHighlighter');
    if (!highlighter) return;

    const containerRect = container.getBoundingClientRect();
    const pageEls = highlighter.querySelectorAll<HTMLElement>('[data-page-number]');
    const next: PageRect[] = [];

    pageEls.forEach((el) => {
      const pageNumber = Number(el.dataset.pageNumber);
      if (!pageNumber) return;
      const r = el.getBoundingClientRect();
      next.push({
        pageNumber,
        top: r.top - containerRect.top,
        left: r.left - containerRect.left,
        width: r.width,
        height: r.height,
      });
    });

    next.sort((a, b) => a.pageNumber - b.pageNumber);

    // pdf.js mutates the DOM frequently while rendering/zooming; skip the
    // state update (and the re-render it would trigger) when nothing
    // meaningfully changed, within a sub-pixel tolerance.
    const prev = pageRectsRef.current;
    const unchanged =
      prev.length === next.length &&
      prev.every((p, i) => {
        const n = next[i];
        return (
          p.pageNumber === n.pageNumber &&
          Math.abs(p.top - n.top) < 0.5 &&
          Math.abs(p.left - n.left) < 0.5 &&
          Math.abs(p.width - n.width) < 0.5 &&
          Math.abs(p.height - n.height) < 0.5
        );
      });
    if (unchanged) return;

    pageRectsRef.current = next;
    setPageRects(next);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    syncPageRects();
    const raf1 = requestAnimationFrame(syncPageRects);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(syncPageRects));

    // The `.PdfHighlighter` node (and its `.page` children) mount asynchronously
    // once the PDF finishes loading, so bind the scroll listener lazily and
    // idempotently whenever it shows up, instead of only once at mount time.
    let boundHighlighter: Element | null = null;
    const bindScrollListenerIfNeeded = () => {
      const highlighter = container.querySelector('.PdfHighlighter');
      if (highlighter && highlighter !== boundHighlighter) {
        boundHighlighter?.removeEventListener('scroll', syncPageRects);
        highlighter.addEventListener('scroll', syncPageRects);
        boundHighlighter = highlighter;
      }
    };
    bindScrollListenerIfNeeded();

    const resizeObserver = new ResizeObserver(syncPageRects);
    resizeObserver.observe(container);

    // Observe the whole pane (not just `.PdfHighlighter`, which may not exist
    // yet) so both "highlighter mounted" and "pages rendered/resized" trigger a
    // resync. Ignore mutations that originate from our own overlay (the SVGs
    // we render below) — otherwise every resync-triggered re-render would
    // immediately re-trigger the observer in an infinite loop.
    const mutationObserver = new MutationObserver((records) => {
      const ownRoot = ownRootRef.current;
      const isForeignMutation = records.some((r) => !ownRoot || !ownRoot.contains(r.target));
      if (!isForeignMutation) return;
      bindScrollListenerIfNeeded();
      syncPageRects();
    });
    mutationObserver.observe(container, { childList: true, subtree: true, attributes: true });

    window.addEventListener('resize', syncPageRects);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      boundHighlighter?.removeEventListener('scroll', syncPageRects);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', syncPageRects);
    };
  }, [containerRef, syncPageRects, scale]);

  // ─── Pointer handling ────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>, rect: PageRect) => {
      if (!active) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const x = (e.clientX - rect.left - (containerRef.current?.getBoundingClientRect().left ?? 0)) / rect.width;
      const y = (e.clientY - rect.top - (containerRef.current?.getBoundingClientRect().top ?? 0)) / rect.height;
      drawingPageRef.current = rect.pageNumber;
      setLiveStroke({ pageNumber: rect.pageNumber, points: [{ x: clamp01(x), y: clamp01(y) }] });
      onActivePageChange?.(rect.pageNumber);
    },
    [active, containerRef, onActivePageChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>, rect: PageRect) => {
      if (!active || drawingPageRef.current !== rect.pageNumber) return;
      const x = (e.clientX - rect.left - (containerRef.current?.getBoundingClientRect().left ?? 0)) / rect.width;
      const y = (e.clientY - rect.top - (containerRef.current?.getBoundingClientRect().top ?? 0)) / rect.height;
      setLiveStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, { x: clamp01(x), y: clamp01(y) }] } : prev,
      );
    },
    [active, containerRef],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>, rect: PageRect) => {
      if (!active || drawingPageRef.current !== rect.pageNumber) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      drawingPageRef.current = null;

      setLiveStroke((prev) => {
        if (prev && prev.points.length > 0) {
          const points = prev.points.length === 1 ? [prev.points[0], prev.points[0]] : prev.points;
          onStrokeComplete(rect.pageNumber, {
            points,
            color,
            width: strokeWidthPx / rect.width,
          });
        }
        return null;
      });
    },
    [active, color, strokeWidthPx, onStrokeComplete],
  );

  const cursorStyle = useMemo(() => (active ? 'crosshair' : 'default'), [active]);

  if (pageRects.length === 0) return null;

  return (
    <div
      ref={ownRootRef}
      className="absolute inset-0"
      style={{ pointerEvents: 'none', zIndex: 20 }}
      aria-hidden={!active}
    >
      {pageRects.map((rect) => {
        const pageStrokes = drawings[rect.pageNumber] ?? [];
        const live = liveStroke?.pageNumber === rect.pageNumber ? liveStroke : null;

        return (
          <svg
            key={rect.pageNumber}
            data-drawing-page={rect.pageNumber}
            width={rect.width}
            height={rect.height}
            style={{
              position: 'absolute',
              top: rect.top,
              left: rect.left,
              pointerEvents: active ? 'auto' : 'none',
              cursor: cursorStyle,
              touchAction: active ? 'none' : undefined,
            }}
            onPointerDown={(e) => handlePointerDown(e, rect)}
            onPointerMove={(e) => handlePointerMove(e, rect)}
            onPointerUp={(e) => handlePointerUp(e, rect)}
            onPointerCancel={(e) => handlePointerUp(e, rect)}
          >
            {pageStrokes.map((s, i) => (
              <polyline
                key={i}
                points={strokeToPolylinePoints(s, rect)}
                fill="none"
                stroke={s.color}
                strokeWidth={Math.max(1, s.width * rect.width)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {live && (
              <polyline
                points={strokeToPolylinePoints({ points: live.points, color, width: strokeWidthPx / rect.width }, rect)}
                fill="none"
                stroke={color}
                strokeWidth={Math.max(1, strokeWidthPx)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
            )}
          </svg>
        );
      })}
    </div>
  );
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
