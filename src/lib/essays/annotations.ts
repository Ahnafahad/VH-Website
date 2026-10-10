/**
 * Essay page annotations — the vector markup a grader draws on a page.
 *
 * Every coordinate is normalized 0–1 to the page's displayed width/height
 * (after `rotation`), and every size is a fraction of the page width, so the
 * markup replays identically at any zoom level, on the student's phone, and
 * in the exported PDF. `drawAnnotations` is the single renderer used by the
 * marking canvas, the student viewer and the PDF export.
 *
 * Client- and server-safe (no DOM imports at module scope).
 */

import { getStroke } from 'perfect-freehand';

export type EssayStampKind = 'tick' | 'cross' | 'double_tick' | 'sp' | 'gr' | 'ww' | 'q' | 'para' | 'caret' | 'good' | 'vague';

export const STAMP_LABELS: Record<EssayStampKind, string> = {
  tick: '✓',
  double_tick: '✓✓',
  cross: '✗',
  sp: 'sp',
  gr: 'gr',
  ww: 'ww',
  q: '?',
  para: '¶',
  caret: '^',
  good: 'Good!',
  vague: 'Vague',
};

export const STAMP_KINDS = Object.keys(STAMP_LABELS) as EssayStampKind[];

export type EssayShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse' | 'wavy';

/** [x, y, pressure] */
export type InkPoint = [number, number, number];

export type EssayAnnotation =
  | { id: string; t: 'pen' | 'hl'; color: string; size: number; points: InkPoint[] }
  | { id: string; t: 'shape'; shape: EssayShapeKind; color: string; size: number; a: [number, number]; b: [number, number] }
  | { id: string; t: 'stamp'; kind: EssayStampKind; color: string; x: number; y: number; scale: number }
  | { id: string; t: 'text'; color: string; x: number; y: number; text: string; scale: number }
  | { id: string; t: 'comment'; color: string; x: number; y: number; text: string };

export const INK_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#111827', '#EA580C'] as const;
export const HIGHLIGHT_COLORS = ['#FDE047', '#86EFAC', '#F9A8D4', '#93C5FD'] as const;

// ─── Validation (server) ─────────────────────────────────────────────────────

const MAX_ITEMS = 4000;
const MAX_POINTS = 5000;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}
function coord(v: unknown): number | null {
  // A little slack outside the page so a stroke that runs off the edge survives.
  return num(v, -0.2, 1.2);
}
function str(v: unknown, maxLen: number): string | null {
  return typeof v === 'string' && v.length <= maxLen ? v : null;
}

/**
 * Validates untrusted annotation JSON. Returns null when anything is malformed
 * so the caller can reject the whole save (never silently drop markup).
 */
export function parseAnnotations(raw: unknown): EssayAnnotation[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS) return null;
  const out: EssayAnnotation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    const id = str(o.id, 64);
    const color = typeof o.color === 'string' && COLOR_RE.test(o.color) ? o.color : null;
    if (!id || !color) return null;
    switch (o.t) {
      case 'pen':
      case 'hl': {
        const size = num(o.size, 0.0005, 0.2);
        if (size === null || !Array.isArray(o.points) || o.points.length === 0 || o.points.length > MAX_POINTS) return null;
        const points: InkPoint[] = [];
        for (const p of o.points) {
          if (!Array.isArray(p)) return null;
          const x = coord(p[0]); const y = coord(p[1]); const pr = num(p[2] ?? 0.5, 0, 1);
          if (x === null || y === null || pr === null) return null;
          points.push([x, y, pr]);
        }
        out.push({ id, t: o.t, color, size, points });
        break;
      }
      case 'shape': {
        const size = num(o.size, 0.0005, 0.2);
        const shape = ['line', 'arrow', 'rect', 'ellipse', 'wavy'].includes(o.shape as string) ? (o.shape as EssayShapeKind) : null;
        const a = Array.isArray(o.a) ? [coord(o.a[0]), coord(o.a[1])] : [null, null];
        const b = Array.isArray(o.b) ? [coord(o.b[0]), coord(o.b[1])] : [null, null];
        if (size === null || !shape || a.includes(null) || b.includes(null)) return null;
        out.push({ id, t: 'shape', shape, color, size, a: a as [number, number], b: b as [number, number] });
        break;
      }
      case 'stamp': {
        const kind = (STAMP_KINDS as string[]).includes(o.kind as string) ? (o.kind as EssayStampKind) : null;
        const x = coord(o.x); const y = coord(o.y); const scale = num(o.scale, 0.2, 6);
        if (!kind || x === null || y === null || scale === null) return null;
        out.push({ id, t: 'stamp', kind, color, x, y, scale });
        break;
      }
      case 'text': {
        const x = coord(o.x); const y = coord(o.y); const scale = num(o.scale, 0.2, 6); const text = str(o.text, 2000);
        if (x === null || y === null || scale === null || text === null) return null;
        out.push({ id, t: 'text', color, x, y, text, scale });
        break;
      }
      case 'comment': {
        const x = coord(o.x); const y = coord(o.y); const text = str(o.text, 4000);
        if (x === null || y === null || text === null) return null;
        out.push({ id, t: 'comment', color, x, y, text });
        break;
      }
      default:
        return null;
    }
  }
  return out;
}

export function parseStoredAnnotations(json: string): EssayAnnotation[] {
  try {
    return parseAnnotations(JSON.parse(json)) ?? [];
  } catch {
    return [];
  }
}

// ─── Geometry helpers (client) ───────────────────────────────────────────────

/** Representative points of an item, in normalized page coordinates. */
export function annotationPoints(a: EssayAnnotation): [number, number][] {
  switch (a.t) {
    case 'pen':
    case 'hl':
      return a.points.map(p => [p[0], p[1]]);
    case 'shape':
      return [a.a, a.b, [(a.a[0] + a.b[0]) / 2, (a.a[1] + a.b[1]) / 2]];
    default:
      return [[a.x, a.y]];
  }
}

export function translateAnnotation(a: EssayAnnotation, dx: number, dy: number): EssayAnnotation {
  switch (a.t) {
    case 'pen':
    case 'hl':
      return { ...a, points: a.points.map(p => [p[0] + dx, p[1] + dy, p[2]] as InkPoint) };
    case 'shape':
      return { ...a, a: [a.a[0] + dx, a.a[1] + dy], b: [a.b[0] + dx, a.b[1] + dy] };
    default:
      return { ...a, x: a.x + dx, y: a.y + dy };
  }
}

/** Scales an item about (cx, cy). */
export function scaleAnnotation(a: EssayAnnotation, f: number, cx: number, cy: number): EssayAnnotation {
  const s = (x: number, y: number): [number, number] => [cx + (x - cx) * f, cy + (y - cy) * f];
  switch (a.t) {
    case 'pen':
    case 'hl':
      return { ...a, size: Math.min(0.2, a.size * f), points: a.points.map(p => { const [x, y] = s(p[0], p[1]); return [x, y, p[2]] as InkPoint; }) };
    case 'shape':
      return { ...a, size: Math.min(0.2, a.size * f), a: s(a.a[0], a.a[1]), b: s(a.b[0], a.b[1]) };
    case 'comment': {
      const [x, y] = s(a.x, a.y);
      return { ...a, x, y };
    }
    default: {
      const [x, y] = s(a.x, a.y);
      return { ...a, x, y, scale: Math.max(0.2, Math.min(6, a.scale * f)) };
    }
  }
}

export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from a point to an item, in normalized units (width-relative x, height-relative y). */
export function hitsAnnotation(a: EssayAnnotation, x: number, y: number, radius: number, aspect: number): boolean {
  // aspect = height / width, so y distances are compared in width units
  const d = (px: number, py: number) => Math.hypot(px - x, (py - y) * aspect);
  switch (a.t) {
    case 'pen':
    case 'hl':
      return a.points.some(p => d(p[0], p[1]) <= radius + a.size / 2);
    case 'shape': {
      const steps = 24;
      if (a.shape === 'rect' || a.shape === 'ellipse') {
        return outlinePoints(a, steps).some(([px, py]) => d(px, py) <= radius + a.size);
      }
      for (let i = 0; i <= steps; i++) {
        const tt = i / steps;
        const px = a.a[0] + (a.b[0] - a.a[0]) * tt;
        const py = a.a[1] + (a.b[1] - a.a[1]) * tt;
        if (d(px, py) <= radius + a.size) return true;
      }
      return false;
    }
    case 'stamp':
      return d(a.x, a.y) <= radius + 0.025 * a.scale;
    case 'text':
      return d(a.x, a.y) <= radius + 0.03 * a.scale;
    case 'comment':
      return d(a.x, a.y) <= radius + 0.02;
  }
}

function outlinePoints(a: Extract<EssayAnnotation, { t: 'shape' }>, steps: number): [number, number][] {
  const [x1, y1] = a.a;
  const [x2, y2] = a.b;
  if (a.shape === 'rect') {
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [(x1 + x2) / 2, y1], [(x1 + x2) / 2, y2], [x1, (y1 + y2) / 2], [x2, (y1 + y2) / 2]];
  }
  const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2; const rx = Math.abs(x2 - x1) / 2; const ry = Math.abs(y2 - y1) / 2;
  return Array.from({ length: steps }, (_, i) => {
    const th = (i / steps) * Math.PI * 2;
    return [cx + rx * Math.cos(th), cy + ry * Math.sin(th)] as [number, number];
  });
}

/**
 * Partial eraser: removes the points of pen/highlighter strokes that fall
 * inside the eraser circle, splitting a stroke into pieces where needed.
 * Other item types are left untouched (the stroke eraser removes those).
 */
export function erasePartial(items: EssayAnnotation[], x: number, y: number, radius: number, aspect: number, newId: () => string): EssayAnnotation[] {
  const out: EssayAnnotation[] = [];
  for (const a of items) {
    if (a.t !== 'pen' && a.t !== 'hl') { out.push(a); continue; }
    const pieces: InkPoint[][] = [[]];
    let touched = false;
    for (const p of a.points) {
      if (Math.hypot(p[0] - x, (p[1] - y) * aspect) <= radius) {
        touched = true;
        if (pieces[pieces.length - 1].length) pieces.push([]);
      } else {
        pieces[pieces.length - 1].push(p);
      }
    }
    if (!touched) { out.push(a); continue; }
    pieces.filter(pc => pc.length > 1).forEach((pc, i) => out.push({ ...a, id: i === 0 ? a.id : newId(), points: pc }));
  }
  return out;
}

// ─── Rendering (client) ──────────────────────────────────────────────────────

/**
 * Draws annotations onto a 2D context whose drawing area is `w`×`h` pixels
 * (the page). Comments render as numbered pins; their text is shown by the
 * caller (a popover in the viewers, a feedback page in the PDF export).
 */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  items: EssayAnnotation[],
  w: number,
  h: number,
  opts: { selectedIds?: Set<string> } = {},
): void {
  let commentNo = 0;
  for (const a of items) {
    const selected = opts.selectedIds?.has(a.id) ?? false;
    ctx.save();
    switch (a.t) {
      case 'pen':
      case 'hl': {
        const outline = getStroke(a.points.map(p => [p[0] * w, p[1] * h, p[2]]), {
          size: a.size * w,
          thinning: a.t === 'pen' ? 0.55 : 0,
          smoothing: 0.5,
          streamline: 0.45,
          simulatePressure: a.points.every(p => p[2] === 0.5),
          last: true,
        });
        if (a.t === 'hl') {
          ctx.globalAlpha = 0.35;
          ctx.globalCompositeOperation = 'multiply';
        }
        ctx.fillStyle = a.color;
        fillOutline(ctx, outline);
        break;
      }
      case 'shape':
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1, a.size * w);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawShape(ctx, a, w, h);
        break;
      case 'stamp': {
        const label = STAMP_LABELS[a.kind];
        const fontPx = 0.035 * w * a.scale;
        ctx.fillStyle = a.color;
        ctx.font = `700 ${fontPx}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, a.x * w, a.y * h);
        break;
      }
      case 'text': {
        const fontPx = 0.028 * w * a.scale;
        ctx.fillStyle = a.color;
        ctx.font = `600 ${fontPx}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
        ctx.textBaseline = 'top';
        a.text.split('\n').forEach((line, i) => ctx.fillText(line, a.x * w, a.y * h + i * fontPx * 1.25));
        break;
      }
      case 'comment': {
        commentNo += 1;
        const r = Math.max(10, 0.018 * w);
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(a.x * w, a.y * h, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, r * 0.15);
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 ${r * 1.1}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(commentNo), a.x * w, a.y * h + r * 0.05);
        break;
      }
    }
    ctx.restore();
    if (selected) drawSelectionBox(ctx, a, w, h);
  }
}

function fillOutline(ctx: CanvasRenderingContext2D, pts: number[][]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, a: Extract<EssayAnnotation, { t: 'shape' }>, w: number, h: number) {
  const x1 = a.a[0] * w; const y1 = a.a[1] * h; const x2 = a.b[0] * w; const y2 = a.b[1] * h;
  ctx.beginPath();
  switch (a.shape) {
    case 'line':
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      break;
    case 'arrow': {
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(10, ctx.lineWidth * 4);
      ctx.moveTo(x2, y2); ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
      ctx.moveTo(x2, y2); ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
      break;
    }
    case 'rect':
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      break;
    case 'ellipse':
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      break;
    case 'wavy': {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const amp = Math.max(3, ctx.lineWidth * 2);
      const wave = Math.max(8, amp * 3);
      ctx.moveTo(x1, y1);
      for (let d = 0; d <= len; d += 2) {
        const off = Math.sin((d / wave) * Math.PI * 2) * amp;
        ctx.lineTo(x1 + d * Math.cos(ang) - off * Math.sin(ang), y1 + d * Math.sin(ang) + off * Math.cos(ang));
      }
      break;
    }
  }
  ctx.stroke();
}

export function annotationBounds(a: EssayAnnotation): { x1: number; y1: number; x2: number; y2: number } {
  const pts = annotationPoints(a);
  const pad = a.t === 'pen' || a.t === 'hl' || a.t === 'shape' ? a.size : 0.02;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
  if (a.t === 'shape') { x1 = Math.min(a.a[0], a.b[0]); x2 = Math.max(a.a[0], a.b[0]); y1 = Math.min(a.a[1], a.b[1]); y2 = Math.max(a.a[1], a.b[1]); }
  return { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad };
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, a: EssayAnnotation, w: number, h: number) {
  const b = annotationBounds(a);
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#7C3AED';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b.x1 * w, b.y1 * h, (b.x2 - b.x1) * w, (b.y2 - b.y1) * h);
  ctx.restore();
}

/** Comments in render order, numbered like their pins. */
export function numberedComments(items: EssayAnnotation[]): { n: number; id: string; text: string; x: number; y: number; color: string }[] {
  let n = 0;
  return items.flatMap(a => (a.t === 'comment' ? [{ n: ++n, id: a.id, text: a.text, x: a.x, y: a.y, color: a.color }] : []));
}
