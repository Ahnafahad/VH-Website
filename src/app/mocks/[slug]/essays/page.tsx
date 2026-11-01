'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import MockEssayUploader from '@/components/essays/MockEssayUploader';
import type { MockListEntry } from '@/lib/mocks/types';
import type { EssaySlotStatus } from '@/lib/essays/types';

interface EssayEntry { essayIndex: number; prompt: string; max: number; status: EssaySlotStatus; rejectReason: string | null }
interface Detail {
  series: { id: number; title: string; essayCount: number; deadline: string; deadlinePassed: boolean };
  essays: EssayEntry[];
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(iso));

const STATUS: Record<EssaySlotStatus, string> = {
  open: 'Not submitted', submitted: 'Submitted', rejected: 'Sent back: resubmit', graded: 'Marked', missed: 'Not submitted', closed: 'Closed',
};

/** The mock's essay screen: shown right after the MCQs, one place to upload every essay. */
export default function MockEssaysPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [mock, setMock] = useState<MockListEntry | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetch('/api/mocks');
      const lj = await list.json().catch(() => ({}));
      if (!list.ok) { setError(lj.error ?? 'Could not load this mock.'); return; }
      const m = (lj.mocks as MockListEntry[]).find(x => x.slug === slug);
      if (!m) { setError('Mock not found.'); return; }
      setMock(m);
      if (!m.essay) return;
      const res = await fetch(`/api/essays/${m.essay.seriesId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? 'Could not load the essays.'); return; }
      setDetail(body);
    } catch { setError('Network error. Check your connection.'); }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  const openEssays = detail?.essays.filter(e => e.status === 'open' || e.status === 'rejected') ?? [];
  const canUpload = !!detail && !detail.series.deadlinePassed && openEssays.length > 0;

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-4xl mx-auto px-4 pb-8 sm:pb-12" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
          <Link href="/mocks" className="text-exam-gold text-xs font-bold uppercase tracking-widest">← Mocks</Link>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mt-3 mb-2">{mock ? `${mock.title}: essays` : 'Essays'}</h1>
          {detail && (
            <p className="text-sm text-exam-ink-muted">
              {detail.series.deadlinePassed ? 'Uploads closed ' : 'Upload by '}{fmt(detail.series.deadline)}. Write on the answer sheet, then scan or photograph every page.
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        {error && <p className="text-exam-danger">{error}</p>}
        {!error && !mock && <p className="text-exam-ink-muted">Loading…</p>}
        {mock && !mock.essay && (
          <p className="text-exam-ink-muted">This mock has no essays. <Link href="/mocks" className="text-exam-gold underline">Back to Mocks</Link></p>
        )}

        {justSubmitted && (
          <div className="flex items-start gap-3 rounded-xl border border-exam-success/40 bg-exam-success/10 p-4">
            <CheckCircle2 className="w-5 h-5 text-exam-success flex-shrink-0 mt-0.5" />
            <p className="text-sm text-exam-ink">Received. You will get an email when your final rank is published.</p>
          </div>
        )}

        {detail && (
          <section className="space-y-5">
            {detail.essays.map(e => (
              <article key={e.essayIndex} className="rounded-2xl border border-exam-border bg-exam-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-serif text-xl font-semibold">Essay {e.essayIndex} <span className="text-sm font-normal text-exam-ink-muted">· {e.max} marks</span></h2>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-exam-ink-muted">{STATUS[e.status]}</span>
                </div>
                {e.prompt && <blockquote className="mt-3 border-l-2 border-exam-gold pl-4 text-exam-ink whitespace-pre-wrap">{e.prompt}</blockquote>}
                {e.status === 'rejected' && e.rejectReason && (
                  <p className="mt-3 text-sm text-exam-danger">Reason: {e.rejectReason}</p>
                )}
              </article>
            ))}
          </section>
        )}

        {canUpload && detail && (
          <section>
            <h2 className="font-serif text-2xl font-semibold mb-1">Upload your essays</h2>
            <p className="text-sm text-exam-ink-muted mb-5">Add a PDF or photos, then check which essay each page belongs to.</p>
            <MockEssayUploader
              seriesId={detail.series.id}
              targets={openEssays.map(e => ({ essayIndex: e.essayIndex, label: `Essay ${e.essayIndex}` }))}
              onSubmitted={() => { setJustSubmitted(true); void load(); }}
            />
          </section>
        )}

        {detail && !canUpload && openEssays.length === 0 && (
          <p className="text-sm text-exam-ink-muted">All your essays are in. <Link href={`/essays/${detail.series.id}`} className="text-exam-gold underline">Open them in Essays</Link> to see marks once published.</p>
        )}
        {detail && detail.series.deadlinePassed && openEssays.length > 0 && (
          <p className="text-sm text-exam-ink-muted">The upload deadline has passed. Message us on WhatsApp if you need help.</p>
        )}
      </div>
    </main>
  );
}
