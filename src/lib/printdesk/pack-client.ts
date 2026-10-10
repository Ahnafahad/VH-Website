'use client';

/**
 * Builds the PrintDesk zip in the browser: one PDF per material (numbered in
 * print-list order) plus PRINT-LIST.txt with copies and who asked. Files are
 * fetched straight from storage so large packs never pass through a
 * serverless response.
 */

import { zipSync } from 'fflate';
import { packSummary, type PackLine } from './rules';

export interface PackResponse {
  requestIds: number[];
  markedPrinted: number;
  generatedAt: string;
  lines: (PackLine & { fileName: string | null; url: string | null })[];
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'material';
}

export async function buildPrintZip(pack: PackResponse, onProgress?: (done: number, total: number) => void): Promise<{ blob: Blob; failed: number }> {
  const files: Record<string, Uint8Array> = {};
  const names = new Map<number, string>();
  const failed = new Set<number>();
  for (let i = 0; i < pack.lines.length; i++) {
    const l = pack.lines[i];
    const name = `${String(i + 1).padStart(2, '0')} - ${safeName(l.title)} (x${l.students.length}).pdf`;
    names.set(l.materialId, name);
    try {
      if (!l.url) throw new Error('missing file');
      const res = await fetch(l.url);
      if (!res.ok) throw new Error(String(res.status));
      files[name] = new Uint8Array(await res.arrayBuffer());
    } catch {
      failed.add(l.materialId);
    }
    onProgress?.(i + 1, pack.lines.length);
  }
  files['PRINT-LIST.txt'] = new TextEncoder().encode(packSummary(pack.lines, names, new Date(pack.generatedAt), failed));
  // PDFs are already compressed — store them, only deflate the text file.
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: k.endsWith('.txt') ? 6 : 0 }]])),
  );
  return { blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), failed: failed.size };
}
