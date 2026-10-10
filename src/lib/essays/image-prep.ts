'use client';

/**
 * Client-side page preparation for essay uploads.
 *
 * Every page — camera shot, gallery image, or a page of an uploaded PDF — is
 * turned into one JPEG on the student's device, so the server only ever
 * stores page images and the marking/annotation pipeline has one input type.
 *
 * Per page the student can rotate, crop (with an automatic paper-edge guess)
 * and toggle "enhance" (a levels stretch that whitens the paper and darkens
 * the ink, which makes phone photos taken under classroom light far easier
 * to read).
 */

export interface CropRect {
  // fractions of the (rotated) source, 0–1
  x: number;
  y: number;
  w: number;
  h: number;
}

type Bitmap = ImageBitmap | HTMLCanvasElement;

export interface PageSource {
  id: string;
  /**
   * The page as imported (EXIF orientation applied, long edge ≤ 2400px),
   * kept as a JPEG blob rather than a decoded bitmap so a 15-page essay
   * doesn't hold hundreds of MB of pixels on a phone.
   */
  blob: Blob;
  rotation: 0 | 90 | 180 | 270;
  crop: CropRect;
  enhance: boolean;
  previewUrl: string; // object URL of a small rendered preview
}

const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };
const MAX_EDGE = 2200;
const IMPORT_EDGE = 2400;
const PREVIEW_EDGE = 640;

type Renderable = { bitmap: Bitmap; rotation: number; crop: CropRect; enhance: boolean };

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function srcSize(b: Bitmap) {
  return { w: b.width, h: b.height };
}

export async function decodeImageFile(file: Blob): Promise<Bitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // HEIC on some browsers, or older Safari without the options bag.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      return c;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Renders every page of a PDF to a canvas (~2000px on the long edge). */
export async function pdfToCanvases(file: File, onProgress?: (done: number, total: number) => void): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: HTMLCanvasElement[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, 2000 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(canvas);
    onProgress?.(i, doc.numPages);
  }
  await doc.destroy();
  return out;
}

/** Draws the rotated source onto a canvas no larger than `maxEdge`. */
function rotatedCanvas(src: Bitmap, rotation: number, maxEdge: number): HTMLCanvasElement {
  const { w, h } = srcSize(src);
  const swap = rotation === 90 || rotation === 270;
  const rw = swap ? h : w;
  const rh = swap ? w : h;
  const scale = Math.min(1, maxEdge / Math.max(rw, rh));
  const c = document.createElement('canvas');
  c.width = Math.round(rw * scale);
  c.height = Math.round(rh * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(src, (-w * scale) / 2, (-h * scale) / 2, w * scale, h * scale);
  return c;
}

/** Applies rotation → crop → enhance and returns a canvas whose long edge ≤ maxEdge. */
function renderBitmap(page: Renderable, maxEdge: number): HTMLCanvasElement {
  // Rotate at a generous size first so the crop keeps detail, then scale the crop down.
  const rotated = rotatedCanvas(page.bitmap, page.rotation, Math.ceil(maxEdge / Math.max(0.2, Math.max(page.crop.w, page.crop.h))));
  const sx = page.crop.x * rotated.width;
  const sy = page.crop.y * rotated.height;
  const sw = Math.max(1, page.crop.w * rotated.width);
  const sh = Math.max(1, page.crop.h * rotated.height);
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.round(sw * scale);
  out.height = Math.round(sh * scale);
  const ctx = out.getContext('2d', { willReadFrequently: page.enhance })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(rotated, sx, sy, sw, sh, 0, 0, out.width, out.height);
  if (page.enhance) enhanceInPlace(ctx, out.width, out.height);
  return out;
}

/**
 * Levels stretch on luminance percentiles: the paper goes to white, the ink
 * to near-black, colours keep their hue (red/blue ink stays readable).
 */
function enhanceInPlace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 16) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
  const total = hist.reduce((a, b) => a + b, 0);
  const pct = (p: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * p) return v; }
    return 255;
  };
  const lo = Math.min(pct(0.02), 90);
  const hi = Math.max(pct(0.7), lo + 40); // most of a page is paper — its tone becomes white
  const range = hi - lo;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const t = Math.min(1, Math.max(0, (v - lo) / range));
    lut[v] = Math.round(255 * Math.pow(t, 1.2));
  }
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Guesses the paper's edges: the paper is the large bright area, the desk
 * around it is darker. Works on a ~200px thumbnail; returns the full frame
 * when it can't find a clear page.
 */
function detectPaperIn(page: { bitmap: Bitmap; rotation: number }): CropRect {
  const c = rotatedCanvas(page.bitmap, page.rotation, 200);
  const { width: w, height: h } = c;
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    const v = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
    lum[i] = v;
    hist[v]++;
  }
  // Otsu threshold
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0, wB = 0, best = 0, thresh = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (!wB) continue;
    const wF = w * h - wB;
    if (!wF) break;
    sumB += v * hist[v];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thresh = v; }
  }
  const rowFrac = (y: number) => { let n = 0; for (let x = 0; x < w; x++) if (lum[y * w + x] > thresh) n++; return n / w; };
  const colFrac = (x: number, y0: number, y1: number) => { let n = 0; for (let y = y0; y <= y1; y++) if (lum[y * w + x] > thresh) n++; return n / Math.max(1, y1 - y0 + 1); };
  let top = 0; while (top < h - 1 && rowFrac(top) < 0.5) top++;
  let bottom = h - 1; while (bottom > top && rowFrac(bottom) < 0.5) bottom--;
  let left = 0; while (left < w - 1 && colFrac(left, top, bottom) < 0.5) left++;
  let right = w - 1; while (right > left && colFrac(right, top, bottom) < 0.5) right--;
  const rect = { x: left / w, y: top / h, w: (right - left + 1) / w, h: (bottom - top + 1) / h };
  // A "page" smaller than 30% of the frame, or the whole frame, means detection didn't find anything useful.
  if (rect.w * rect.h < 0.3 || (rect.w > 0.97 && rect.h > 0.97)) return FULL_CROP;
  return rect;
}

export function canvasToJpeg(c: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality));
}

function release(b: Bitmap) {
  if ('close' in b) b.close();
}

/** Renders the page (rotation → crop → enhance) to a canvas whose long edge ≤ maxEdge. */
export async function renderPage(page: Pick<PageSource, 'blob' | 'rotation' | 'crop' | 'enhance'>, maxEdge = MAX_EDGE): Promise<HTMLCanvasElement> {
  const bitmap = await decodeImageFile(page.blob);
  try {
    return renderBitmap({ bitmap, rotation: page.rotation, crop: page.crop, enhance: page.enhance }, maxEdge);
  } finally {
    release(bitmap);
  }
}

/** Rotated, uncropped, unenhanced view — what the crop editor draws on. */
export async function renderForCrop(page: Pick<PageSource, 'blob' | 'rotation'>): Promise<string> {
  const c = await renderPage({ ...page, crop: FULL_CROP, enhance: false }, 1200);
  return URL.createObjectURL(await canvasToJpeg(c, 0.85));
}

export async function detectPaper(page: Pick<PageSource, 'blob' | 'rotation'>): Promise<CropRect> {
  const bitmap = await decodeImageFile(page.blob);
  try {
    return detectPaperIn({ bitmap, rotation: page.rotation });
  } finally {
    release(bitmap);
  }
}

export async function makePreview(page: Pick<PageSource, 'blob' | 'rotation' | 'crop' | 'enhance'>): Promise<string> {
  const c = await renderPage(page, PREVIEW_EDGE);
  return URL.createObjectURL(await canvasToJpeg(c, 0.8));
}

/** Final upload JPEG for a page. */
export async function finalJpeg(page: PageSource): Promise<{ blob: Blob; width: number; height: number }> {
  const c = await renderPage(page, MAX_EDGE);
  return { blob: await canvasToJpeg(c, 0.85), width: c.width, height: c.height };
}

/** Normalises an imported bitmap (≤ 2400px JPEG) and builds the page with an auto-crop guess. */
export async function createPageSource(bitmap: Bitmap, opts: { autoCrop: boolean; enhance: boolean }): Promise<PageSource> {
  const norm = renderBitmap({ bitmap, rotation: 0, crop: FULL_CROP, enhance: false }, IMPORT_EDGE);
  const crop = opts.autoCrop ? detectPaperIn({ bitmap: norm, rotation: 0 }) : FULL_CROP;
  release(bitmap);
  const blob = await canvasToJpeg(norm, 0.92);
  const page = { blob, rotation: 0 as const, crop, enhance: opts.enhance };
  return { id: newId(), ...page, previewUrl: await makePreview(page) };
}

export { FULL_CROP };
