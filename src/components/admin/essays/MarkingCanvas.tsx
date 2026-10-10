'use client';

/**
 * MarkingCanvas — the pen engine for one essay page.
 *
 * Two stacked canvases inside a scrollable viewport: the page photo (base,
 * with the grader's brightness/contrast/scan filter applied via CSS only) and
 * the markup layer. Committed markup is cached in an offscreen canvas so a
 * live stroke only redraws itself on top of it.
 *
 * Input model (Pointer Events):
 *   - Stylus: draws with real pressure. As soon as a stylus is seen, finger
 *     touches stop drawing (palm rejection) and only scroll/zoom.
 *   - One finger (no stylus seen) or mouse: uses the active tool.
 *   - Two fingers: pinch to zoom + drag to pan, always.
 *   - Hand tool: drag to pan.
 *
 * All coordinates are normalized to the displayed page (see annotations.ts),
 * so markup is independent of zoom and screen size.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  annotationBounds, annotationPoints, drawAnnotations, erasePartial, hitsAnnotation, pointInPolygon, translateAnnotation,
  type EssayAnnotation, type EssayShapeKind, type EssayStampKind, type InkPoint,
} from '@/lib/essays/annotations';
import { drawRotatedImage, loadImage } from '@/lib/essays/render-client';
import { newId } from '@/lib/essays/image-prep';

export type MarkTool = 'pen' | 'hl' | 'eraser' | 'shape' | 'stamp' | 'text' | 'comment' | 'lasso' | 'hand';

export interface ToolSettings {
  tool: MarkTool;
  color: string;
  hlColor: string;
  sizeIndex: 0 | 1 | 2;
  eraserMode: 'stroke' | 'partial';
  shape: EssayShapeKind;
  stamp: EssayStampKind;
}

export const PEN_SIZES = [0.0022, 0.0038, 0.0065];
export const HL_SIZES = [0.014, 0.024, 0.038];
export const STAMP_SCALES = [0.75, 1, 1.45];
export const TEXT_SCALES = [0.8, 1, 1.4];
const ERASER_RADIUS = [0.01, 0.018, 0.03];

export interface CanvasPage {
  id: number;
  imageUrl: string;
  rotation: number;
  width: number;
  height: number;
}

export interface MarkingCanvasHandle {
  zoomBy: (factor: number) => void;
  fit: () => void;
}

interface Props {
  page: CanvasPage;
  items: EssayAnnotation[];
  settings: ToolSettings;
  readOnly: boolean;
  zoom: number;
  onZoomChange: (z: number) => void;
  imageFilter: string;
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  /** Replace the page's items. `commit` = push an undo step. */
  onChange: (items: EssayAnnotation[]) => void;
  /** User tapped to add/edit a comment or text — the parent shows the editor at (clientX, clientY). */
  onEditRequest: (req: { kind: 'comment' | 'text'; id: string | null; x: number; y: number; clientX: number; clientY: number }) => void;
  onStylusSeen?: () => void;
  stylusOnly: boolean;
}

type Live =
  | null
  | { kind: 'ink'; item: Extract<EssayAnnotation, { t: 'pen' | 'hl' }> }
  | { kind: 'shape'; item: Extract<EssayAnnotation, { t: 'shape' }> }
  | { kind: 'erase'; items: EssayAnnotation[]; changed: boolean; cursor: [number, number] }
  | { kind: 'lasso'; points: [number, number][] }
  | { kind: 'move'; start: [number, number]; base: EssayAnnotation[]; delta: [number, number] };

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

const MarkingCanvas = forwardRef<MarkingCanvasHandle, Props>(function MarkingCanvas(props, ref) {
  const { page, items, settings, readOnly, zoom, onZoomChange, imageFilter, selectedIds, onSelect, onChange, onEditRequest, onStylusSeen, stylusOnly } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const liveRef = useRef<Live>(null);
  const rafRef = useRef<number | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<null | { dist: number; zoom: number; cx: number; cy: number; scrollL: number; scrollT: number }>(null);
  const panRef = useRef<null | { x: number; y: number; l: number; t: number }>(null);
  const activePointer = useRef<number | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pendingScroll = useRef<null | { l: number; t: number }>(null);

  // ── Image ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setImg(null);
    setImgError(false);
    loadImage(page.imageUrl).then(i => { if (alive) setImg(i); }).catch(() => { if (alive) setImgError(true); });
    return () => { alive = false; };
  }, [page.imageUrl]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setViewport({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Displayed page size at zoom 1 = fit the whole page inside the viewport.
  const swap = page.rotation === 90 || page.rotation === 270;
  const pw = swap ? page.height : page.width;
  const ph = swap ? page.width : page.height;
  const pad = 24;
  const fitScale = viewport.w && viewport.h ? Math.min((viewport.w - pad * 2) / pw, (viewport.h - pad * 2) / ph) : 0;
  const stageW = Math.max(1, Math.round(pw * fitScale * zoom));
  const stageH = Math.max(1, Math.round(ph * fitScale * zoom));
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  // Cap the backing store (~24MP) so a 5× zoom on a big tablet doesn't blow up memory.
  const backScale = Math.min(dpr, Math.sqrt(24_000_000 / (stageW * stageH)));

  // ── Base layer ─────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const c = baseRef.current;
    if (!c || !img || !fitScale) return;
    c.width = Math.round(stageW * backScale);
    c.height = Math.round(stageH * backScale);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(backScale, 0, 0, backScale, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, stageW, stageH);
    ctx.imageSmoothingQuality = 'high';
    drawRotatedImage(ctx, img, page.rotation, stageW, stageH);
  }, [img, stageW, stageH, backScale, page.rotation, fitScale]);

  // ── Ink layer ──────────────────────────────────────────────────────────────
  const renderCommitted = useCallback((list: EssayAnnotation[]) => {
    if (!committedRef.current) committedRef.current = document.createElement('canvas');
    const c = committedRef.current;
    c.width = Math.round(stageW * backScale);
    c.height = Math.round(stageH * backScale);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(backScale, 0, 0, backScale, 0, 0);
    drawAnnotations(ctx, list, stageW, stageH, { selectedIds });
  }, [stageW, stageH, backScale, selectedIds]);

  const paint = useCallback(() => {
    rafRef.current = null;
    const c = inkRef.current;
    if (!c) return;
    if (c.width !== Math.round(stageW * backScale) || c.height !== Math.round(stageH * backScale)) {
      c.width = Math.round(stageW * backScale);
      c.height = Math.round(stageH * backScale);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const live = liveRef.current;
    if (live?.kind === 'erase' || live?.kind === 'move') {
      ctx.setTransform(backScale, 0, 0, backScale, 0, 0);
      const list = live.kind === 'erase'
        ? live.items
        : live.base.map(a => (selectedIds.has(a.id) ? translateAnnotation(a, live.delta[0], live.delta[1]) : a));
      drawAnnotations(ctx, list, stageW, stageH, { selectedIds });
      if (live.kind === 'erase') {
        ctx.strokeStyle = '#6B7280';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(live.cursor[0] * stageW, live.cursor[1] * stageH, ERASER_RADIUS[settings.sizeIndex] * stageW, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }
    if (committedRef.current) ctx.drawImage(committedRef.current, 0, 0);
    ctx.setTransform(backScale, 0, 0, backScale, 0, 0);
    if (live?.kind === 'ink' || live?.kind === 'shape') drawAnnotations(ctx, [live.item], stageW, stageH);
    if (live?.kind === 'lasso' && live.points.length > 1) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#7C3AED';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      live.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * stageW, y * stageH) : ctx.moveTo(x * stageW, y * stageH)));
      ctx.closePath();
      ctx.stroke();
    }
  }, [stageW, stageH, backScale, selectedIds, settings.sizeIndex]);

  const schedule = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(paint);
  }, [paint]);

  useLayoutEffect(() => {
    renderCommitted(items);
    paint();
  }, [items, renderCommitted, paint]);

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  // Keep the pinch focal point under the fingers after a zoom re-layout.
  useLayoutEffect(() => {
    const v = viewportRef.current;
    if (v && pendingScroll.current) {
      v.scrollLeft = pendingScroll.current.l;
      v.scrollTop = pendingScroll.current.t;
      pendingScroll.current = null;
    }
  }, [stageW, stageH]);

  const zoomAt = useCallback((next: number, clientX?: number, clientY?: number) => {
    const v = viewportRef.current;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (!v) { onZoomChange(z); return; }
    const r = v.getBoundingClientRect();
    const cx = (clientX ?? r.left + r.width / 2) - r.left;
    const cy = (clientY ?? r.top + r.height / 2) - r.top;
    const k = z / zoomRef.current;
    pendingScroll.current = { l: (v.scrollLeft + cx) * k - cx, t: (v.scrollTop + cy) * k - cy };
    onZoomChange(z);
  }, [onZoomChange]);

  useImperativeHandle(ref, () => ({
    zoomBy: f => zoomAt(zoomRef.current * f),
    fit: () => onZoomChange(1),
  }), [zoomAt, onZoomChange]);

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms around the cursor.
  useEffect(() => {
    const v = viewportRef.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    };
    v.addEventListener('wheel', onWheel, { passive: false });
    return () => v.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ── Pointer handling ───────────────────────────────────────────────────────
  const toPage = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = inkRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const aspect = stageH / Math.max(1, stageW);
  const pressureOf = (e: PointerEvent | React.PointerEvent) => (e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 0.5);

  const selectionBounds = () => {
    const sel = items.filter(a => selectedIds.has(a.id));
    if (!sel.length) return null;
    return sel.reduce((b, a) => {
      const x = annotationBounds(a);
      return { x1: Math.min(b.x1, x.x1), y1: Math.min(b.y1, x.y1), x2: Math.max(b.x2, x.x2), y2: Math.max(b.y2, x.y2) };
    }, { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
  };

  const startPan = (e: React.PointerEvent) => {
    const v = viewportRef.current!;
    panRef.current = { x: e.clientX, y: e.clientY, l: v.scrollLeft, t: v.scrollTop };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') onStylusSeen?.();
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        // Second finger: abandon whatever the first finger started and pinch instead.
        liveRef.current = null;
        activePointer.current = null;
        schedule();
        const [a, b] = [...touches.current.values()];
        const v = viewportRef.current!;
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomRef.current, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, scrollL: v.scrollLeft, scrollT: v.scrollTop };
        return;
      }
      if (stylusOnly) { startPan(e); return; }
    }
    if (activePointer.current !== null) return;
    if (settings.tool === 'hand' || (e.button === 1)) { startPan(e); e.currentTarget.setPointerCapture(e.pointerId); return; }
    const [x, y] = toPage(e);

    // Tapping an existing comment pin opens it with any tool except the eraser.
    const pin = settings.tool !== 'eraser' ? [...items].reverse().find(a => a.t === 'comment' && hitsAnnotation(a, x, y, 0.015, aspect)) : undefined;
    if (pin && pin.t === 'comment') {
      onEditRequest({ kind: 'comment', id: pin.id, x: pin.x, y: pin.y, clientX: e.clientX, clientY: e.clientY });
      return;
    }
    if (readOnly) { startPan(e); e.currentTarget.setPointerCapture(e.pointerId); return; }

    e.currentTarget.setPointerCapture(e.pointerId);
    activePointer.current = e.pointerId;
    const sizeIndex = settings.sizeIndex;
    switch (settings.tool) {
      case 'pen':
      case 'hl':
        onSelect(new Set());
        liveRef.current = {
          kind: 'ink',
          item: {
            id: newId(), t: settings.tool,
            color: settings.tool === 'pen' ? settings.color : settings.hlColor,
            size: settings.tool === 'pen' ? PEN_SIZES[sizeIndex] : HL_SIZES[sizeIndex],
            points: [[x, y, pressureOf(e)]],
          },
        };
        break;
      case 'shape':
        onSelect(new Set());
        liveRef.current = { kind: 'shape', item: { id: newId(), t: 'shape', shape: settings.shape, color: settings.color, size: PEN_SIZES[sizeIndex], a: [x, y], b: [x, y] } };
        break;
      case 'eraser': {
        const r = ERASER_RADIUS[sizeIndex];
        const next = settings.eraserMode === 'stroke'
          ? items.filter(a => !hitsAnnotation(a, x, y, r, aspect))
          : erasePartial(items, x, y, r, aspect, newId);
        liveRef.current = { kind: 'erase', items: next, changed: next.length !== items.length || next.some((a, i) => a !== items[i]), cursor: [x, y] };
        break;
      }
      case 'stamp':
        activePointer.current = null;
        onChange([...items, { id: newId(), t: 'stamp', kind: settings.stamp, color: settings.color, x, y, scale: STAMP_SCALES[sizeIndex] }]);
        return;
      case 'text': {
        activePointer.current = null;
        const hit = [...items].reverse().find(a => a.t === 'text' && hitsAnnotation(a, x, y, 0.01, aspect));
        onEditRequest({ kind: 'text', id: hit?.id ?? null, x: hit && hit.t === 'text' ? hit.x : x, y: hit && hit.t === 'text' ? hit.y : y, clientX: e.clientX, clientY: e.clientY });
        return;
      }
      case 'comment':
        activePointer.current = null;
        onEditRequest({ kind: 'comment', id: null, x, y, clientX: e.clientX, clientY: e.clientY });
        return;
      case 'lasso': {
        const b = selectionBounds();
        if (b && x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2) {
          liveRef.current = { kind: 'move', start: [x, y], base: items, delta: [0, 0] };
        } else {
          onSelect(new Set());
          liveRef.current = { kind: 'lasso', points: [[x, y]] };
        }
        break;
      }
    }
    schedule();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        const v = viewportRef.current!;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const p = pinch.current;
        const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (p.zoom * dist) / Math.max(1, p.dist)));
        const r = v.getBoundingClientRect();
        const k = target / p.zoom;
        pendingScroll.current = {
          l: (p.scrollL + (p.cx - r.left)) * k - (cx - r.left),
          t: (p.scrollT + (p.cy - r.top)) * k - (cy - r.top),
        };
        if (Math.abs(target - zoomRef.current) > 0.01) onZoomChange(target);
        else { v.scrollLeft = pendingScroll.current.l; v.scrollTop = pendingScroll.current.t; pendingScroll.current = null; }
        return;
      }
    }
    if (panRef.current) {
      const v = viewportRef.current!;
      v.scrollLeft = panRef.current.l - (e.clientX - panRef.current.x);
      v.scrollTop = panRef.current.t - (e.clientY - panRef.current.y);
      return;
    }
    if (activePointer.current !== e.pointerId) {
      return;
    }
    const live = liveRef.current;
    if (!live) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
    const samples = events.length ? events : [e.nativeEvent];
    switch (live.kind) {
      case 'ink':
        for (const s of samples) {
          const [x, y] = toPage(s);
          live.item.points.push([x, y, pressureOf(s)] as InkPoint);
        }
        break;
      case 'shape':
        live.item.b = toPage(e);
        break;
      case 'erase': {
        const r = ERASER_RADIUS[settings.sizeIndex];
        for (const s of samples) {
          const [x, y] = toPage(s);
          const before = live.items;
          live.items = settings.eraserMode === 'stroke'
            ? before.filter(a => !hitsAnnotation(a, x, y, r, aspect))
            : erasePartial(before, x, y, r, aspect, newId);
          if (live.items.length !== before.length || live.items.some((a, i) => a !== before[i])) live.changed = true;
          live.cursor = [x, y];
        }
        break;
      }
      case 'lasso':
        live.points.push(toPage(e));
        break;
      case 'move': {
        const [x, y] = toPage(e);
        live.delta = [x - live.start[0], y - live.start[1]];
        break;
      }
    }
    schedule();
  };

  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (touches.current.size < 2) pinch.current = null;
    }
    if (panRef.current && (activePointer.current === null || activePointer.current === e.pointerId)) {
      panRef.current = null;
    }
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    const live = liveRef.current;
    liveRef.current = null;
    if (!live) { schedule(); return; }
    switch (live.kind) {
      case 'ink':
        if (live.item.points.length === 1) {
          const [x, y, p] = live.item.points[0];
          live.item.points.push([x + 0.0005, y + 0.0005, p]); // a tap leaves a dot
        }
        onChange([...items, live.item]);
        break;
      case 'shape': {
        const { a, b } = live.item;
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.004) onChange([...items, live.item]);
        else schedule();
        break;
      }
      case 'erase':
        if (live.changed) onChange(live.items); else schedule();
        break;
      case 'lasso': {
        const poly = live.points;
        if (poly.length < 3) { schedule(); break; }
        const picked = items.filter(a => {
          const pts = annotationPoints(a);
          const inside = pts.filter(([px, py]) => pointInPolygon(px, py, poly)).length;
          return inside / pts.length >= 0.5;
        });
        onSelect(new Set(picked.map(a => a.id)));
        schedule();
        break;
      }
      case 'move':
        if (live.delta[0] || live.delta[1]) {
          onChange(live.base.map(a => (selectedIds.has(a.id) ? translateAnnotation(a, live.delta[0], live.delta[1]) : a)));
        } else schedule();
        break;
    }
  };

  const cursor = readOnly ? 'grab'
    : settings.tool === 'hand' ? 'grab'
    : settings.tool === 'text' ? 'text'
    : settings.tool === 'eraser' ? 'cell'
    : 'crosshair';

  return (
    <div ref={viewportRef} style={{ position: 'absolute', inset: 0, overflow: 'auto', overscrollBehavior: 'contain' }}>
      <div style={{ minWidth: '100%', minHeight: '100%', width: stageW + pad * 2, height: stageH + pad * 2, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: pad, boxSizing: 'border-box' }}>
        <div style={{ position: 'relative', width: stageW, height: stageH, flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.18)', background: '#FFFFFF' }}>
          <canvas ref={baseRef} style={{ position: 'absolute', inset: 0, width: stageW, height: stageH, filter: imageFilter }} />
          <canvas
            ref={inkRef}
            style={{ position: 'absolute', inset: 0, width: stageW, height: stageH, touchAction: 'none', cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={finish}
            onContextMenu={e => e.preventDefault()}
          />
          {!img && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#6B7280' }}>
              {imgError ? 'Could not load this page.' : 'Loading page…'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default MarkingCanvas;
