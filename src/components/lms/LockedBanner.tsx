'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function LockedBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 280, damping: 26 }}
      className="relative overflow-hidden rounded-lg p-6 sm:p-8 mb-10"
      style={{
        border: '1px solid rgba(212,176,148,0.30)',
      }}
    >
      {/* Oversized Fraunces "VH" watermark */}
      <div
        className="absolute right-6 top-1/2 -translate-y-1/2 font-heading font-medium select-none pointer-events-none leading-none"
        aria-hidden
        style={{
          fontSize: 'clamp(80px, 15vw, 140px)',
          color: 'rgba(212,176,148,0.08)',
          letterSpacing: '-0.04em',
        }}
      >
        VH
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-1 min-w-0">
          <h2
            className="font-heading font-medium text-xl mb-2"
            style={{ color: '#FAF5EF', letterSpacing: '-0.01em' }}
          >
            LMS access not activated
          </h2>
          <p
            className="text-base leading-relaxed max-w-xl"
            style={{ color: 'rgba(250,245,239,0.64)' }}
          >
            Your account doesn&apos;t have an LMS product yet. Register for an IBA programme to
            unlock live classes, homework, recordings, and more.
          </p>
        </div>

        <div className="flex-shrink-0">
          <Link
            href="/registration"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-all"
            style={{ color: '#D4B094' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Register now
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
