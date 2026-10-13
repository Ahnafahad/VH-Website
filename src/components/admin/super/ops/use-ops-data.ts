'use client';
import { useCallback, useEffect, useState } from 'react';
import { superApi } from '../super-ui';

/** Load JSON from an ops API route; `reload` refetches. */
export function useOpsData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try { setData(await superApi<T>(url)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
  }, [url]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, reload, loading: !data && !error };
}
