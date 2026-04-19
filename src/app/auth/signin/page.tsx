'use client';

import { signIn, getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';

function SignInForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  useEffect(() => {
    getSession().then((s) => {
      if (s) router.push(callbackUrl);
    });
  }, [router, callbackUrl]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#1A0507] text-[#FAF5EF] overflow-hidden flex items-center justify-center px-6">
      {/* Grain overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Warm radial glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 60%, rgba(212,176,148,0.18), transparent 65%)',
        }}
      />

      {/* Ledger lines */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, #D4B094 39px, #D4B094 40px)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex justify-center mb-12"
        >
          <Image
            src="/vh-logo-transparent.png"
            alt="VH Beyond the Horizons"
            width={140}
            height={46}
            className="h-10 w-auto opacity-90"
            priority
          />
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl overflow-hidden border border-[#D4B094]/20 bg-[#FAF5EF]/[0.06] backdrop-blur-sm p-8 sm:p-10"
        >
          {/* Corner brackets */}
          <span className="absolute top-4 left-4 w-4 h-px bg-[#D4B094]/50" />
          <span className="absolute top-4 left-4 w-px h-4 bg-[#D4B094]/50" />
          <span className="absolute bottom-4 right-4 w-4 h-px bg-[#D4B094]/50" />
          <span className="absolute bottom-4 right-4 w-px h-4 bg-[#D4B094]/50" />

          {/* Chapter mark */}
          <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094] mb-6 flex items-center gap-3">
            <span className="w-6 h-px bg-[#D4B094]" />
            Access
          </div>

          <h1 className="font-heading font-light text-[#FAF5EF] text-3xl sm:text-4xl leading-[1.05] tracking-[-0.015em] mb-3">
            Welcome back.
          </h1>
          <p className="font-heading italic font-extralight text-[#D4B094]/80 text-base mb-10">
            Sign in to continue.
          </p>

          {/* Google sign-in button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group relative w-full flex items-center justify-center gap-3 rounded-full bg-[#FAF5EF] text-[#1A0507] px-7 py-4 font-sans text-sm font-medium tracking-wide transition-all duration-400 hover:bg-white hover:shadow-[0_12px_40px_-10px_rgba(212,176,148,0.45)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin text-[#1A0507]/60"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Signing in…</span>
              </>
            ) : (
              <>
                {/* Google G */}
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <p className="mt-6 text-center font-sans text-[11px] text-[#FAF5EF]/35 leading-relaxed">
            Use your Gmail account. New here?{' '}
            <span className="text-[#D4B094]/70">
              Access is created automatically.
            </span>
          </p>
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-8 text-center font-sans text-[10px] tracking-[0.25em] uppercase text-[#FAF5EF]/25"
        >
          VH · Beyond the Horizons · Dhaka
        </motion.p>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
