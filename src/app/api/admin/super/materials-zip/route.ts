import { NextResponse } from 'next/server';
import { Zip, ZipPassThrough } from 'fflate';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { db, materials } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { r2GetBytes } from '@/lib/storage/r2';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PRODUCT: Record<string, string> = { iba: 'IBA', fbs: 'DU FBS' };
const SUBJECT: Record<string, string> = { math: 'Maths', business_studies: 'Business Studies', tbd: 'Unsorted' };
const DOC: Record<string, string> = { lecture: 'Lectures', solution: 'Solutions', notes: 'Notes', practice: 'Practice', question_paper: 'Question Papers', homework: 'Homework' };
const clean = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
const title = (s: string) => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/**
 * Every PDF material as one zip: <product>/<subject>/<doc type>/<file>. Super admin only.
 * Streamed (not buffered) because a Vercel response body is capped at 4.5 MB unless it streams.
 */
export async function GET() {
  try {
    await requireSuperAdmin();
    const rows = await db.select().from(materials).where(eq(materials.type, 'pdf'));

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const zip = new Zip((err, chunk, final) => {
          if (err) return controller.error(err);
          controller.enqueue(chunk);
          if (final) controller.close();
        });
        const used = new Set<string>();
        try {
          for (const m of rows) {
            const name = clean(m.fileName ?? m.blobUrl.replace(/^.*\/\d+-/, ''));
            const dir = [
              PRODUCT[m.product] ?? m.product,
              SUBJECT[m.subject] ?? title(m.subject),
              DOC[m.docType ?? ''] ?? (/solution/i.test(name) ? 'Solutions' : 'Other'),
            ].map(clean).join('/');
            let path = `${dir}/${name}`;
            if (used.has(path)) path = `${dir}/id${m.id}-${name}`;
            used.add(path);
            const entry = new ZipPassThrough(path); // PDFs are already compressed
            zip.add(entry);
            entry.push((await r2GetBytes(m.blobUrl)).body, true);
          }
          zip.end();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="class materials 2026.zip"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
