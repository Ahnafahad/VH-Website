'use client';

import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

export const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_CSS = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

/** A headline line that rises out of its own clipping edge on arrival. */
export function Line({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const still = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.1em]">
      <motion.span
        className="block"
        initial={still ? false : { y: '108%' }}
        animate={{ y: 0 }}
        transition={{ duration: 1.1, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Settles into place once, the first time it scrolls into view. */
export function Reveal({ children, className = '', delay = 0, as = 'div' }: {
  children: ReactNode; className?: string; delay?: number; as?: 'div' | 'li';
}) {
  const still = useReducedMotion();
  const Tag = as === 'li' ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      initial={still ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/** The folio: a chapter's running head, vertical in the left margin on desktop, a foot on phones. */
export function Folio({ chapter, title, dark = false }: { chapter: string; title: string; dark?: boolean }) {
  const ink = dark ? 'text-[#D4B094]/80' : 'text-[#A86E58]';
  const rule = dark ? 'bg-[#D4B094]/40' : 'bg-[#A86E58]/45';
  return (
    <p
      className={`relative z-10 mx-5 mt-16 flex items-center gap-3 sm:mx-10 sm:mt-20 lg:absolute lg:bottom-auto lg:left-5 lg:top-36 lg:mx-0 lg:mt-0 lg:gap-4 lg:[writing-mode:vertical-rl] lg:rotate-180 xl:left-7 ${ink}`}
    >
      <span className="font-sans text-[10px] font-medium uppercase tracking-[0.3em]">{chapter}</span>
      <span aria-hidden className={`h-px w-6 lg:h-8 lg:w-px ${rule}`} />
      <span className="font-heading text-sm italic tracking-[0.01em] lg:text-[15px]">{title}</span>
    </p>
  );
}

type PillProps = { children: string; tone?: 'ink' | 'cream'; busy?: boolean } & (
  | { href: string; onClick?: never; type?: never }
  | { href?: never; onClick?: () => void; type?: 'button' | 'submit' }
);

/** The house button: a pill whose label and arrow swap on hover. */
export function Pill({ children, tone = 'ink', busy, href, onClick, type = 'button' }: PillProps) {
  const cls = `group/pill relative inline-flex min-h-12 items-center gap-3 rounded-full px-8 py-4 font-sans text-sm font-medium tracking-wide shadow-[0_10px_30px_-14px_rgba(90,11,15,0.5)] transition-[background-color,scale,opacity] duration-500 ${EASE_CSS} active:scale-[0.98] disabled:opacity-60 sm:px-9 sm:text-base ${
    tone === 'ink' ? 'bg-[#1A0507] text-[#FAF5EF] hover:bg-[#760F13]' : 'bg-[#FAF5EF] text-[#1A0507] hover:bg-[#D4B094]'
  }`;
  const inner = (
    <>
      <span className="relative overflow-hidden">
        <span className={`block transition-transform duration-500 ${EASE_CSS} group-hover/pill:-translate-y-full`}>{busy ? 'One moment…' : children}</span>
        <span aria-hidden className={`absolute inset-0 translate-y-full transition-transform duration-500 ${EASE_CSS} group-hover/pill:translate-y-0`}>
          {busy ? 'One moment…' : children}
        </span>
      </span>
      <span aria-hidden className="relative h-5 w-5 overflow-hidden">
        <ArrowUpRight className={`absolute inset-0 h-5 w-5 transition-transform duration-500 ${EASE_CSS} group-hover/pill:-translate-y-5 group-hover/pill:translate-x-5`} strokeWidth={1.5} />
        <ArrowUpRight className={`absolute inset-0 h-5 w-5 -translate-x-5 translate-y-5 transition-transform duration-500 ${EASE_CSS} group-hover/pill:translate-x-0 group-hover/pill:translate-y-0`} strokeWidth={1.5} />
      </span>
    </>
  );
  return href
    ? <a href={href} className={cls}>{inner}</a>
    : <button type={type} onClick={onClick} disabled={busy} className={cls}>{inner}</button>;
}

/** A quiet underlined text link/button. */
export const textLink =
  'font-sans text-sm text-[#1A0507]/75 underline decoration-[#A86E58]/60 underline-offset-4 transition-colors hover:text-[#760F13] hover:decoration-[#760F13]';

/** The printed card: cream stock, hairline edge, an inset frame like a pressed border. */
export function EnrolCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative bg-[#FAF5EF] border border-[#1A0507]/15 outline outline-1 -outline-offset-[7px] outline-[#D4B094]/45 shadow-[0_34px_70px_-42px_rgba(90,11,15,0.4),0_2px_6px_rgba(26,5,7,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export const LABEL = 'block font-sans text-[10px] font-medium uppercase tracking-[0.28em] text-[#1A0507]/70';

const FIELD =
  'mt-1 block min-h-12 w-full rounded-none border-0 border-b border-[#1A0507]/30 bg-transparent px-0 py-2 font-heading text-xl text-[#1A0507] placeholder:font-light placeholder:italic placeholder:text-[#1A0507]/55 transition-[border-color,box-shadow] duration-300 hover:border-[#1A0507]/55 focus:border-[#760F13] focus:shadow-[0_1px_0_0_#760F13] focus:outline-none';

/** A ruled entry line with its label above and its note below. */
export function Field({ label, id, value, onChange, type = 'text', placeholder, autoComplete, inputMode, helper, caps }: {
  label: string; id: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; autoComplete?: string; inputMode?: 'tel' | 'text'; helper?: string; caps?: boolean;
}) {
  const help = helper ? `${id}-help` : undefined;
  return (
    <div className="group/field">
      <label htmlFor={id} className={`${LABEL} transition-colors duration-300 group-focus-within/field:text-[#760F13]`}>{label}</label>
      <input
        id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete} inputMode={inputMode} aria-describedby={help}
        autoCapitalize={caps ? 'characters' : undefined}
        className={FIELD}
      />
      {helper && <p id={help} className="mt-2 font-sans text-xs leading-relaxed text-[#1A0507]/65">{helper}</p>}
    </div>
  );
}

/** A ledger line: label, a value in the heading face, and a copy control. */
export function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-end justify-between gap-4 border-t border-[#1A0507]/12 py-4 last:border-b">
      <div className="min-w-0">
        <p className={LABEL}>{label}</p>
        <p className="mt-1 break-all font-heading text-2xl font-light text-[#1A0507]">{value}</p>
      </div>
      <button
        type="button"
        className="min-h-11 shrink-0 px-1 font-sans text-xs font-medium uppercase tracking-[0.2em] text-[#760F13] transition-opacity hover:opacity-70"
        onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
        aria-live="polite"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
