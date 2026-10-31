'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import type { MyMockRegistration } from '@/lib/mocks/registration';

const primaryBtn = 'inline-flex items-center justify-center px-5 py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors disabled:opacity-50';
const ghostBtn = 'inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted hover:text-exam-ink text-sm transition-colors';
const inputCls = 'w-full rounded-xl bg-exam-base border border-exam-border px-4 py-3 text-exam-ink placeholder:text-exam-ink-faint focus:outline-none focus:border-exam-gold';
const card = 'rounded-2xl border border-exam-border bg-exam-surface p-5 sm:p-6';

type View = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'error'; message: string } | { kind: 'ready'; data: MyMockRegistration };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Something went wrong. Try again.');
  return json;
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ['Your phone', 'Payment', 'Verification'];
  return (
    <ol className="flex gap-2 mb-6 text-xs">
      {labels.map((l, i) => (
        <li key={l} className={`flex-1 rounded-lg px-3 py-2 border ${i + 1 === current ? 'border-exam-gold text-exam-ink' : 'border-exam-border text-exam-ink-faint'}`}>
          <span className="font-mono mr-1.5">{i + 1}</span>{l}
        </li>
      ))}
    </ol>
  );
}

function Contact({ whatsapp }: { whatsapp: string }) {
  return (
    <p className="text-sm text-exam-ink-muted">
      Questions? WhatsApp us on{' '}
      <a className="text-exam-ink underline" href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{whatsapp}</a>.
    </p>
  );
}

function Details() {
  return (
    <section className={card}>
      <h2 className="font-serif text-xl font-semibold text-exam-ink mb-2">About the mock</h2>
      <p className="text-exam-ink-muted text-sm leading-relaxed">
        A full-length IBA admission mock: English, Mathematics and Analytical MCQs, then essays. Sit it online or on paper.
        Once every sheet is checked you get your score, rank, section-wise missed chances and the solutions.
      </p>
      <p className="text-exam-ink-muted text-sm leading-relaxed mt-3">
        Registering also gives you 30 days of full access to LexiCore, our vocabulary app, and our mental-math game Zap.
      </p>
    </section>
  );
}

function PhoneStep({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await postJson('/api/mock-registration', { phone }); onDone(); }
    catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className={card}>
      <label htmlFor="phone" className="block text-sm text-exam-ink mb-2">Your phone number</label>
      <input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className={inputCls} />
      {err && <p role="alert" className="text-sm text-red-400 mt-2">{err}</p>}
      <button type="submit" disabled={busy} className={`${primaryBtn} mt-4`}>{busy ? 'Saving…' : 'Continue to payment'}</button>
    </form>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-exam-base border border-exam-border px-4 py-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-widest text-exam-ink-faint">{label}</div>
        <div className="font-mono text-exam-ink break-all">{value}</div>
      </div>
      <button type="button" className={ghostBtn} onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function PaymentStep({ data, onDone }: { data: MyMockRegistration; onDone: () => void }) {
  const [trxId, setTrxId] = useState(data.registration?.trxId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!trxId.trim() && !file && !data.registration?.hasScreenshot) { setErr('Enter the transaction ID or upload a screenshot.'); return; }
    setBusy(true);
    try {
      let screenshotKey: string | undefined;
      if (file) {
        const { key, uploadUrl } = await postJson('/api/mock-registration/screenshot', { fileName: file.name, contentType: file.type }) as { key: string; uploadUrl: string };
        const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!put.ok) throw new Error('Screenshot upload failed. Try again, or just send the transaction ID.');
        screenshotKey = key;
      }
      await postJson('/api/mock-registration/payment', { trxId, screenshotKey });
      onDone();
    } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); }
    setBusy(false);
  };

  return (
    <div className="grid gap-4">
      {data.registration?.status === 'rejected' && (
        <div role="alert" className="rounded-2xl border border-red-400/40 bg-exam-surface p-5 text-sm text-exam-ink">
          <b>We could not verify your last submission.</b>
          {data.registration.note && <p className="mt-1 text-exam-ink-muted">{data.registration.note}</p>}
          <p className="mt-1 text-exam-ink-muted">Check the details below and submit again.</p>
        </div>
      )}
      <section className={card}>
        <h2 className="font-serif text-xl font-semibold text-exam-ink mb-1">Pay with bKash (Send Money)</h2>
        <p className="text-sm text-exam-ink-muted mb-4">Open bKash, choose Send Money, and use these exact details.</p>
        <div className="grid gap-2">
          <CopyRow label="bKash personal number" value={data.bkashNumber} />
          <CopyRow label="Reference" value={data.reference} />
        </div>
        <p className="text-xs text-exam-ink-faint mt-3">The reference is how we match your payment to you. Type it exactly as shown.</p>
      </section>
      <form onSubmit={submit} className={card}>
        <h2 className="font-serif text-xl font-semibold text-exam-ink mb-3">Then tell us it is done</h2>
        <label htmlFor="trx" className="block text-sm text-exam-ink mb-2">bKash transaction ID</label>
        <input id="trx" value={trxId} onChange={e => setTrxId(e.target.value)} placeholder="e.g. 9A7B6C5D4E" autoCapitalize="characters" className={inputCls} />
        <label htmlFor="shot" className="block text-sm text-exam-ink mt-4 mb-2">Or upload a screenshot of the payment</label>
        <input id="shot" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-exam-ink-muted" />
        {err && <p role="alert" className="text-sm text-red-400 mt-3">{err}</p>}
        <button type="submit" disabled={busy} className={`${primaryBtn} mt-4`}>{busy ? 'Submitting…' : 'Submit for verification'}</button>
      </form>
    </div>
  );
}

function Awaiting({ data }: { data: MyMockRegistration }) {
  return (
    <section className={card}>
      <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-2">Awaiting verification</p>
      <h2 className="font-serif text-2xl font-semibold text-exam-ink mb-2">We have your payment details</h2>
      <p className="text-exam-ink-muted text-sm leading-relaxed">
        We will check them against bKash and email <b className="text-exam-ink">{data.email}</b> as soon as your registration is approved.
        Come back to this page any time to see where it stands.
      </p>
      <dl className="mt-4 grid gap-1 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-exam-ink-faint">Reference</dt><dd className="font-mono text-exam-ink">{data.reference}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-exam-ink-faint">Transaction ID</dt><dd className="font-mono text-exam-ink">{data.registration?.trxId ?? 'Screenshot sent'}</dd></div>
      </dl>
    </section>
  );
}

function Approved({ data }: { data: MyMockRegistration }) {
  const until = data.registration?.accessUntil
    ? new Date(data.registration.accessUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' })
    : null;
  return (
    <section className={card}>
      <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-2">Approved</p>
      <h2 className="font-serif text-2xl font-semibold text-exam-ink mb-2">Congratulations, you are in</h2>
      <p className="text-exam-ink-muted text-sm leading-relaxed">
        Your mock registration is confirmed. You now have access to <b className="text-exam-ink">LexiCore</b>{until && <> until {until}</>}.
        LexiCore turns the words you need for admission tests into short daily practice with spaced review.
        You can also play <b className="text-exam-ink">Zap</b>, our mental-math game.
      </p>
      <div className="flex flex-wrap gap-3 mt-5">
        <Link href="/vocab/home" className={primaryBtn}>Open LexiCore</Link>
        <Link href="/games/mental-math" className={ghostBtn}>Play Zap</Link>
      </div>
    </section>
  );
}

export default function MockRegisterClient() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mock-registration');
      if (res.status === 401 || res.status === 403) { setView({ kind: 'signed-out' }); return; }
      const json = await res.json();
      if (!res.ok) { setView({ kind: 'error', message: json.error ?? 'Could not load.' }); return; }
      setView({ kind: 'ready', data: json as MyMockRegistration });
    } catch { setView({ kind: 'error', message: 'Network error. Check your connection.' }); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  let body: React.ReactNode = null;
  if (view.kind === 'loading') body = <p className="text-exam-ink-muted text-sm">Loading…</p>;
  else if (view.kind === 'error') body = <p role="alert" className="text-sm text-red-400">{view.message}</p>;
  else if (view.kind === 'signed-out') {
    body = (
      <>
        <Details />
        <section className={card}>
          <h2 className="font-serif text-xl font-semibold text-exam-ink mb-1">Register</h2>
          <p className="text-sm text-exam-ink-muted mb-4">Continue with the Gmail account you want to use. We only need your phone number after that.</p>
          <button type="button" disabled={busy} className={primaryBtn}
            onClick={() => { setBusy(true); void signIn('google', { callbackUrl: '/mock-register' }); }}>
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
        </section>
        <Contact whatsapp="+8801835200626" />
      </>
    );
  } else {
    const { data } = view;
    const status = data.registration?.status;
    if (status === 'approved') body = <Approved data={data} />;
    else if (status === 'submitted') body = <Awaiting data={data} />;
    else if (!data.registration) body = (<><Steps current={1} /><PhoneStep onDone={load} /></>);
    else body = (<><Steps current={2} /><PaymentStep data={data} onDone={load} /></>);
    body = <>{body}<Contact whatsapp={data.whatsapp} /></>;
  }

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="max-w-xl mx-auto px-4 pb-16" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
        <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Beyond the Horizons</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold mb-6">Mock Registration</h1>
        <div className="grid gap-4">{body}</div>
      </div>
    </main>
  );
}
