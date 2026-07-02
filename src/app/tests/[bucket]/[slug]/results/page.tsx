'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ResultsPayload } from '@/lib/tests/types';
import ResultsShell from '@/components/tests/results/ResultsShell';

export default function ResultsPage() {
  const params = useParams<{ bucket: string; slug: string }>();
  const slug = params.slug;

  const [data, setData] = useState<ResultsPayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'locked' | 'error' | 'ok'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/tests/${slug}/results`)
      .then(async (res) => {
        if (res.status === 403) {
          const body = (await res.json()) as { code?: string };
          if (body.code === 'RESULTS_NOT_PUBLISHED') {
            setStatus('locked');
            return;
          }
        }
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setErrorMsg(body.error ?? 'Failed to load results.');
          setStatus('error');
          return;
        }
        const payload = (await res.json()) as ResultsPayload;
        setData(payload);
        setStatus('ok');
      })
      .catch(() => {
        setErrorMsg('Network error — please try again.');
        setStatus('error');
      });
  }, [slug]);

  return <ResultsShell status={status} data={data} errorMsg={errorMsg} />;
}
