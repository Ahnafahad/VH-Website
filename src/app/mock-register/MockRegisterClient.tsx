'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import type { MyMockRegistration } from '@/lib/mocks/registration';
import {
  MOCK_FEATURES, MOCK_FEE_BDT, MOCK_SCHEDULE, MOCK_SUBJECTS, formatSlotTime, nextMock, slotDay,
} from '@/lib/mocks/registration-pure';
import { CopyRow, EnrolCard, Field, Folio, LABEL, Line, Pill, Reveal, textLink } from './parts';
import './mock-register.css';

type View =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: MyMockRegistration };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Something went wrong. Try again.');
  return json;
}

const fee = MOCK_FEE_BDT.toLocaleString('en-US');
const STEPS = ['Sign in with Google', 'Your phone number', 'Payment', 'Verification'] as const;

/** 1-4 = the step the student is on; 5 = approved. */
function stepOf(view: View): number {
  if (view.kind !== 'ready') return 1;
  const r = view.data.registration;
  if (!r) return 2;
  if (r.status === 'approved') return 5;
  if (r.status === 'submitted') return 4;
  return 3;
}

const goRegister = () => document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const startGoogle = () => signIn('google', { callbackUrl: '/mock-register#register' });

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero({ view, onGoogle, busy }: { view: View; onGoogle: () => void; busy: boolean }) {
  const step = stepOf(view);
  const cta =
    view.kind === 'signed-out' || view.kind === 'loading' || view.kind === 'error'
      ? <Pill onClick={onGoogle} busy={busy}>Reserve my seat</Pill>
      : <Pill onClick={goRegister}>{step === 5 ? 'See my access' : step === 4 ? 'Track my registration' : 'Continue registration'}</Pill>;
  return (
    <section className="relative">
      <div aria-hidden className="mr-ledger pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-[92svh] max-w-[1400px] flex-col justify-between px-5 pb-10 pt-32 sm:px-10 sm:pt-36 lg:px-16 lg:pb-14 lg:pt-44">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
          <h1 className="font-heading font-light leading-[0.92] tracking-[-0.03em] text-[clamp(3rem,8.5vw,7.5rem)] lg:col-span-7">
            <Line>Ten mocks.</Line>
            <Line delay={0.1}><em className="font-extralight text-[#760F13]">One November.</em></Line>
          </h1>
          <Reveal className="lg:col-span-4 lg:col-start-9 lg:pb-3" delay={0.35}>
            <p className="max-w-md font-sans text-base leading-relaxed text-[#1A0507]/72 sm:text-lg">
              The IBA mock routine: full-length papers in {MOCK_SUBJECTS[0]}, {MOCK_SUBJECTS[1]} and {MOCK_SUBJECTS[2]}, sat between 2 and 28 November.
              Register once and every mock is yours.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              {cta}
              <a href="#schedule" className={textLink}>See the schedule</a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.5} className="mt-16 grid grid-cols-1 border-t border-[#1A0507]/15 sm:grid-cols-3">
          {[
            ['10', 'full-length mocks'],
            ['2 – 28 Nov', '2026, Bangladesh time'],
            [`${fee} BDT`, 'one fee, all ten mocks'],
          ].map(([big, small]) => (
            <div key={big} className="border-b border-[#1A0507]/15 py-6 sm:border-b-0 sm:py-7 sm:pr-8">
              <p className="font-heading text-4xl font-light tracking-[-0.02em] sm:text-5xl">{big}</p>
              <p className={`${LABEL} mt-2`}>{small}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ── Schedule ────────────────────────────────────────────────────────────────

function Schedule() {
  const still = useReducedMotion();
  const list = useRef<HTMLOListElement>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const next = now ? nextMock(now) : null;

  const { scrollYProgress } = useScroll({ target: list, offset: ['start 72%', 'end 55%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  return (
    <section id="schedule" className="relative border-t border-[#1A0507]/10 bg-[#F5EDE3]">
      <Folio chapter="Chapter One" title="The routine" />
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-5 py-20 sm:px-10 lg:grid-cols-12 lg:gap-16 lg:px-16 lg:py-32">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <h2 className="font-heading font-light leading-[1] tracking-[-0.025em] text-[clamp(2.25rem,4.5vw,4rem)]">
              Ten papers, <em className="font-extralight text-[#760F13]">four weeks.</em>
            </h2>
            <p className="mt-6 max-w-sm font-sans text-base leading-relaxed text-[#1A0507]/72">
              Every mock is a full-length IBA paper. Weekdays run in the afternoon or late morning, Saturdays early.
              All times are Bangladesh time.
            </p>
            {next && (
              <p className="mt-8 border-t border-[#1A0507]/15 pt-5 font-sans text-sm text-[#1A0507]/80">
                <span className={LABEL}>Up next</span>
                <span className="mt-1 block font-heading text-2xl font-light">
                  Mock {String(next.n).padStart(2, '0')}, {slotDay(next.date).weekday} {slotDay(next.date).day} {slotDay(next.date).month}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="relative lg:col-span-7 lg:col-start-6">
          <span aria-hidden className="absolute bottom-0 left-0 top-0 w-px bg-[#1A0507]/12" />
          <motion.span
            aria-hidden
            className="absolute bottom-0 left-0 top-0 w-px origin-top bg-[#760F13]"
            style={{ scaleY: still ? 1 : fill }}
          />
          <ol ref={list} className="pl-6 sm:pl-10">
            {MOCK_SCHEDULE.map(s => {
              const d = slotDay(s.date);
              const isNext = next?.n === s.n;
              const over = !!now && !!next && s.n < next.n;
              return (
                <Reveal as="li" key={s.n} className={`grid grid-cols-[3.25rem_1fr_auto] items-baseline gap-x-3 border-b border-[#1A0507]/12 py-5 sm:grid-cols-[4.5rem_1fr_auto] sm:py-6 ${over ? 'opacity-45' : ''}`}>
                  <span className="font-heading text-4xl font-light tabular-nums text-[#760F13] sm:text-5xl">{String(s.n).padStart(2, '0')}</span>
                  <span>
                    <span className="block font-heading text-xl font-light sm:text-2xl">{d.weekday}</span>
                    <span className="block font-sans text-sm text-[#1A0507]/68">{d.day} {d.month} {d.year}</span>
                  </span>
                  <span className="text-right font-sans text-sm text-[#1A0507]/85 sm:text-base">
                    {formatSlotTime(s.time)}
                    {isNext && <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.25em] text-[#760F13]">Up next</span>}
                  </span>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ── What you get ────────────────────────────────────────────────────────────

function Included() {
  return (
    <section className="mr-dark relative isolate overflow-hidden bg-[#1A0507] text-[#FAF5EF]">
      <div aria-hidden className="mr-grain pointer-events-none absolute inset-0 -z-10" />
      <Folio chapter="Chapter Two" title="What you get" dark />
      <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-10 lg:px-16 lg:py-32">
        <h2 className="max-w-3xl font-heading font-light leading-[1] tracking-[-0.025em] text-[clamp(2.25rem,5vw,4.5rem)]">
          Not just a score. <em className="font-extralight text-[#D4B094]">A way to read it.</em>
        </h2>

        <ul className="mt-14 border-b border-[#D4B094]/20 lg:mt-20">
          {MOCK_FEATURES.map((f, i) => (
            <Reveal as="li" key={f.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-2 border-t border-[#D4B094]/20 py-7 sm:grid-cols-[4rem_1fr_1fr] sm:gap-x-8 lg:py-9">
              <span className="font-sans text-xs font-medium tracking-[0.25em] text-[#D4B094]/80 sm:pt-2">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-heading text-2xl font-light sm:text-3xl">{f.title}</h3>
              <p className="col-start-2 font-sans text-base leading-relaxed text-[#FAF5EF]/72 sm:col-start-3">{f.body}</p>
            </Reveal>
          ))}
        </ul>

        <Reveal className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:mt-24 lg:gap-16">
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.28em] text-[#D4B094]/85">With your registration</p>
            <p className="mt-3 font-heading text-3xl font-light sm:text-4xl">LexiCore, free for 30 days</p>
            <p className="mt-3 max-w-md font-sans text-base leading-relaxed text-[#FAF5EF]/72">
              Our vocabulary app: short daily practice on the words that matter for admission tests, with spaced review. Full access, not the trial set.
            </p>
          </div>
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.28em] text-[#D4B094]/85">And</p>
            <p className="mt-3 font-heading text-3xl font-light sm:text-4xl">Zap, the mental-math game</p>
            <p className="mt-3 max-w-md font-sans text-base leading-relaxed text-[#FAF5EF]/72">
              Quick rounds that build the speed you need in the Mathematics section.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Register ────────────────────────────────────────────────────────────────

function StepList({ step }: { step: number }) {
  return (
    <ol className="mt-10 max-w-sm border-b border-[#1A0507]/12">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <li key={label} aria-current={current ? 'step' : undefined} className={`flex items-center gap-4 border-t border-[#1A0507]/12 py-3.5 font-sans text-sm ${current ? 'text-[#1A0507]' : done ? 'text-[#1A0507]/60' : 'text-[#1A0507]/45'}`}>
            <span className={`w-6 font-heading text-lg tabular-nums ${current ? 'text-[#760F13]' : ''}`}>{String(n).padStart(2, '0')}</span>
            <span className={current ? 'font-medium' : ''}>{label}</span>
            {done && <span className="ml-auto text-xs uppercase tracking-[0.2em] text-[#A86E58]">Done</span>}
          </li>
        );
      })}
    </ol>
  );
}

function ErrorNote({ text }: { text: string }) {
  return <p role="alert" className="mt-4 border-l-2 border-[#760F13] pl-3 font-sans text-sm leading-relaxed text-[#760F13]">{text}</p>;
}

function GoogleStep({ onGoogle, busy }: { onGoogle: () => void; busy: boolean }) {
  return (
    <div>
      <h3 className="font-heading text-3xl font-light">Start with Google</h3>
      <p className="mt-3 font-sans text-base leading-relaxed text-[#1A0507]/72">
        Use the Gmail account you want your results and emails to go to. After this we only ask for your phone number.
      </p>
      <div className="mt-8"><Pill onClick={onGoogle} busy={busy}>Continue with Google</Pill></div>
    </div>
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
    <form onSubmit={submit}>
      <h3 className="font-heading text-3xl font-light">Your phone number</h3>
      <p className="mb-8 mt-3 font-sans text-base leading-relaxed text-[#1A0507]/72">So we can reach you about your mocks.</p>
      <Field label="Mobile number" id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={setPhone} placeholder="01XXXXXXXXX" helper="A Bangladeshi mobile number." />
      {err && <ErrorNote text={err} />}
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
        <Pill type="submit" busy={busy}>Continue to payment</Pill>
        <a href="#schedule" className={textLink}>Check the mock details</a>
      </div>
    </form>
  );
}

function PaymentStep({ data, onDone }: { data: MyMockRegistration; onDone: () => void }) {
  const [trxId, setTrxId] = useState(data.registration?.trxId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const rejected = data.registration?.status === 'rejected';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!trxId.trim() && !file && !data.registration?.hasScreenshot) { setErr('Enter the transaction ID or upload a screenshot.'); return; }
    setBusy(true);
    try {
      let screenshotKey: string | undefined;
      if (file) {
        const { key, uploadUrl } = await postJson('/api/mock-registration/screenshot', { fileName: file.name, contentType: file.type }) as { key: string; uploadUrl: string };
        const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!put.ok) throw new Error('Screenshot upload failed. Try again, or send just the transaction ID.');
        screenshotKey = key;
      }
      await postJson('/api/mock-registration/payment', { trxId, screenshotKey });
      onDone();
    } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit}>
      {rejected && (
        <div role="alert" className="mb-8 border-l-2 border-[#760F13] bg-[#F5EDE3] px-4 py-3 font-sans text-sm leading-relaxed">
          <b className="font-medium text-[#760F13]">We could not verify your last submission.</b>
          {data.registration?.note && <span className="mt-1 block text-[#1A0507]/80">{data.registration.note}</span>}
          <span className="mt-1 block text-[#1A0507]/70">Check the details below and submit again.</span>
        </div>
      )}
      <h3 className="font-heading text-3xl font-light">Pay {fee} BDT by bKash</h3>
      <p className="mb-6 mt-3 font-sans text-base leading-relaxed text-[#1A0507]/72">
        Open bKash, choose Send Money, and use exactly these details. The reference is how we match the payment to you.
      </p>
      <div>
        <CopyRow label="Amount (BDT)" value={fee} />
        <CopyRow label="bKash personal number" value={data.bkashNumber} />
        <CopyRow label="Reference" value={data.reference} />
      </div>

      <div className="mt-10 grid gap-8">
        <Field label="bKash transaction ID" id="trx" value={trxId} onChange={setTrxId} placeholder="e.g. 9A7B6C5D4E" caps helper="From the bKash confirmation message." />
        <div>
          <span className={LABEL}>Or a screenshot of the payment</span>
          <label htmlFor="shot" className="mt-2 flex min-h-12 cursor-pointer items-center justify-between gap-4 border-b border-[#1A0507]/30 py-2 font-heading text-xl text-[#1A0507] transition-colors hover:border-[#1A0507]/55">
            <span className={file ? '' : 'font-light italic text-[#1A0507]/55'}>{file ? file.name : 'Choose an image'}</span>
            <span className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-[#760F13]">Browse</span>
          </label>
          <input id="shot" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
        </div>
      </div>
      {err && <ErrorNote text={err} />}
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
        <Pill type="submit" busy={busy}>Submit for verification</Pill>
        <a href="#schedule" className={textLink}>Check the mock details</a>
      </div>
    </form>
  );
}

function AwaitingStep({ data }: { data: MyMockRegistration }) {
  return (
    <div>
      <p className="flex items-center gap-3 font-sans text-[10px] font-medium uppercase tracking-[0.28em] text-[#760F13]">
        <span aria-hidden className="mr-pulse h-2 w-2 rounded-full bg-[#760F13]" />Awaiting verification
      </p>
      <h3 className="mt-4 font-heading text-3xl font-light">We have your payment details</h3>
      <p className="mt-3 font-sans text-base leading-relaxed text-[#1A0507]/72">
        We are checking them against bKash. The mock schedule is on its way to <b className="font-medium text-[#1A0507]">{data.email}</b>,
        and a second email follows the moment you are approved. You can leave this page; come back any time to see where it stands.
      </p>
      <div className="mt-8">
        <div className="border-t border-[#1A0507]/12 py-4">
          <p className={LABEL}>Reference</p>
          <p className="mt-1 break-all font-heading text-xl font-light">{data.reference}</p>
        </div>
        <div className="border-y border-[#1A0507]/12 py-4">
          <p className={LABEL}>Transaction ID</p>
          <p className="mt-1 break-all font-heading text-xl font-light">{data.registration?.trxId ?? 'Screenshot sent'}</p>
        </div>
      </div>
      <p className="mt-8"><a href="#schedule" className={textLink}>Check the mock details</a></p>
    </div>
  );
}

function ApprovedStep({ data }: { data: MyMockRegistration }) {
  const until = data.registration?.accessUntil
    ? new Date(data.registration.accessUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' })
    : null;
  return (
    <div>
      <p className="font-sans text-[10px] font-medium uppercase tracking-[0.28em] text-[#760F13]">Approved</p>
      <h3 className="mt-4 font-heading text-3xl font-light">You are in.</h3>
      <p className="mt-3 font-sans text-base leading-relaxed text-[#1A0507]/72">
        Your payment is verified. LexiCore{until && <> is fully open until {until}</>} and Zap is open too. Your mock schedule is above.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
        <Pill href="/vocab/home">Open LexiCore</Pill>
        <Link href="/games/mental-math" className={textLink}>Play Zap</Link>
      </div>
    </div>
  );
}

function Register({ view, step, onDone, onGoogle, busy }: { view: View; step: number; onDone: () => void; onGoogle: () => void; busy: boolean }) {
  const card = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    card.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
  }, [step, still]);

  let body: React.ReactNode;
  if (view.kind === 'loading') body = <div aria-busy className="grid gap-4"><div className="h-8 w-2/3 bg-[#1A0507]/8" /><div className="h-4 w-full bg-[#1A0507]/6" /><div className="h-4 w-5/6 bg-[#1A0507]/6" /></div>;
  else if (view.kind === 'error') body = <ErrorNote text={view.message} />;
  else if (view.kind === 'signed-out') body = <GoogleStep onGoogle={onGoogle} busy={busy} />;
  else if (step === 2) body = <PhoneStep onDone={onDone} />;
  else if (step === 3) body = <PaymentStep data={view.data} onDone={onDone} />;
  else if (step === 4) body = <AwaitingStep data={view.data} />;
  else body = <ApprovedStep data={view.data} />;

  const who = view.kind === 'ready' ? view.data : null;
  return (
    <section id="register" className="relative border-t border-[#1A0507]/10 bg-[#FAF5EF]">
      <div aria-hidden className="mr-ledger pointer-events-none absolute inset-0" />
      <Folio chapter="Chapter Three" title="Reserve your seat" />
      <div className="relative mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-5 py-20 sm:px-10 lg:grid-cols-12 lg:gap-16 lg:px-16 lg:py-32">
        <div className="lg:col-span-5">
          <h2 className="font-heading font-light leading-[1] tracking-[-0.025em] text-[clamp(2.25rem,4.5vw,4rem)]">
            Reserve <em className="font-extralight text-[#760F13]">your seat.</em>
          </h2>
          <p className="mt-6 max-w-sm font-sans text-base leading-relaxed text-[#1A0507]/72">
            Four short steps, about two minutes. Registering opens all ten mocks, {fee} BDT in total.
          </p>
          <StepList step={step} />
          <p className="mt-8 font-sans text-sm text-[#1A0507]/70">
            Questions? WhatsApp{' '}
            <a className="text-[#760F13] underline underline-offset-4" href="https://wa.me/8801835200626" target="_blank" rel="noreferrer">+880 1835-200626</a>.
          </p>
        </div>

        <div ref={card} className="lg:col-span-6 lg:col-start-7">
          <Reveal>
            <EnrolCard className="px-6 py-9 sm:px-10 sm:py-12">
              {who && (
                <div className="mb-8 border-b border-[#1A0507]/12 pb-5">
                  <p className={LABEL}>Registering as</p>
                  <p className="mt-1 font-heading text-2xl font-light">{who.name}</p>
                  <p className="font-sans text-sm text-[#1A0507]/68">{who.email}</p>
                </div>
              )}
              {body}
            </EnrolCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

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

  const onGoogle = () => { setBusy(true); void startGoogle(); };
  const step = stepOf(view);

  return (
    <main className="mr-root relative overflow-x-clip bg-[#FAF5EF] text-[#1A0507]">
      <Hero view={view} onGoogle={onGoogle} busy={busy} />
      <Schedule />
      <Included />
      <Register view={view} step={step} onDone={load} onGoogle={onGoogle} busy={busy} />
    </main>
  );
}
