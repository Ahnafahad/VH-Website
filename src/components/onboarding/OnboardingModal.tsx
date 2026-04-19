'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, Check, X } from 'lucide-react';

type Props = {
  needsOnboarding: boolean;
  mustSubmit: boolean;
  userName: string;
  initialSkips: number;
};

const BLACKLIST_PREFIXES = ['/admin', '/registration', '/auth', '/api', '/onboarding', '/vocab'];
const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/LBdtaxyUP6w1S7npTrFli6';

export default function OnboardingModal({
  needsOnboarding,
  mustSubmit,
  userName,
  initialSkips,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'ask' | 'success'>('ask');
  const [whatsapp, setWhatsapp] = useState('');
  const [skips, setSkips] = useState(initialSkips);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = (userName || '').split(' ')[0] || 'friend';
  const canSkip = skips < 3 && !mustSubmit;
  const pathBlocked = BLACKLIST_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!needsOnboarding || pathBlocked) {
      setOpen(false);
      return;
    }
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [needsOnboarding, pathBlocked]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[+\s\d-]{6,20}$/.test(whatsapp.trim())) {
      setError('Enter a valid WhatsApp number');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: whatsapp.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Something went wrong');
      setPhase('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (!canSkip) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/skip', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Skip failed');
      setSkips(json.skips ?? skips + 1);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Skip failed');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismiss() {
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
          style={{
            backgroundColor: 'rgba(26, 5, 7, 0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={phase === 'success' ? handleDismiss : undefined}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring' as const, stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-[#FAF5EF] text-[#1A0507] shadow-[0_40px_120px_-30px_rgba(90,11,15,0.55)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 35px, #1A0507 35px, #1A0507 36px)',
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,176,148,0.30), transparent 60%)',
              }}
            />

            <span className="pointer-events-none absolute top-5 left-5 h-px w-5 bg-[#A86E58]/60" />
            <span className="pointer-events-none absolute top-5 left-5 h-5 w-px bg-[#A86E58]/60" />
            <span className="pointer-events-none absolute bottom-5 right-5 h-px w-5 bg-[#A86E58]/60" />
            <span className="pointer-events-none absolute bottom-5 right-5 h-5 w-px bg-[#A86E58]/60" />

            {phase === 'success' && (
              <button
                onClick={handleDismiss}
                className="absolute right-4 top-4 z-10 rounded-full p-2 text-[#1A0507]/40 transition-colors hover:bg-[#1A0507]/5 hover:text-[#1A0507]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="relative px-8 pb-8 pt-10 sm:px-12 sm:pb-10 sm:pt-12">
              <AnimatePresence mode="wait">
                {phase === 'ask' ? (
                  <motion.div
                    key="ask"
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.35 }}
                  >
                    <div className="mb-6 flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.3em] text-[#A86E58]">
                      <span className="h-px w-6 bg-[#A86E58]" />
                      A small favour
                    </div>

                    <h2 className="font-heading text-[clamp(1.75rem,4vw,2.5rem)] font-light leading-[1.05] tracking-[-0.015em]">
                      Nice to have you, <em className="font-extralight text-[#760F13]">{firstName}</em>.
                    </h2>

                    <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-[#1A0507]/65 sm:text-base">
                      You&rsquo;re in — use the games and resources freely. Leave your WhatsApp
                      so we can tell you when the 2026 cohort opens, and you can lock in the
                      Early-bird advantage.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                      <div>
                        <label className="mb-2 block font-sans text-[10px] uppercase tracking-[0.25em] text-[#A86E58]">
                          WhatsApp number
                        </label>
                        <input
                          type="tel"
                          autoFocus
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          placeholder="+8801XXXXXXXXX"
                          className="w-full border-b border-[#1A0507]/25 bg-transparent pb-2 font-sans text-lg text-[#1A0507] placeholder:text-[#1A0507]/30 focus:border-[#760F13] focus:outline-none"
                        />
                        {error && (
                          <p className="mt-2 font-sans text-xs text-[#760F13]">{error}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="group relative inline-flex items-center gap-3 rounded-full bg-[#1A0507] px-7 py-3 font-sans text-sm text-[#FAF5EF] transition-all duration-300 hover:bg-[#760F13] disabled:opacity-50"
                        >
                          {submitting ? 'Saving…' : 'Save my number'}
                          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
                        </button>

                        {canSkip ? (
                          <button
                            type="button"
                            onClick={handleSkip}
                            disabled={submitting}
                            className="font-sans text-xs uppercase tracking-[0.2em] text-[#1A0507]/50 transition-colors hover:text-[#1A0507] disabled:opacity-50"
                          >
                            Maybe later{' '}
                            <span className="ml-1 normal-case tracking-normal text-[#1A0507]/30">
                              ({3 - skips} left)
                            </span>
                          </button>
                        ) : (
                          <span className="font-sans text-[11px] italic text-[#760F13]/70">
                            Required this time.
                          </span>
                        )}
                      </div>
                    </form>

                    <div className="mt-8 border-t border-[#A86E58]/20 pt-6">
                      <Link
                        href="/registration/courses"
                        className="group inline-flex items-center gap-2 font-heading text-sm italic font-extralight text-[#760F13] transition-colors hover:text-[#1A0507]"
                      >
                        Actually, I want to register for the full program
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.35 }}
                  >
                    <div className="mb-6 flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.3em] text-[#A86E58]">
                      <span className="h-px w-6 bg-[#A86E58]" />
                      You&rsquo;re in
                    </div>

                    <h2 className="font-heading text-[clamp(1.75rem,4vw,2.5rem)] font-light leading-[1.05] tracking-[-0.015em]">
                      Saved.{' '}
                      <em className="font-extralight text-[#760F13]">One more thing.</em>
                    </h2>

                    <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-[#1A0507]/65 sm:text-base">
                      Join the WhatsApp group. This is where we share cohort updates, the
                      Early-bird advantage, and all the good stuff first.
                    </p>

                    <div className="mt-8 rounded-2xl border border-[#D4B094]/50 bg-white/70 p-6 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                        <div className="shrink-0 overflow-hidden rounded-xl border border-[#A86E58]/20 bg-white p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/whatsapp-qr.png"
                            alt="WhatsApp group QR"
                            className="h-32 w-32 sm:h-36 sm:w-36"
                          />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <p className="font-heading text-base italic font-extralight text-[#1A0507]">
                            Scan or tap to join.
                          </p>
                          <a
                            href={WHATSAPP_GROUP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group mt-4 inline-flex items-center gap-2 rounded-full bg-[#1A0507] px-5 py-2.5 font-sans text-xs uppercase tracking-[0.15em] text-[#FAF5EF] transition-all duration-300 hover:bg-[#760F13]"
                          >
                            Open WhatsApp group
                            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 font-sans text-xs text-[#1A0507]/50">
                        <Check className="h-3.5 w-3.5 text-[#760F13]" strokeWidth={2} />
                        Number saved
                      </div>
                      <button
                        onClick={handleDismiss}
                        className="font-sans text-xs uppercase tracking-[0.2em] text-[#1A0507]/70 transition-colors hover:text-[#1A0507]"
                      >
                        Continue →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
