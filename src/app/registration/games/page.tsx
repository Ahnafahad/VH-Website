'use client';

import { useState, type FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowUpRight, Check, Loader2 } from 'lucide-react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function FreeSignupPage() {
  return (
    <Suspense>
      <FreeSignupForm />
    </Suspense>
  );
}

function FreeSignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/vocab/home';
  const signinUrl = `/auth/signin?callbackUrl=${encodeURIComponent(next)}`;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const canSubmit =
    name.trim().length > 1 &&
    email.trim().toLowerCase().endsWith('@gmail.com') &&
    /^[+\s\d-]{6,20}$/.test(whatsapp.trim()) &&
    status !== 'submitting';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/registrations/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), whatsapp: whatsapp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Something went wrong. Try again.');
      }
      setAlreadyRegistered(Boolean(data.alreadyRegistered));
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="relative min-h-screen bg-[#FAF5EF] text-[#1A0507] overflow-hidden">
      {/* Editorial baseline grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, #1A0507 39px, #1A0507 40px)',
        }}
      />
      {/* Warm radial glow */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212,176,148,0.18), transparent 60%)',
        }}
      />

      <div className="relative max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 pb-16 sm:pt-28">
        {/* Chapter mark */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#A86E58] mb-6 flex items-center gap-3"
        >
          <span className="w-8 h-px bg-[#A86E58]" />
          Chapter Zero / Free Access
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* LEFT — editorial headline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6"
          >
            <h1 className="font-heading text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.92] tracking-[-0.02em] font-light">
              Play the games.
              <br />
              <em className="font-extralight text-[#760F13]">Use the resources.</em>
            </h1>

            <p className="mt-8 font-sans text-base sm:text-lg text-[#1A0507]/70 leading-relaxed max-w-md">
              Free, forever. No strings. We built the games for ourselves during our own admissions.
              Now they&rsquo;re yours.
            </p>

            {/* Quiet feature list */}
            <ul className="mt-10 space-y-3 max-w-sm">
              {[
                'Mental math drills, daily.',
                'LexiCore vocabulary with spaced repetition.',
                'Free resources as we publish them.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[#1A0507]/80 font-sans text-sm">
                  <span className="mt-2 w-4 h-px bg-[#A86E58]" />
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-12 flex items-center gap-4 text-[#A86E58]">
              <span className="font-heading italic text-xs">00 — 03</span>
              <span className="flex-1 h-px bg-[#A86E58]/20" />
              <Link
                href="/registration/courses"
                className="group inline-flex items-center gap-2 font-sans text-xs tracking-[0.25em] uppercase text-[#760F13] hover:text-[#1A0507] transition-colors"
              >
                Looking for the full program
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </motion.div>

          {/* RIGHT — form card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6"
          >
            <div className="relative rounded-2xl border border-[#D4B094]/40 bg-white/70 backdrop-blur-sm p-8 sm:p-10 overflow-hidden">
              {/* Corner brackets */}
              <span className="absolute top-5 left-5 w-4 h-px bg-[#A86E58]/50" />
              <span className="absolute top-5 left-5 w-px h-4 bg-[#A86E58]/50" />
              <span className="absolute bottom-5 right-5 w-4 h-px bg-[#A86E58]/50" />
              <span className="absolute bottom-5 right-5 w-px h-4 -translate-y-4 bg-[#A86E58]/50" />

              {/* Ghost number */}
              <span
                aria-hidden
                className="absolute -top-4 -right-2 font-heading italic text-[#D4B094]/25 text-[6rem] font-extralight leading-none pointer-events-none select-none"
              >
                00
              </span>

              <div className="relative">
                <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-6">
                  30 seconds
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl font-light leading-tight tracking-[-0.01em] mb-2">
                  Create your access.
                </h2>
                <p className="font-heading italic text-[#760F13]/80 text-base font-extralight mb-8">
                  Gmail and a WhatsApp, that&rsquo;s it.
                </p>

                <AnimatePresence mode="wait" initial={false}>
                  {status !== 'success' ? (
                    <motion.form
                      key="form"
                      onSubmit={handleSubmit}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-5"
                    >
                      <EditorialInput
                        label="Name"
                        id="name"
                        type="text"
                        value={name}
                        onChange={setName}
                        placeholder="Your name"
                        autoComplete="name"
                      />
                      <EditorialInput
                        label="Gmail"
                        id="email"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="you@gmail.com"
                        autoComplete="email"
                        helperText={'Must be a @gmail.com \u2014 you\u2019ll sign in with Google.'}
                      />
                      <EditorialInput
                        label="WhatsApp"
                        id="whatsapp"
                        type="tel"
                        value={whatsapp}
                        onChange={setWhatsapp}
                        placeholder="+880 1XXX XXXXXX"
                        autoComplete="tel"
                        helperText={'We\u2019ll only message you about new resources. No spam.'}
                      />

                      {status === 'error' && (
                        <p className="font-sans text-xs text-[#760F13]">{errorMsg}</p>
                      )}

                      <button
                        type="submit"
                        disabled={!canSubmit}
                        className="group/cta relative inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#1A0507] text-[#FAF5EF] px-8 py-4 font-sans text-sm font-medium tracking-wide transition-all duration-500 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-[#760F13] enabled:hover:shadow-[0_10px_40px_-10px_rgba(90,11,15,0.4)]"
                      >
                        {status === 'submitting' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating your access
                          </>
                        ) : (
                          <>
                            <span className="relative overflow-hidden">
                              <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:-translate-y-full">
                                Create access
                              </span>
                              <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-y-0">
                                Create access
                              </span>
                            </span>
                            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover/cta:translate-x-1" />
                          </>
                        )}
                      </button>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-[#1A0507] text-[#FAF5EF] flex items-center justify-center">
                          <Check className="w-4 h-4" strokeWidth={2} />
                        </span>
                        <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58]">
                          {alreadyRegistered ? 'Welcome back' : 'You\u2019re in'}
                        </span>
                      </div>

                      <h3 className="font-heading text-2xl sm:text-3xl font-light leading-tight">
                        {alreadyRegistered
                          ? 'This Gmail is already registered.'
                          : 'Sign in with Google to start.'}
                      </h3>

                      <p className="font-sans text-sm text-[#1A0507]/70 leading-relaxed">
                        {alreadyRegistered
                          ? 'Just sign in with the same Google account to pick up where you left off.'
                          : 'Use the same Gmail you just entered. Your account is ready.'}
                      </p>

                      <Link
                        href={signinUrl}
                        className="group/cta relative inline-flex items-center gap-3 rounded-full bg-[#1A0507] text-[#FAF5EF] px-7 py-3.5 font-sans text-sm font-medium tracking-wide transition-all duration-500 hover:bg-[#760F13] hover:shadow-[0_10px_40px_-10px_rgba(90,11,15,0.4)]"
                      >
                        Sign in with Google
                        <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover/cta:translate-x-1" />
                      </Link>

                      <Link
                        href="/"
                        className="group inline-flex items-center gap-3 font-sans text-xs tracking-[0.2em] uppercase text-[#A86E58] hover:text-[#1A0507] transition-colors ml-4"
                      >
                        <span className="w-6 h-px bg-current transition-all duration-300 group-hover:w-10" />
                        Return home
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function EditorialInput({
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  helperText,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  helperText?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-2"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-transparent border-0 border-b border-[#1A0507]/20 py-3 px-0 font-heading text-xl text-[#1A0507] placeholder-[#1A0507]/25 focus:outline-none focus:border-[#760F13] transition-colors"
      />
      {helperText && (
        <p className="mt-2 font-sans text-[11px] text-[#A86E58]/90">
          {helperText}
        </p>
      )}
    </div>
  );
}
