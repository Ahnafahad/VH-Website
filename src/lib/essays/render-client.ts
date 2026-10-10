'use client';

/**
 * Client rendering of marked essay pages: page image (+ display rotation)
 * with annotations burned in, and the "marked script" PDF export used by
 * both the student download and the staff "download all" bundle.
 *
 * The feedback page is drawn on a canvas too (rather than with PDF text
 * operators) so any script — Bangla included — renders with the browser's fonts.
 */

import { drawAnnotations, numberedComments, type EssayAnnotation } from './annotations';
import type { EssayPageDTO, EssaySection } from './types';

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load page image'));
    img.src = url;
  });
}

/** Displayed (post-rotation) size of a page. */
export function displaySize(p: Pick<EssayPageDTO, 'width' | 'height' | 'rotation'>): { w: number; h: number } {
  return p.rotation === 90 || p.rotation === 270 ? { w: p.height, h: p.width } : { w: p.width, h: p.height };
}

/** Draws an image rotated by `rotation` to fill a w×h area. */
export function drawRotatedImage(ctx: CanvasRenderingContext2D, img: CanvasImageSource, rotation: number, w: number, h: number) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  const swap = rotation === 90 || rotation === 270;
  const iw = swap ? h : w;
  const ih = swap ? w : h;
  ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
}

export async function renderMarkedPage(page: EssayPageDTO, maxEdge = 2000): Promise<HTMLCanvasElement> {
  const img = await loadImage(page.imageUrl);
  const { w, h } = displaySize({ width: img.naturalWidth, height: img.naturalHeight, rotation: page.rotation });
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, c.width, c.height);
  drawRotatedImage(ctx, img, page.rotation, c.width, c.height);
  drawAnnotations(ctx, page.annotations, c.width, c.height);
  return c;
}

export interface MarkedScript {
  title: string; // e.g. 'Essay Series 3 — Essay 1'
  studentName: string;
  sections: EssaySection[];
  marks: Record<string, number | null>;
  sectionComments: Record<string, string>;
  total: number | null;
  totalMarks: number;
  overallFeedback: string;
  gradedBy: string | null;
  pages: EssayPageDTO[];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** A4-proportioned canvas pages listing marks, feedback and numbered comments. */
function renderFeedbackPages(s: MarkedScript): HTMLCanvasElement[] {
  const W = 1240, H = 1754, M = 90;
  const pages: HTMLCanvasElement[] = [];
  let c: HTMLCanvasElement, ctx: CanvasRenderingContext2D, y = 0;
  const newPage = () => {
    c = document.createElement('canvas');
    c.width = W; c.height = H;
    ctx = c.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111827';
    ctx.textBaseline = 'top';
    pages.push(c);
    y = M;
  };
  const write = (text: string, font: string, color = '#111827', gap = 10, indent = 0) => {
    ctx.font = font;
    ctx.fillStyle = color;
    const size = parseInt(font.match(/(\d+)px/)?.[1] ?? '24', 10);
    for (const line of wrap(ctx, text, W - 2 * M - indent)) {
      if (y + size * 1.35 > H - M) newPage();
      ctx.font = font; ctx.fillStyle = color;
      ctx.fillText(line, M + indent, y);
      y += size * 1.35;
    }
    y += gap;
  };
  newPage();
  write(s.title, '700 44px Georgia, serif', '#1A0507', 6);
  write([s.studentName, s.gradedBy ? `marked by ${s.gradedBy}` : ''].filter(Boolean).join(' · '), '400 24px system-ui, sans-serif', '#6B7280', 28);
  write(`Total: ${s.total ?? '—'} / ${s.totalMarks}`, '700 34px system-ui, sans-serif', '#760F13', 20);
  for (const sec of s.sections) {
    write(`${sec.name}: ${s.marks[sec.key] ?? '—'} / ${sec.max}`, '600 26px system-ui, sans-serif', '#111827', 4);
    if (s.sectionComments[sec.key]) write(s.sectionComments[sec.key], '400 24px system-ui, sans-serif', '#374151', 8, 24);
  }
  y += 16;
  if (s.overallFeedback.trim()) {
    write('Overall feedback', '700 28px system-ui, sans-serif', '#1A0507', 6);
    write(s.overallFeedback, '400 24px system-ui, sans-serif', '#374151', 24);
  }
  const anyComments = s.pages.some(p => p.annotations.some((a: EssayAnnotation) => a.t === 'comment'));
  if (anyComments) {
    write('Comments on the pages', '700 28px system-ui, sans-serif', '#1A0507', 6);
    s.pages.forEach((p, i) => {
      for (const cm of numberedComments(p.annotations)) {
        write(`Page ${i + 1}, #${cm.n}: ${cm.text}`, '400 24px system-ui, sans-serif', '#374151', 6);
      }
    });
  }
  return pages;
}

async function canvasBytes(c: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.88));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Builds one PDF: for each script, its feedback page(s) then its marked pages. */
export async function buildMarkedPdf(scripts: MarkedScript[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const total = scripts.reduce((n, s) => n + s.pages.length, 0);
  let done = 0;
  for (const s of scripts) {
    const canvases = [...renderFeedbackPages(s)];
    for (const p of s.pages) {
      canvases.push(await renderMarkedPage(p));
      onProgress?.(++done, total);
    }
    for (const c of canvases) {
      const img = await pdf.embedJpg(await canvasBytes(c));
      // 72dpi points; scale so the long edge is A4's 842pt.
      const k = 842 / Math.max(c.width, c.height);
      const page = pdf.addPage([c.width * k, c.height * k]);
      page.drawImage(img, { x: 0, y: 0, width: c.width * k, height: c.height * k });
    }
  }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
