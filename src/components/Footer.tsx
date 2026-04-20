'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Mail, Phone } from 'lucide-react';

const quickLinks = [
  { label: 'Home', href: '/' },
  { label: 'Programs', href: '/program' },
  { label: 'Eligibility Checker', href: '/eligibility-checker' },
  { label: 'Registration', href: '/registration' },
];

const programLinks = [
  { label: 'IBA DU', href: '/program#iba' },
  { label: 'BUP IBA / BBA', href: '/program#iba' },
  { label: 'DU FBS (C-Unit)', href: '/program#fbs' },
  { label: 'BUP FBS', href: '/program#fbs' },
];

const Footer = () => {
  return (
    <footer className="relative bg-[#0F0305] text-[#FAF5EF] overflow-hidden">
      {/* Grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Warm glow bottom */}
      <div
        className="absolute bottom-0 inset-x-0 h-[60%] opacity-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(212,176,148,0.15), transparent 70%)',
        }}
      />

      {/* Top horizon rule */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#D4B094]/40 to-transparent" />

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pt-24 pb-10">
        {/* Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16 mb-20">
          {/* Quick links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="md:col-span-4"
          >
            <h4 className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-5">
              Sections
            </h4>
            <ul className="space-y-3">
              {quickLinks.map((l) => (
                <li key={l.label}>
                  <FooterLink href={l.href}>{l.label}</FooterLink>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Programs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="md:col-span-4"
          >
            <h4 className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-5">
              Programs
            </h4>
            <ul className="space-y-3">
              {programLinks.map((l) => (
                <li key={l.label}>
                  <FooterLink href={l.href}>{l.label}</FooterLink>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="md:col-span-4"
          >
            <h4 className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-5">
              Correspondence
            </h4>
            <div className="space-y-4">
              <a
                href="mailto:ahnafahad@vh-beyondthehorizons.org"
                className="group flex items-start gap-3 text-sm text-[#FAF5EF]/60 hover:text-[#FAF5EF] transition-colors"
              >
                <Mail
                  className="w-4 h-4 mt-0.5 text-[#D4B094]/70 group-hover:text-[#D4B094] flex-shrink-0 transition-colors"
                  strokeWidth={1.5}
                />
                <span className="break-all">ahnafahad@vh-beyondthehorizons.org</span>
              </a>
              <a
                href="tel:+8801234567890"
                className="group flex items-center gap-3 text-sm text-[#FAF5EF]/60 hover:text-[#FAF5EF] transition-colors"
              >
                <Phone
                  className="w-4 h-4 text-[#D4B094]/70 group-hover:text-[#D4B094] transition-colors"
                  strokeWidth={1.5}
                />
                +880 1234 567 890
              </a>
              <div className="flex items-start gap-3 text-sm text-[#FAF5EF]/40 leading-relaxed">
                <span className="w-4 h-px bg-[#D4B094]/40 mt-2.5 flex-shrink-0" />
                <span>
                  House 31/A, Road 6
                  <br />
                  Dhanmondi R/A, Dhaka
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </footer>
  );
};

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center font-sans text-sm text-[#FAF5EF]/55 hover:text-[#FAF5EF] transition-colors duration-300"
    >
      <span className="relative">
        {children}
        <span className="absolute left-0 -bottom-0.5 h-px w-0 bg-[#D4B094] transition-all duration-400 group-hover:w-full" />
      </span>
    </Link>
  );
}

export default Footer;
