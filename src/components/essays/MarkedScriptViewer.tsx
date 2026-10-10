'use client';

/**
 * Read-only, page-by-page viewer for a marked script: the page photo with the
 * grader's pen work, stamps and numbered comment pins drawn on top. Tapping a
 * pin (or a comment in the list) highlights it. Used by the student results
 * page and the staff "reference script" panel.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { drawAnnotations, numberedComments } from '@/lib/essays/annotations';
import { displaySize, drawRotatedImage, loadImage } from '@/lib/essays/render-client';
import type { EssayPageDTO } from '@/lib/essays/types';

interface Props {
  pages: EssayPageDTO[];
  /** 'dark' for student pages (exam theme), 'light' for admin panels. */
  tone?: 'dark' | 'light';
}

export default function MarkedScriptViewer({ pages, tone = 'dark' }: Props) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [width, setWidth] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)];
  const comments = useMemo(() => (page ? numberedComments(page.annotations) : []), [page]);

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    setImg(null);
    loadImage(page.imageUrl).then(i => { if (!cancelled) setImg(i); }).catch(() => {});
    return () => { cancelled = true; };
  }, [page]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img || !page || !width) return;
    const { w, h } = displaySize({ width: img.naturalWidth, height: img.naturalHeight, rotation: page.rotation });
    const cssW = width * zoom;
    const cssH = (cssW * h) / w;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cssW, cssH);
    drawRotatedImage(ctx, img, page.rotation, cssW, cssH);
    drawAnnotations(ctx, page.annotations, cssW, cssH);
    if (activeComment) {
      const cm = comments.find(x => x.id === activeComment);
      if (cm) {
        ctx.strokeStyle = '#7C3AED';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cm.x * cssW, cm.y * cssH, Math.max(16, 0.03 * cssW), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [img, page, width, zoom, activeComment, comments]);

  if (!page) return null;

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const hit = comments.find(cm => Math.hypot(cm.x - x, (cm.y - y) * (r.height / r.width)) < 0.035);
    setActiveComment(hit ? hit.id : null);
  };

  const dark = tone === 'dark';
  const muted = dark ? 'text-exam-ink-muted' : 'text-gray-500';
  const btn = dark
    ? 'h-9 w-9 inline-flex items-center justify-center rounded-lg border border-exam-border bg-exam-elevated text-exam-ink disabled:opacity-40'
    : 'h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-40';

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => { setIndex(i => Math.max(0, i - 1)); setActiveComment(null); }} disabled={index === 0} aria-label="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={`text-sm tabular-nums ${muted}`}>Page {index + 1} of {pages.length}</span>
          <button className={btn} onClick={() => { setIndex(i => Math.min(pages.length - 1, i + 1)); setActiveComment(null); }} disabled={index >= pages.length - 1} aria-label="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => setZoom(z => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label="Zoom out"><Minus className="w-4 h-4" /></button>
          <span className={`text-xs tabular-nums w-10 text-center ${muted}`}>{Math.round(zoom * 100)}%</span>
          <button className={btn} onClick={() => setZoom(z => Math.min(3, z + 0.5))} disabled={zoom >= 3} aria-label="Zoom in"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      <div ref={wrapRef} className={`overflow-auto rounded-lg ${dark ? 'border border-exam-border' : 'border border-gray-200'}`} style={{ maxHeight: '80vh' }}>
        {!img && <div className={`aspect-[3/4] flex items-center justify-center text-sm ${muted}`}>Loading page…</div>}
        <canvas ref={canvasRef} onClick={onCanvasClick} className={img ? 'block cursor-pointer' : 'hidden'} />
      </div>

      {pages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => { setIndex(i); setActiveComment(null); }}
              className={`relative flex-shrink-0 w-14 h-20 rounded border overflow-hidden ${i === index ? (dark ? 'border-exam-gold ring-2 ring-exam-gold/40' : 'border-violet-500 ring-2 ring-violet-200') : dark ? 'border-exam-border' : 'border-gray-200'}`}
              aria-label={`Page ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt="" className="w-full h-full object-cover" style={{ transform: `rotate(${p.rotation}deg)` }} />
              <span className="absolute bottom-0 inset-x-0 text-[10px] bg-black/60 text-white">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {comments.length > 0 && (
        <ol className="mt-4 space-y-2">
          {comments.map(cm => (
            <li key={cm.id}>
              <button
                onClick={() => setActiveComment(cm.id === activeComment ? null : cm.id)}
                className={`w-full text-left flex gap-3 rounded-lg p-3 text-sm ${dark ? 'bg-exam-elevated' : 'bg-gray-50'} ${cm.id === activeComment ? 'ring-2 ring-violet-500' : ''}`}
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: cm.color }}>{cm.n}</span>
                <span className={dark ? 'text-exam-ink' : 'text-gray-800'} style={{ whiteSpace: 'pre-wrap' }}>{cm.text}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
