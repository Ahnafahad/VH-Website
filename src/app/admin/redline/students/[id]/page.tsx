'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import LevelPath from '@/components/redline/LevelPath';
import RedlineDashboard from '@/components/redline/RedlineDashboard';
import type { RedlineAnalysis, RedlineLevelTile } from '@/lib/redline/types';

interface Payload { name: string; email: string; levels: RedlineLevelTile[]; analysis: RedlineAnalysis }

export default function RedlineStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/redline/students/${id}`).then(async res => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? 'Could not load this student.'); else setData(body);
    }).catch(() => setError('Network error.'));
  }, [id]);

  if (error) return <div className="max-w-4xl mx-auto px-4 py-10 text-destructive">{error}</div>;
  if (!data) return <div className="max-w-4xl mx-auto px-4 py-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link href="/admin/redline" className="text-sm text-muted-foreground hover:underline">← Redline</Link>
        <h1 className="text-2xl font-semibold mt-2">{data.name}</h1>
        <p className="text-sm text-muted-foreground">{data.email}</p>
      </div>
      <div className="rounded-2xl bg-exam-base text-exam-ink p-6 sm:p-8 space-y-12">
        <div>
          <h2 className="font-serif text-xl font-semibold mb-4">Levels</h2>
          <LevelPath levels={data.levels} />
        </div>
        <RedlineDashboard analysis={data.analysis} />
      </div>
    </div>
  );
}
