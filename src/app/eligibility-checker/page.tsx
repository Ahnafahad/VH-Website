'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import EligibilityChecker from '@/components/EligibilityChecker';

export default function EligibilityCheckerPage() {
  return (
    <div className="min-h-screen bg-[#1A0507]">
      {/* Nav bar */}
      <div className="sticky top-0 z-20 bg-[#1A0507]/90 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2 text-[#D4B094]/70 hover:text-[#D4B094] transition-colors text-sm"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back
          </Link>
          <div className="text-center">
            <span className="text-xs tracking-[0.25em] uppercase text-[#D4B094]/50">
              VH · Eligibility Checker
            </span>
          </div>
          <div className="w-16" />
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-4 text-center">
        <p className="text-xs tracking-[0.35em] uppercase text-[#D4B094]/50 mb-5">
          2025 Admissions
        </p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-light text-[#FAF5EF] leading-[1.05] tracking-[-0.02em]">
          Are you eligible?
        </h1>
        <p className="mt-5 text-base text-[#FAF5EF]/40 max-w-xl mx-auto leading-relaxed">
          Enter your O/A Level results once and instantly see which universities you qualify for.
        </p>
      </div>

      {/* Checker */}
      <EligibilityChecker />

      {/* Footer */}
      <div className="border-t border-white/[0.06] py-10 text-center">
        <p className="text-xs text-[#FAF5EF]/25 mb-3">Questions about eligibility?</p>
        <a
          href="https://wa.me/8801915424939?text=Hi%20VH%20Beyond%20the%20Horizons!%20I%20have%20questions%20about%20eligibility."
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#D4B094]/60 hover:text-[#D4B094] transition-colors"
        >
          Contact us on WhatsApp →
        </a>
      </div>
    </div>
  );
}
