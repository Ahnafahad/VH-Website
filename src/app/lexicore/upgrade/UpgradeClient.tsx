'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

interface Claim { status: 'active' | 'held' | 'approved' | 'rejected'; trxId: string; accessUntil: number | null; note: string | null }
interface Plan {
  unlimited: boolean;
  price: number;
  promoCode: string | null;
  bkashNumber: string;
  paidUntilText: string;
  claim: Claim | null;
}

const C = {
  base: 'var(--color-lx-base)', surface: 'var(--color-lx-surface)', elevated: 'var(--color-lx-elevated)',
  border: 'var(--color-lx-border)', red: 'var(--color-lx-accent-red)', gold: 'var(--color-lx-accent-gold)',
  textPrim: 'var(--color-lx-text-primary)', textSec: 'var(--color-lx-text-secondary)', textMuted: 'var(--color-lx-text-muted)',
  success: 'var(--color-lx-success)',
} as const;
const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS = "'Sora', sans-serif";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
  background: C.elevated, border: `1px solid ${C.border}`, color: C.textPrim,
  fontFamily: SANS, fontSize: 16, // 16px stops iOS zoom-on-focus
};
const labelStyle: React.CSSProperties = { fontFamily: SANS, fontSize: '0.7rem', fontWeight: 600, color: C.textSec, display: 'block', marginBottom: 6 };
const btnStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: 14, borderRadius: 12, border: 'none', textAlign: 'center',
  background: C.red, color: '#fff', fontFamily: SANS, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
  boxSizing: 'border-box',
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: C.base, color: C.textPrim, fontFamily: SANS }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'calc(1.5rem + env(safe-area-inset-top)) 16px calc(2rem + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginTop: 16 }}>{children}</div>;
}

function Message({ title, body, href, cta }: { title: string; body?: string; href?: string; cta?: string }) {
  return (
    <Shell>
      <h1 style={{ fontFamily: SERIF, fontSize: '2rem', fontStyle: 'italic', fontWeight: 700, lineHeight: 1.15, margin: '2rem 0 10px' }}>{title}</h1>
      {body && <p style={{ fontSize: '0.85rem', color: C.textSec, lineHeight: 1.65, margin: '0 0 20px' }}>{body}</p>}
      {href && <Link href={href} style={btnStyle}>{cta}</Link>}
    </Shell>
  );
}

export default function UpgradeClient({ signedIn }: { signedIn: boolean }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loadError, setLoadError] = useState('');
  const [trxId, setTrxId] = useState('');
  const [sender, setSender] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/vocab/plan');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not load');
      setPlan(body as Plan);
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Could not load'); }
  }, []);
  useEffect(() => { if (signedIn) void load(); }, [signedIn, load]);

  if (!signedIn) {
    return (
      <Shell>
        <h1 style={{ fontFamily: SERIF, fontSize: '2rem', fontStyle: 'italic', fontWeight: 700, margin: '2rem 0 10px' }}>Upgrade LexiCore</h1>
        <p style={{ fontSize: '0.85rem', color: C.textSec, lineHeight: 1.65, margin: '0 0 20px' }}>Sign in first so we can attach the upgrade to your account.</p>
        <button style={btnStyle} onClick={() => signIn('google', { callbackUrl: '/lexicore/upgrade' })}>Continue with Google</button>
      </Shell>
    );
  }
  if (loadError) return <Message title="Something went wrong" body={loadError} href="/vocab/home" cta="Back to LexiCore" />;
  if (!plan) return <Shell><p style={{ color: C.textMuted, fontSize: '0.85rem', marginTop: '3rem' }}>Loading…</p></Shell>;

  const claim = plan.claim;
  if (plan.unlimited && !claim) return <Message title="You already have unlimited LexiCore" href="/vocab/home" cta="Go to LexiCore" />;
  if (claim && (claim.status === 'active' || claim.status === 'approved')) {
    return <Message title="You now have unlimited access" body={`Unlimited flashcards and quizzes until ${plan.paidUntilText}.`} href="/vocab/home" cta="Go to LexiCore" />;
  }
  if (claim?.status === 'held') {
    return <Message title="We got your claim" body="Access opens once we confirm the payment." href="/vocab/home" cta="Back to LexiCore" />;
  }

  const pickFile = (f: File | null) => {
    setFileError('');
    if (f && !TYPES.includes(f.type)) { setFileError('Use a JPG, PNG or WebP image.'); setFile(null); return; }
    if (f && f.size > MAX_BYTES) { setFileError('That image is over 5 MB.'); setFile(null); return; }
    setFile(f);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(plan.bkashNumber); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* user can select the number */ }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNote('');
    try {
      let screenshotKey: string | undefined;
      if (file) {
        try {
          const pre = await fetch('/api/vocab/plan/screenshot', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, contentType: file.type }),
          });
          const p = await pre.json();
          if (!pre.ok) throw new Error(p.error ?? 'presign failed');
          const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
          if (!put.ok) throw new Error('upload failed');
          screenshotKey = p.key;
        } catch {
          setNote('The screenshot did not upload, so we sent your claim without it.');
        }
      }
      const res = await fetch('/api/vocab/plan/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trxId: trxId.trim(), senderNumber: sender.trim() || undefined, screenshotKey, promoCode: plan.promoCode ?? undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not submit your claim');
      setPlan(body as Plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your claim');
    } finally { setBusy(false); }
  };

  const applyCode = async () => {
    setCodeError('');
    const res = await fetch(`/api/vocab/plan?code=${encodeURIComponent(codeInput.trim())}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setCodeError(body.error ?? 'That code is not valid.'); return; }
    setPlan(body as Plan);
  };

  const steps = ['Open bKash and choose Send Money.', `Send ৳${plan.price} to the number above.`, 'Copy the Transaction ID from the confirmation SMS or screen.'];

  return (
    <Shell>
      <Link href="/vocab/home" style={{ fontSize: '0.7rem', color: C.textMuted, textDecoration: 'none' }}>← Back</Link>
      <p style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, margin: '1.25rem 0 6px' }}>Upgrade</p>
      <h1 style={{ fontFamily: SERIF, fontSize: '2.4rem', fontStyle: 'italic', fontWeight: 700, lineHeight: 1.05, margin: 0 }}>৳{plan.price}</h1>
      <p style={{ fontSize: '0.85rem', color: C.textSec, lineHeight: 1.6, margin: '8px 0 0' }}>
        Unlimited flashcards and quizzes until {plan.paidUntilText}.
      </p>

      {claim?.status === 'rejected' && (
        <Card>
          <p style={{ margin: 0, fontSize: '0.8rem', color: C.red, fontWeight: 600 }}>Your last claim was not accepted.</p>
          {claim.note && <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: C.textSec }}>{claim.note}</p>}
          <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: C.textMuted }}>You can send a new claim below.</p>
        </Card>
      )}

      <Card>
        {plan.promoCode ? (
          <p style={{ margin: 0, fontSize: '0.8rem', color: C.success, fontWeight: 600 }}>Code {plan.promoCode} applied. You pay ৳{plan.price}.</p>
        ) : (
          <>
            <label htmlFor="code" style={labelStyle}>Have a code?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="code" value={codeInput} onChange={e => setCodeInput(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="Enter code" style={inputStyle} />
              <button type="button" onClick={applyCode} disabled={!codeInput.trim()} style={{ padding: '0 16px', borderRadius: 10, background: C.elevated, border: `1px solid ${C.border}`, color: C.textPrim, fontFamily: SANS, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', opacity: codeInput.trim() ? 1 : 0.6 }}>Apply</button>
            </div>
            {codeError && <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: C.red }}>{codeError}</p>}
          </>
        )}
      </Card>

      <Card>
        <p style={{ margin: '0 0 6px', fontSize: '0.7rem', color: C.textMuted }}>Send money by bKash to</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.04em' }}>{plan.bkashNumber}</span>
          <button type="button" onClick={copy} style={{ padding: '8px 14px', borderRadius: 8, background: C.elevated, border: `1px solid ${C.border}`, color: C.textPrim, fontFamily: SANS, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <ol style={{ margin: '14px 0 0', paddingLeft: 18, fontSize: '0.8rem', color: C.textSec, lineHeight: 1.7 }}>
          {steps.map(s => <li key={s}>{s}</li>)}
        </ol>
      </Card>

      <form onSubmit={submit} style={{ marginTop: 16, display: 'grid', gap: 14 }}>
        <div>
          <label htmlFor="trx" style={labelStyle}>Transaction ID</label>
          <input id="trx" required value={trxId} onChange={e => setTrxId(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="e.g. 9H7K2LM4QX" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="snd" style={labelStyle}>bKash number you sent from (optional)</label>
          <input id="snd" value={sender} onChange={e => setSender(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="shot" style={labelStyle}>Payment screenshot (optional, JPG/PNG/WebP, max 5 MB)</label>
          <input id="shot" ref={fileRef} type="file" accept={TYPES.join(',')} onChange={e => pickFile(e.target.files?.[0] ?? null)} style={{ ...inputStyle, fontSize: 14 }} />
          {fileError && <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: C.red }}>{fileError}</p>}
        </div>
        {error && <p role="alert" style={{ margin: 0, fontSize: '0.8rem', color: C.red }}>{error}</p>}
        {note && <p style={{ margin: 0, fontSize: '0.75rem', color: C.textMuted }}>{note}</p>}
        <button type="submit" disabled={busy || !trxId.trim()} style={{ ...btnStyle, opacity: busy || !trxId.trim() ? 0.6 : 1 }}>
          {busy ? 'Sending…' : 'Submit payment'}
        </button>
      </form>
    </Shell>
  );
}
