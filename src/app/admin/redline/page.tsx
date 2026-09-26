'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Cohort } from '@/lib/redline/service';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

export default function RedlineAdminPage() {
  const [data, setData] = useState<Cohort | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch('/api/admin/redline');
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Could not load Redline analytics.'); return; }
    setData(await res.json());
  };
  useEffect(() => { load(); }, []);

  const toggle = async () => {
    if (!data) return;
    setSaving(true);
    const res = await fetch('/api/admin/redline', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !data.active }),
    });
    if (res.ok) await load();
    setSaving(false);
  };

  if (error) return <div className="max-w-5xl mx-auto px-4 py-10 text-destructive">{error}</div>;
  if (!data) return <div className="max-w-5xl mx-auto px-4 py-10 text-muted-foreground">Loading…</div>;

  const flagged = data.questions.filter(q => q.flag);
  const hardest = data.questions.filter(q => q.n >= 3).slice(0, 15);
  const funnelMax = Math.max(1, ...data.levels.map(l => l.started));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Redline</h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Sentence Correction Mastery for IBA 2026-27. 42 levels of 20 questions; finishing one unlocks the next. Analytics below use each student&apos;s first attempt at a level only.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={data.active ? 'text-emerald-600 text-xs font-semibold' : 'text-muted-foreground text-xs'}>
            {data.active ? 'Open to students' : 'Switched off'}
          </span>
          <Button size="sm" variant={data.active ? 'outline' : 'default'} onClick={toggle} disabled={saving}>
            {data.active ? 'Switch off' : 'Switch on'}
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/redline" />}>Open as student</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Eligible students', data.eligible], ['Started', data.started], ['Finished level 1', data.levels[0]?.finished ?? 0]].map(([label, v]) => (
          <div key={label as string} className="border rounded-xl p-4"><p className="text-2xl font-semibold tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{label}</p></div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-1">Cohort skill map</h2>
        <p className="text-xs text-muted-foreground mb-3">Mean mastery across students with enough evidence in each skill, weakest first.</p>
        <div className="border rounded-xl divide-y">
          {data.skills.map(s => (
            <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_120px_90px] items-center gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">{s.label}</span>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={s.meanMastery !== null && s.meanMastery < 50 ? 'bg-red-500 h-full' : s.meanMastery !== null && s.meanMastery < 75 ? 'bg-amber-500 h-full' : 'bg-emerald-500 h-full'} style={{ width: `${s.meanMastery ?? 0}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums text-right">
                {s.meanMastery === null ? 'no data' : `${s.meanMastery} · ${s.weakStudents}/${s.students} weak`}
              </span>
            </div>
          ))}
          {data.skills.length === 0 && <p className="text-sm text-muted-foreground p-4">No student data yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Level funnel</h2>
        <div className="border rounded-xl p-4 grid grid-cols-[repeat(42,minmax(0,1fr))] gap-0.5 items-end h-28">
          {data.levels.map(l => (
            <div key={l.level} className="flex flex-col justify-end h-full" title={`Level ${l.level}: ${l.started} started, ${l.finished} finished`}>
              <div className="bg-primary/30 rounded-t" style={{ height: `${(l.started / funnelMax) * 100}%` }}>
                <div className="bg-primary rounded-t w-full" style={{ height: l.started ? `${(l.finished / l.started) * 100}%` : 0 }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Levels 1–42 left to right. Light bar = started, dark = finished.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Students</h2>
        <p className="text-xs text-muted-foreground mb-3">Click a name for their full dashboard.</p>
        <div className="border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr className="text-left"><th className="px-4 py-2">Student</th><th className="px-2">Levels</th><th className="px-2">Answered</th><th className="px-2">Accuracy</th><th className="px-2">Mastery</th><th className="px-2">Top priority</th></tr></thead>
            <tbody className="divide-y">
              {data.students.map(s => (
                <tr key={s.userId}>
                  <td className="px-4 py-2"><Link className="underline underline-offset-2" href={`/admin/redline/students/${s.userId}`}>{s.name}</Link></td>
                  <td className="px-2 tabular-nums">{s.levelsDone}{s.inProgress ? '+' : ''}</td>
                  <td className="px-2 tabular-nums">{s.answered}</td>
                  <td className="px-2 tabular-nums">{pct(s.accuracy)}</td>
                  <td className="px-2 tabular-nums">{s.mastery ?? '—'}</td>
                  <td className="px-2 text-muted-foreground">{s.topWeakness ?? '—'}</td>
                </tr>
              ))}
              {data.students.length === 0 && <tr><td className="px-4 py-3 text-muted-foreground" colSpan={6}>Nobody has started yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Question quality</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Answer keys were derived by AI workers and QA re-solved, not taken from a published key. A question where one wrong option beats the correct one is a candidate for human review.
        </p>
        <QuestionTable title={`Flagged (${flagged.length})`} rows={flagged} />
        <div className="h-4" />
        <QuestionTable title="Hardest so far" rows={hardest} />
      </section>
    </div>
  );
}

function QuestionTable({ title, rows }: { title: string; rows: Cohort['questions'] }) {
  return (
    <div className="border rounded-xl overflow-x-auto">
      <p className="px-4 pt-3 text-sm font-medium">{title}</p>
      <table className="w-full text-sm mt-1">
        <thead className="text-xs text-muted-foreground"><tr className="text-left"><th className="px-4 py-2">Q</th><th className="px-2">Level</th><th className="px-2">Skill</th><th className="px-2">n</th><th className="px-2">Correct</th><th className="px-2">Key</th><th className="px-2">Picks</th><th className="px-2">Flag</th></tr></thead>
        <tbody className="divide-y">
          {rows.map(q => (
            <tr key={q.questionId}>
              <td className="px-4 py-2 tabular-nums">Q{q.number}</td><td className="px-2">{q.level}</td>
              <td className="px-2">{q.skillLabel}</td><td className="px-2 tabular-nums">{q.n}</td>
              <td className="px-2 tabular-nums">{pct(q.correctRate)}</td><td className="px-2 font-mono">{q.correctKey}</td>
              <td className="px-2 font-mono text-xs">{Object.entries(q.picks).sort().map(([k, v]) => `${k}:${v}`).join(' ')}</td>
              <td className="px-2 text-xs text-amber-700">{q.flag ?? ''}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="px-4 py-3 text-muted-foreground" colSpan={8}>Nothing yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
