'use client';

/**
 * MockEssayUploader — the mock's "essay screen". One scan (a PDF with every essay) or loose photos go in
 * together; each page is then assigned to the essay it belongs to (a PDF is split evenly to start with,
 * so a 4-page PDF for 2 essays lands 2 + 2 and only needs a glance). Each essay is submitted through the
 * normal essays endpoints, one essay at a time, so marking works exactly as for any essay series.
 * Submission is final per essay.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, FileText, ImagePlus, Loader2, RotateCw, Trash2 } from 'lucide-react';
import {
  FULL_CROP, createPageSource, decodeImageFile, finalJpeg, makePreview, pdfToCanvases, type PageSource,
} from '@/lib/essays/image-prep';

export interface UploadTarget { essayIndex: number; label: string }

interface Props {
  seriesId: number;
  /** Essays that can still be submitted (open or sent back). */
  targets: UploadTarget[];
  onSubmitted: () => void;
}

type Page = PageSource & { essay: number | null };
type Busy = null | { label: string; pct?: number };

const MAX_PAGES_PER_ESSAY = 30;

async function putToR2(url: string, blob: Blob) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export default function MockEssayUploader({ seriesId, targets, onSubmitted }: Props) {
  const [pages, setPages] = useState<Page[]>([]);
  const [photoTo, setPhotoTo] = useState<number>(targets[0]?.essayIndex ?? 1);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  useEffect(() => () => { pagesRef.current.forEach(p => URL.revokeObjectURL(p.previewUrl)); }, []);

  const count = (essay: number) => pages.filter(p => p.essay === essay).length;

  const addPages = useCallback((made: PageSource[], assign: (i: number, total: number) => number | null) => {
    setPages(prev => [...prev, ...made.map((m, i) => ({ ...m, essay: assign(i, made.length) }))]);
  }, []);

  const onImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files); // the input is cleared right after this call, which empties a live FileList
    const made: PageSource[] = [];
    for (let i = 0; i < list.length; i++) {
      setBusy({ label: list.length > 1 ? `Preparing page ${i + 1} of ${list.length}…` : 'Preparing page…' });
      try { made.push(await createPageSource(await decodeImageFile(list[i]), { autoCrop: true, enhance: true })); }
      catch { setError('One of the files could not be read. Try the photo again, or use JPG/PNG.'); }
    }
    setBusy(null);
    addPages(made, () => photoTo);
  };

  const onPdf = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    setBusy({ label: 'Reading PDF…' });
    try {
      const canvases = await pdfToCanvases(f, (d, t) => setBusy({ label: `Reading PDF page ${d} of ${t}…` }));
      const made: PageSource[] = [];
      for (const c of canvases) made.push(await createPageSource(c, { autoCrop: false, enhance: false }));
      // split evenly across the essays still open; the student corrects any page below
      const per = Math.max(1, Math.ceil(made.length / targets.length));
      addPages(made, i => targets[Math.min(targets.length - 1, Math.floor(i / per))].essayIndex);
    } catch {
      setError('That PDF could not be opened. Is it password-protected or damaged?');
    }
    setBusy(null);
  };

  const rotate = async (i: number) => {
    const p = pages[i];
    const next = { ...p, rotation: ((p.rotation + 90) % 360) as PageSource['rotation'], crop: FULL_CROP };
    setBusy({ label: 'Updating…' });
    try {
      const url = await makePreview(next);
      URL.revokeObjectURL(p.previewUrl);
      setPages(prev => prev.map(x => (x.id === p.id ? { ...next, previewUrl: url } : x)));
    } finally { setBusy(null); }
  };

  const remove = (i: number) => {
    URL.revokeObjectURL(pages[i].previewUrl);
    setPages(prev => prev.filter((_, j) => j !== i));
  };

  const assign = (i: number, essay: number | null) => setPages(prev => prev.map((p, j) => (j === i ? { ...p, essay } : p)));

  const ready = targets.filter(t => count(t.essayIndex) > 0);
  const tooMany = targets.find(t => count(t.essayIndex) > MAX_PAGES_PER_ESSAY);
  const unassigned = pages.filter(p => p.essay === null).length;

  const submit = async () => {
    setConfirming(false);
    setError(null);
    let done = 0;
    const total = pagesRef.current.filter(p => p.essay !== null).length;
    try {
      for (const t of ready) {
        const mine = pagesRef.current.filter(p => p.essay === t.essayIndex);
        const uploaded: { key: string; width: number; height: number }[] = [];
        for (const p of mine) {
          setBusy({ label: `Uploading ${t.label}, page ${uploaded.length + 1} of ${mine.length}…`, pct: (done / total) * 100 });
          const { blob, width, height } = await finalJpeg(p);
          const presign = await fetch(`/api/essays/${seriesId}/upload`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ essayIndex: t.essayIndex, contentType: 'image/jpeg' }),
          });
          const pj = await presign.json().catch(() => ({}));
          if (!presign.ok) throw new Error(pj.error ?? 'Could not start the upload');
          await putToR2(pj.uploadUrl, blob);
          uploaded.push({ key: pj.key, width, height });
          done++;
        }
        setBusy({ label: `Submitting ${t.label}…`, pct: (done / total) * 100 });
        const res = await fetch(`/api/essays/${seriesId}/submit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ essayIndex: t.essayIndex, pages: uploaded }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${t.label}: ${body.error ?? 'Submission failed'}`);
        // this essay is in for good: drop its pages so a retry never resends it
        mine.forEach(p => URL.revokeObjectURL(p.previewUrl));
        setPages(prev => prev.filter(p => p.essay !== t.essayIndex));
      }
      setBusy(null);
      onSubmitted();
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : 'Submission failed. Your pages are still here, try again.');
    }
  };

  const sourceBtn = 'flex-1 min-w-[140px] flex flex-col items-center gap-2 rounded-xl border border-exam-border bg-exam-elevated px-4 py-5 text-sm font-semibold text-exam-ink hover:border-exam-gold/60 transition-colors disabled:opacity-50';
  const iconBtn = 'h-8 w-8 inline-flex items-center justify-center rounded-md bg-black/55 text-white hover:bg-black/75 disabled:opacity-30';

  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void onImages(e.target.files); e.target.value = ''; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { void onImages(e.target.files); e.target.value = ''; }} />
      <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={e => { void onPdf(e.target.files); e.target.value = ''; }} />

      <div className="flex flex-wrap gap-3">
        <button className={sourceBtn} disabled={!!busy} onClick={() => pdfRef.current?.click()}>
          <FileText className="w-6 h-6 text-exam-gold" /> Upload one PDF
          <span className="text-xs font-normal text-exam-ink-faint">all essays in one scan</span>
        </button>
        <button className={sourceBtn} disabled={!!busy} onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="w-6 h-6 text-exam-gold" /> Choose images
          <span className="text-xs font-normal text-exam-ink-faint">select several at once</span>
        </button>
        <button className={sourceBtn} disabled={!!busy} onClick={() => cameraRef.current?.click()}>
          <Camera className="w-6 h-6 text-exam-gold" /> Take photo
          <span className="text-xs font-normal text-exam-ink-faint">one page at a time</span>
        </button>
      </div>

      {targets.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-exam-ink-muted">Photos go to:</span>
          {targets.map(t => (
            <button
              key={t.essayIndex}
              onClick={() => setPhotoTo(t.essayIndex)}
              aria-pressed={photoTo === t.essayIndex}
              className={`rounded-full border px-3 py-1.5 font-semibold ${photoTo === t.essayIndex ? 'border-exam-gold bg-exam-gold/15 text-exam-ink' : 'border-exam-border text-exam-ink-muted'}`}
            >
              {t.label}
            </button>
          ))}
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
      {error && <p role="alert" className="mt-4 text-sm text-exam-danger">{error}</p>}

      {pages.length > 0 && (
        <>
          <p className="mt-6 mb-3 text-xs text-exam-ink-faint">
            Check each page is sharp and sits under the right essay. Use the menu on a page to move it to another essay or leave it out.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pages.map((p, i) => (
              <div key={p.id} className={`relative rounded-lg overflow-hidden border bg-white ${p.essay === null ? 'border-exam-danger/60 opacity-70' : 'border-exam-border'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt={`Page ${i + 1}`} className="w-full aspect-[3/4] object-contain bg-neutral-200" />
                <span className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-white">{i + 1}</span>
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <button className={iconBtn} onClick={() => rotate(i)} disabled={!!busy} aria-label="Rotate"><RotateCw className="w-4 h-4" /></button>
                  <button className={iconBtn} onClick={() => remove(i)} disabled={!!busy} aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
                <select
                  value={p.essay ?? ''}
                  onChange={e => assign(i, e.target.value === '' ? null : Number(e.target.value))}
                  disabled={!!busy}
                  aria-label={`Essay for page ${i + 1}`}
                  className="w-full border-t border-exam-border bg-exam-surface px-2 py-2 text-sm text-exam-ink"
                >
                  {targets.map(t => <option key={t.essayIndex} value={t.essayIndex}>{t.label}</option>)}
                  <option value="">Leave out</option>
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-exam-border bg-exam-elevated p-4 text-sm text-exam-ink-muted">
            {targets.map(t => (
              <p key={t.essayIndex}>
                <span className="text-exam-ink">{t.label}</span> · {count(t.essayIndex)} page{count(t.essayIndex) === 1 ? '' : 's'}
                {count(t.essayIndex) === 0 && ' (nothing to submit yet; you can add it later before the deadline)'}
              </p>
            ))}
            {unassigned > 0 && <p className="mt-1 text-exam-danger">{unassigned} page{unassigned === 1 ? ' is' : 's are'} set to “Leave out” and will not be uploaded.</p>}
            {tooMany && <p className="mt-1 text-exam-danger">{tooMany.label} can have at most {MAX_PAGES_PER_ESSAY} pages.</p>}
          </div>

          <button
            className="mt-6 w-full rounded-xl bg-exam-maroon py-4 text-base font-bold text-white hover:bg-exam-maroon-bright disabled:opacity-50"
            disabled={!!busy || ready.length === 0 || !!tooMany}
            onClick={() => setConfirming(true)}
          >
            Submit {ready.map(t => `${t.label} (${count(t.essayIndex)})`).join(' · ') || 'essays'}
          </button>
        </>
      )}

      {confirming && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setConfirming(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-exam-border bg-exam-surface p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-exam-ink mb-2">Submit these essays?</h3>
            <ul className="text-sm text-exam-ink-muted mb-3">
              {ready.map(t => <li key={t.essayIndex}>{t.label}: {count(t.essayIndex)} page{count(t.essayIndex) === 1 ? '' : 's'}</li>)}
            </ul>
            <p className="text-sm text-exam-ink-muted mb-5"><strong className="text-exam-ink">Submissions are final</strong>: you can&apos;t change or add pages afterwards.</p>
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
