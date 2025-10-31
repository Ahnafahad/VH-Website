'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminRegistrationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/registrations');
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || 'Failed to load');
        }
        const data = await res.json();
        setItems(data.items || []);
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="max-w-5xl mx-auto p-6">Loading registrations…</div>;
  if (error) return <div className="max-w-5xl mx-auto p-6 text-red-700">{error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-black mb-4">Registrations</h1>
        <div className="bg-white rounded-2xl border shadow divide-y">
          {items.length === 0 && (
            <div className="p-6 text-gray-600">No registrations yet.</div>
          )}
          {items.map((r, idx) => (
            <div key={idx} className="p-6">
              <div className="font-bold text-gray-900">{r.name} — {r.email} — {r.phone}</div>
              <div className="text-sm text-gray-700">Track: {r.track} • Mode: {r.mode} • Date: {new Date(r.createdAt).toLocaleString()}</div>
              {r.mode === 'mocks' && (
                <div className="text-sm text-gray-700 mt-1">Mocks: {(r.mocks||[]).join(', ')} • Intent: {r.intent} • Total: {r.totalPrice ?? '-'}</div>
              )}
              {r.mode === 'full' && (
                <div className="text-sm text-gray-700 mt-1">Full: {(r.full||[]).join(', ')}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">Years: {r.track==='hsc' ? `SSC ${r.years?.ssc}, HSC ${r.years?.hsc}` : `O ${r.years?.o}, A ${r.years?.a}`}</div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link href="/" className="px-5 py-2 rounded bg-gray-900 text-white">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
