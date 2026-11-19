'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { JourneyAdminRow } from '@/lib/journey/types';

const LABEL: Record<JourneyAdminRow['status'], string> = {
  none: 'Not opened', ready: 'Built, not started', running: 'In progress now', paused: 'Paused', done: 'Completed',
};
const when = (ms: number) => new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function JourneyAdmin() {
  const [data, setData] = useState<{ enabled: boolean; rows: JourneyAdminRow[] } | null>(null);

  const load = async () => {
    const res = await fetch('/api/admin/journey');
    if (res.ok) setData(await res.json());
  };
  useEffect(() => { load(); }, []);

  const toggle = async () => {
    await fetch('/api/admin/journey', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !data?.enabled }),
    });
    load();
  };

  if (!data) return null;
  const count = (...s: JourneyAdminRow['status'][]) => data.rows.filter(r => s.includes(r.status)).length;
  return (
    <section className="mt-12">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold">Exorcise the Past (IBA)</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          <Button variant="outline" size="sm" onClick={toggle}>{data.enabled ? 'Lock for students' : 'Unlock for students'}</Button>
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-1">
        {data.enabled ? 'Unlocked.' : 'Locked.'} Each student gets their own 60-minute set from the questions they missed in their last 5 mocks (20 English, 30 Maths, 10 Analytical), and can pause the timer.
      </p>
      <p className="text-sm mb-4">
        <b>{count('done')}</b> completed · <b>{count('running', 'paused')}</b> in progress · <b>{count('ready')}</b> built, not started · <b>{count('none')}</b> not opened
      </p>
      <div className="border rounded-xl divide-y">
        {data.rows.length === 0 && <p className="text-sm text-muted-foreground p-4">No Mock Access students found.</p>}
        {data.rows.map(r => (
          <div key={r.userId} className="px-4 py-3 text-sm space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{r.name}</p>
              <span className={r.status === 'done' ? 'text-emerald-600 text-xs font-semibold' : r.status === 'none' ? 'text-muted-foreground text-xs' : 'text-xs font-semibold'}>
                {LABEL[r.status]}
              </span>
            </div>
            {r.status !== 'none' && (
              <>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${r.total ? (r.answered / r.total) * 100 : 0}%` }} />
                </div>
                <p className="text-muted-foreground text-xs">
                  {r.answered}/{r.total} answered · {Math.floor(r.elapsedMs / 60000)}/60 min used
                  {r.startedAt ? ` · started ${when(r.startedAt)}` : ''}
                  {r.finishedAt ? ` · finished ${when(r.finishedAt)}` : ''}
                  {r.result ? ` · score ${r.result.correct}/${r.result.total} (${r.result.marks} marks)` : ''}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
