'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';

export default function LockedBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 280, damping: 26 }}
      className="relative overflow-hidden rounded-2xl border border-[#D4B094]/40 bg-gradient-to-br from-[#FAF5EF] to-[#F5EDE3] p-6 sm:p-8 mb-8"
    >
      {/* Decorative watermark */}
      <div
        className="absolute right-6 top-1/2 -translate-y-1/2 text-[120px] font-heading font-light text-[#D4B094]/10 select-none pointer-events-none leading-none"
        aria-hidden
      >
        VH
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#F5EDE3] border border-[#D4B094]/30 flex items-center justify-center">
          <Lock className="w-5 h-5 text-[#A86E58]" strokeWidth={1.5} />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-xl font-semibold text-[#1A0507] mb-1">
            LMS access not activated
          </h2>
          <p className="text-sm text-[#5A0B0F]/70 leading-relaxed max-w-xl">
            Your account doesn&apos;t have an LMS product yet. Register for an IBA programme to unlock live classes,
            homework, recordings, and more. Your games and test results below are always available.
          </p>
        </div>

        <motion.div
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring' as const, stiffness: 360, damping: 28 }}
          className="flex-shrink-0"
        >
          <Link
            href="/registration"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#760F13] hover:bg-[#5A0B0F] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Register now
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
