'use client';

/**
 * EssayUploader — builds one essay's pages and submits them.
 *
 * Sources (mix freely): camera one page at a time, several gallery images at
 * once, or a ready-made PDF (split into pages on the device). Before
 * submitting the student reviews thumbnails and can reorder (drag, or the
 * arrows on touch screens), rotate, crop (auto paper-edge guess + manual
 * handles), toggle enhance, retake, delete, and preview full-screen.
 *
 * Submission is final, so it goes through a confirmation step.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, ChevronLeft, ChevronRight, Crop, FileText, ImagePlus, Loader2, RefreshCw, RotateCw, Sparkles, Trash2, X,
} from 'lucide-react';
import {
  FULL_CROP, createPageSource, decodeImageFile, detectPaper, finalJpeg, makePreview, pdfToCanvases, renderForCrop,
  type CropRect, type PageSource,
} from '@/lib/essays/image-prep';

interface Props {
  seriesId: number;
  essayIndex: number;
  essayLabel: string; // 'Essay 1' or the series title for single-essay series
  resubmission: boolean;
  onSubmitted: () => void;
}

type Busy = null | { label: string; pct?: number };

const MAX_PAGES = 30;

async function putToR2(url: string, blob: Blob, onProgress: (pct: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) onProgress(e.loaded / e.total); });
    xhr.addEventListener('load', () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))));
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    xhr.send(blob);
  });
}

export default function EssayUploader({ seriesId, essayIndex, essayLabel, resubmission, onSubmitted }: Props) {
  const [pages, setPages] = useState<PageSource[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [cropping, setCropping] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const retakeId = useRef<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // Free preview object URLs on unmount.
  useEffect(() => () => { pagesRef.current.forEach(p => URL.revokeObjectURL(p.previewUrl)); }, []);

  const addSources = useCallback(async (makers: (() => Promise<PageSource>)[], replaceId?: string | null) => {
    setError(null);
    const room = MAX_PAGES - pagesRef.current.length + (replaceId ? 1 : 0);
    if (makers.length > room) setError(`An essay can have at most ${MAX_PAGES} pages — only the first ${room} were added.`);
    const list = makers.slice(0, Math.max(0, room));
    const made: PageSource[] = [];
    for (let i = 0; i < list.length; i++) {
      setBusy({ label: list.length > 1 ? `Preparing page ${i + 1} of ${list.length}…` : 'Preparing page…' });
      try {
        made.push(await list[i]());
      } catch {
        setError('One of the files could not be read. Try taking the photo again, or use JPG/PNG.');
      }
    }
    setBusy(null);
    if (made.length === 0) return;
    setPages(prev => {
      if (replaceId) {
        const at = prev.findIndex(p => p.id === replaceId);
        if (at >= 0) {
          URL.revokeObjectURL(prev[at].previewUrl);
          const next = [...prev];
          next.splice(at, 1, ...made);
          return next;
        }
      }
      return [...prev, ...made];
    });
  }, []);

  const onImages = (files: FileList | null, fromCamera: boolean) => {
    if (!files || files.length === 0) return;
    const replace = retakeId.current;
    retakeId.current = null;
    void addSources(
      Array.from(files).map(f => async () => createPageSource(await decodeImageFile(f), { autoCrop: true, enhance: true })),
      replace,
    ).then(() => { if (fromCamera && !replace) setJustAdded(true); });
  };

  const onPdf = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    setBusy({ label: 'Reading PDF…' });
    try {
      const canvases = await pdfToCanvases(f, (d, t) => setBusy({ label: `Reading PDF page ${d} of ${t}…` }));
      await addSources(canvases.map(c => () => createPageSource(c, { autoCrop: false, enhance: false })));
    } catch {
      setBusy(null);
      setError('That PDF could not be opened. Is it password-protected or damaged?');
    }
  };

  const update = async (i: number, patch: Partial<Pick<PageSource, 'rotation' | 'crop' | 'enhance'>>) => {
    const p = pages[i];
    const next = { ...p, ...patch };
    setBusy({ label: 'Updating…' });
    try {
      const url = await makePreview(next);
      URL.revokeObjectURL(p.previewUrl);
      setPages(prev => prev.map(x => (x.id === p.id ? { ...next, previewUrl: url } : x)));
    } finally {
      setBusy(null);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= pages.length || from === to) return;
    setPages(prev => {
      const next = [...prev];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };

  const remove = (i: number) => {
    URL.revokeObjectURL(pages[i].previewUrl);
    setPages(prev => prev.filter((_, j) => j !== i));
  };

  const submit = async () => {
    setConfirming(false);
    setError(null);
    try {
      const uploaded: { key: string; width: number; height: number }[] = [];
      for (let i = 0; i < pages.length; i++) {
        setBusy({ label: `Uploading page ${i + 1} of ${pages.length}…`, pct: (i / pages.length) * 100 });
        const { blob, width, height } = await finalJpeg(pages[i]);
        const presign = await fetch(`/api/essays/${seriesId}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ essayIndex, contentType: 'image/jpeg' }),
        });
        const pj = await presign.json().catch(() => ({}));
        if (!presign.ok) throw new Error(pj.error ?? 'Could not start the upload');
        await putToR2(pj.uploadUrl, blob, f => setBusy({ label: `Uploading page ${i + 1} of ${pages.length}…`, pct: ((i + f) / pages.length) * 100 }));
        uploaded.push({ key: pj.key, width, height });
      }
      setBusy({ label: 'Submitting…', pct: 100 });
      const res = await fetch(`/api/essays/${seriesId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essayIndex, pages: uploaded }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Submission failed');
      pages.forEach(p => URL.revokeObjectURL(p.previewUrl));
      setPages([]);
      setBusy(null);
      onSubmitted();
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'Submission failed — your pages are still here, try again.');
    }
  };

  const sourceBtn = 'flex-1 min-w-[140px] flex flex-col items-center gap-2 rounded-xl border border-exam-border bg-exam-elevated px-4 py-5 text-sm font-semibold text-exam-ink hover:border-exam-gold/60 transition-colors disabled:opacity-50';
  const iconBtn = 'h-8 w-8 inline-flex items-center justify-center rounded-md bg-black/55 text-white hover:bg-black/75 disabled:opacity-30';

  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { onImages(e.target.files, true); e.target.value = ''; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { onImages(e.target.files, false); e.target.value = ''; }} />
      <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={e => { void onPdf(e.target.files); e.target.value = ''; }} />

      <div className="flex flex-wrap gap-3">
        <button className={sourceBtn} disabled={!!busy} onClick={() => { retakeId.current = null; cameraRef.current?.click(); }}>
          <Camera className="w-6 h-6 text-exam-gold" /> Take photo
          <span className="text-xs font-normal text-exam-ink-faint">one page at a time</span>
        </button>
        <button className={sourceBtn} disabled={!!busy} onClick={() => { retakeId.current = null; galleryRef.current?.click(); }}>
          <ImagePlus className="w-6 h-6 text-exam-gold" /> Choose images
          <span className="text-xs font-normal text-exam-ink-faint">select several at once</span>
        </button>
        <button className={sourceBtn} disabled={!!busy} onClick={() => pdfRef.current?.click()}>
          <FileText className="w-6 h-6 text-exam-gold" /> Upload PDF
          <span className="text-xs font-normal text-exam-ink-faint">already scanned</span>
        </button>
      </div>

      {justAdded && !busy && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-exam-gold/40 bg-exam-gold/10 px-4 py-3">
          <span className="text-sm text-exam-ink">Page {pages.length} added.</span>
          <div className="flex gap-2">
            <button className="rounded-lg bg-exam-gold px-3 py-2 text-sm font-bold text-exam-base" onClick={() => { setJustAdded(false); cameraRef.current?.click(); }}>
              Add next page
            </button>
            <button className="rounded-lg px-3 py-2 text-sm text-exam-ink-muted" onClick={() => setJustAdded(false)}>Done</button>
          </div>
        </div>
      )}

      {busy && (
        <div className="mt-4 rounded-xl border border-exam-border bg-exam-elevated p-4">
          <div className="flex items-center gap-2 text-sm text-exam-ink"><Loader2 className="w-4 h-4 animate-spin" /> {busy.label}</div>
          {busy.pct !== undefined && (
            <div className="mt-3 h-2 rounded-full bg-exam-border overflow-hidden">
              <div className="h-full bg-exam-gold transition-[width]" style={{ width: `${busy.pct}%` }} />
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-exam-danger">{error}</p>}

      {pages.length > 0 && (
        <>
          <p className="mt-6 mb-3 text-xs text-exam-ink-faint">
            Check every page is sharp and in order. Drag to reorder (or use the arrows). Tap a page to see it full-size.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pages.map((p, i) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); }}
                className={`relative rounded-lg overflow-hidden border bg-white ${dragFrom === i ? 'border-exam-gold opacity-60' : 'border-exam-border'}`}
              >
                <button className="block w-full" onClick={() => setPreview(i)} aria-label={`Preview page ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt={`Page ${i + 1}`} className="w-full aspect-[3/4] object-contain bg-neutral-200" />
                </button>
                <span className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-white">{i + 1}</span>
                {p.enhance && <span className="absolute top-1.5 right-1.5 rounded-md bg-exam-gold/90 p-1 text-exam-base" title="Enhanced"><Sparkles className="w-3 h-3" /></span>}
                <div className="absolute bottom-0 inset-x-0 flex flex-wrap justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-5">
                  <button className={iconBtn} onClick={() => move(i, i - 1)} disabled={i === 0 || !!busy} aria-label="Move earlier"><ChevronLeft className="w-4 h-4" /></button>
                  <button className={iconBtn} onClick={() => update(i, { rotation: ((p.rotation + 90) % 360) as PageSource['rotation'], crop: FULL_CROP })} disabled={!!busy} aria-label="Rotate"><RotateCw className="w-4 h-4" /></button>
                  <button className={iconBtn} onClick={() => setCropping(i)} disabled={!!busy} aria-label="Crop"><Crop className="w-4 h-4" /></button>
                  <button className={iconBtn} onClick={() => update(i, { enhance: !p.enhance })} disabled={!!busy} aria-label={p.enhance ? 'Turn off enhance' : 'Enhance'}><Sparkles className="w-4 h-4" /></button>
                  <button className={iconBtn} onClick={() => { retakeId.current = p.id; cameraRef.current?.click(); }} disabled={!!busy} aria-label="Retake"><RefreshCw className="w-4 h-4" /></button>
                  <button className={iconBtn} onClick={() => remove(i)} disabled={!!busy} aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                  <button className={iconBtn} onClick={() => move(i, i + 1)} disabled={i === pages.length - 1 || !!busy} aria-label="Move later"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>

          <button
            className="mt-6 w-full rounded-xl bg-exam-maroon py-4 text-base font-bold text-white hover:bg-exam-maroon-bright disabled:opacity-50"
            disabled={!!busy}
            onClick={() => setConfirming(true)}
          >
            {resubmission ? 'Resubmit' : 'Submit'} {essayLabel} · {pages.length} page{pages.length === 1 ? '' : 's'}
          </button>
        </>
      )}

      {preview !== null && pages[preview] && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-between p-3 text-white" onClick={e => e.stopPropagation()}>
            <span className="text-sm">Page {preview + 1} of {pages.length}</span>
            <div className="flex gap-2">
              <button className={iconBtn} onClick={() => setPreview(Math.max(0, preview - 1))} disabled={preview === 0}><ChevronLeft className="w-4 h-4" /></button>
              <button className={iconBtn} onClick={() => setPreview(Math.min(pages.length - 1, preview + 1))} disabled={preview === pages.length - 1}><ChevronRight className="w-4 h-4" /></button>
              <button className={iconBtn} onClick={() => setPreview(null)} aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <FullPreview page={pages[preview]} />
        </div>
      )}

      {cropping !== null && pages[cropping] && (
        <CropEditor
          page={pages[cropping]}
          onCancel={() => setCropping(null)}
          onDone={crop => { const i = cropping; setCropping(null); void update(i, { crop }); }}
        />
      )}

      {confirming && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setConfirming(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-exam-border bg-exam-surface p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-exam-ink mb-2">Submit {essayLabel}?</h3>
            <p className="text-sm text-exam-ink-muted mb-5">
              {pages.length} page{pages.length === 1 ? '' : 's'}. <strong className="text-exam-ink">Submissions are final</strong> — you can&apos;t change or add pages afterwards.
            </p>
            <div className="flex gap-3">
              <button className="flex-1 rounded-lg border border-exam-border py-3 text-sm text-exam-ink" onClick={() => setConfirming(false)}>Go back</button>
              <button className="flex-1 rounded-lg bg-exam-maroon py-3 text-sm font-bold text-white" onClick={submit}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FullPreview({ page }: { page: PageSource }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    // Higher-resolution render than the thumbnail so the student can check sharpness.
    import('@/lib/essays/image-prep').then(async m => {
      const c = await m.renderPage(page, 1800);
      const blob = await m.canvasToJpeg(c, 0.9);
      made = URL.createObjectURL(blob);
      if (alive) setUrl(made); else URL.revokeObjectURL(made);
    });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [page]);
  return (
    <div className="flex-1 overflow-auto flex items-start justify-center p-3" onClick={e => e.stopPropagation()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url ?? page.previewUrl} alt="" className="max-w-full h-auto" />
    </div>
  );
}

function CropEditor({ page, onCancel, onDone }: { page: PageSource; onCancel: () => void; onDone: (c: CropRect) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>(page.crop);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<null | { corner: 'tl' | 'tr' | 'bl' | 'br' | 'move'; sx: number; sy: number; start: CropRect }>(null);

  useEffect(() => {
    let made: string | null = null;
    let alive = true;
    renderForCrop(page).then(u => { made = u; if (alive) setUrl(u); else URL.revokeObjectURL(u); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [page]);

  const onDown = (corner: 'tl' | 'tr' | 'bl' | 'br' | 'move') => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { corner, sx: e.clientX, sy: e.clientY, start: crop };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.sx) / box.width;
    const dy = (e.clientY - d.sy) / box.height;
    const s = d.start;
    const MIN = 0.1;
    let { x, y, w, h } = s;
    if (d.corner === 'move') {
      x = Math.min(1 - w, Math.max(0, s.x + dx));
      y = Math.min(1 - h, Math.max(0, s.y + dy));
    } else {
      if (d.corner === 'tl' || d.corner === 'bl') { x = Math.min(s.x + s.w - MIN, Math.max(0, s.x + dx)); w = s.x + s.w - x; }
      if (d.corner === 'tr' || d.corner === 'br') { w = Math.min(1 - s.x, Math.max(MIN, s.w + dx)); }
      if (d.corner === 'tl' || d.corner === 'tr') { y = Math.min(s.y + s.h - MIN, Math.max(0, s.y + dy)); h = s.y + s.h - y; }
      if (d.corner === 'bl' || d.corner === 'br') { h = Math.min(1 - s.y, Math.max(MIN, s.h + dy)); }
    }
    setCrop({ x, y, w, h });
  };
  const handle = 'absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-exam-gold touch-none';

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      <div className="flex items-center justify-between gap-2 p-3 text-white">
        <span className="text-sm">Drag the corners to the paper&apos;s edges</span>
        <div className="flex gap-2">
          <button className="rounded-lg border border-white/30 px-3 py-1.5 text-sm" onClick={async () => setCrop(await detectPaper(page))}>Auto</button>
          <button className="rounded-lg border border-white/30 px-3 py-1.5 text-sm" onClick={() => setCrop(FULL_CROP)}>Reset</button>
          <button className="rounded-lg border border-white/30 px-3 py-1.5 text-sm" onClick={onCancel}>Cancel</button>
          <button className="rounded-lg bg-exam-gold px-3 py-1.5 text-sm font-bold text-exam-base" onClick={() => onDone(crop)}>Done</button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        {!url ? (
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        ) : (
          <div ref={boxRef} className="relative inline-block select-none" onPointerMove={onMove} onPointerUp={() => { drag.current = null; }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="block max-h-[78vh] max-w-full" draggable={false} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.55)', clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${crop.x * 100}% ${crop.y * 100}%,${crop.x * 100}% ${(crop.y + crop.h) * 100}%,${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%,${(crop.x + crop.w) * 100}% ${crop.y * 100}%,${crop.x * 100}% ${crop.y * 100}%)` }} />
            <div
              className="absolute border-2 border-exam-gold touch-none cursor-move"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              onPointerDown={onDown('move')}
            >
              <span className={handle} style={{ left: 0, top: 0 }} onPointerDown={onDown('tl')} />
              <span className={handle} style={{ left: '100%', top: 0 }} onPointerDown={onDown('tr')} />
              <span className={handle} style={{ left: 0, top: '100%' }} onPointerDown={onDown('bl')} />
              <span className={handle} style={{ left: '100%', top: '100%' }} onPointerDown={onDown('br')} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
