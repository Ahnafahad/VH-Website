'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

type Path = 'choose' | 'student' | 'wtp';
type WtpOption = 'tutor' | 'printing' | 'notebook' | 'nothing';

// ─── Animation variants ───────────────────────────────────────────────────────

const backdrop: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.25 } },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
};

const sheet: Variants = {
  hidden: { y: '100%' },
  show:   { y: 0, transition: { type: 'spring' as const, stiffness: 340, damping: 34, delay: 0.05 } },
  exit:   { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 360, damping: 32 } },
};

const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

// ─── WTP option config ────────────────────────────────────────────────────────

const WTP_OPTIONS: { id: WtpOption; label: string; note: string }[] = [
  { id: 'tutor',    label: '~500৳',  note: 'About what I\'d spend on a private tutor for one hour' },
  { id: 'printing', label: '~200৳',  note: 'What I spend on printing notes in a month' },
  { id: 'notebook', label: '~100৳',  note: 'The cost of a notebook' },
  { id: 'nothing',  label: 'Nothing', note: 'I\'d share it with classmates instead' },
];

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  base:      'var(--color-lx-base)',
  surface:   'var(--color-lx-surface)',
  elevated:  'var(--color-lx-elevated)',
  border:    'var(--color-lx-border)',
  red:       'var(--color-lx-accent-red)',
  gold:      'var(--color-lx-accent-gold)',
  textPrim:  'var(--color-lx-text-primary)',
  textSec:   'var(--color-lx-text-secondary)',
  textMuted: 'var(--color-lx-text-muted)',
} as const;

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

// ─── Shared: close button ─────────────────────────────────────────────────────

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClose}
      aria-label="Close"
      style={{
        position:       'absolute',
        top:            20,
        right:          20,
        width:          32,
        height:         32,
        borderRadius:   '50%',
        background:     C.elevated,
        border:         `1px solid ${C.border}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        cursor:         'pointer',
        color:          C.textMuted,
      }}
    >
      <X size={14} />
    </motion.button>
  );
}

// ─── Path chooser ─────────────────────────────────────────────────────────────

function ChoosePath({ onPick }: { onPick: (p: 'student' | 'wtp') => void }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Heading */}
      <motion.div variants={fadeUp} style={{ textAlign: 'center', paddingBottom: 4 }}>
        <p style={{
          fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: C.gold, marginBottom: 8,
        }}>
          Unlock LexiCore
        </p>
        <h2 style={{
          fontFamily: SERIF, fontSize: '2rem', fontWeight: 700,
          fontStyle: 'italic', color: C.textPrim, lineHeight: 1.1,
          margin: 0,
        }}>
          Which describes you?
        </h2>
      </motion.div>

      {/* Options */}
      {[
        {
          path: 'student' as const,
          label: 'I\'m a VH student',
          sublabel: 'Enrolled in IBA/BUP admission coaching',
          accent: C.gold,
          bg: 'rgba(244,168,40,0.06)',
          border: 'rgba(244,168,40,0.25)',
        },
        {
          path: 'wtp' as const,
          label: 'I found LexiCore on my own',
          sublabel: 'Not a VH student, but I want access',
          accent: C.red,
          bg: 'rgba(230,57,70,0.06)',
          border: 'rgba(230,57,70,0.22)',
        },
      ].map(opt => (
        <motion.button
          key={opt.path}
          variants={fadeUp}
          whileTap={{ scale: 0.97 }}
          onClick={() => onPick(opt.path)}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            14,
            padding:        '16px 18px',
            background:     opt.bg,
            border:         `1px solid ${opt.border}`,
            borderRadius:   14,
            cursor:         'pointer',
            textAlign:      'left',
            width:          '100%',
          }}
        >
          <div style={{
            width:          10,
            height:         10,
            borderRadius:   '50%',
            background:     opt.accent,
            flexShrink:     0,
            boxShadow:      `0 0 8px ${opt.accent}`,
          }} />
          <div>
            <p style={{ fontFamily: SANS, fontSize: '0.82rem', fontWeight: 600, color: C.textPrim, margin: 0, lineHeight: 1.3 }}>
              {opt.label}
            </p>
            <p style={{ fontFamily: SANS, fontSize: '0.65rem', color: C.textMuted, margin: '3px 0 0', lineHeight: 1.4 }}>
              {opt.sublabel}
            </p>
          </div>
          <svg style={{ marginLeft: 'auto', flexShrink: 0, color: opt.accent }} width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      ))}
    </motion.div>
  );
}

// ─── Student path ─────────────────────────────────────────────────────────────

function StudentPath({ onBack }: { onBack: () => void }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <motion.button
        variants={fadeUp}
        whileTap={{ scale: 0.95 }}
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: SANS, fontSize: '0.65rem', fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: C.textMuted, alignSelf: 'flex-start', padding: 0,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 1L2 5l5 4" />
        </svg>
        Back
      </motion.button>

      {/* Heading */}
      <motion.div variants={fadeUp} style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
          background: 'rgba(244,168,40,0.1)',
          border: '1.5px solid rgba(244,168,40,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7l9 5 9-5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"
              stroke="var(--color-lx-accent-gold)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 style={{
          fontFamily: SERIF, fontSize: '1.75rem', fontWeight: 700,
          fontStyle: 'italic', color: C.textPrim, lineHeight: 1.1, margin: '0 0 10px',
        }}>
          You&apos;re already family.
        </h2>
        <p style={{ fontFamily: SANS, fontSize: '0.78rem', color: C.textSec, lineHeight: 1.65, margin: 0 }}>
          All Vertical Horizon IBA/BUP admission students get LexiCore completely free.
          Just message us with your enrollment confirmation.
        </p>
      </motion.div>

      {/* Divider */}
      <motion.div variants={fadeUp} style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />

      {/* Contact buttons */}
      <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          {
            label: 'Message on Facebook',
            href: 'https://facebook.com/verticalhorizonbd',
            bg: 'rgba(24,119,242,0.12)',
            border: 'rgba(24,119,242,0.3)',
            color: '#4a90d9',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#4a90d9">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            ),
          },
          {
            label: 'Message on WhatsApp',
            href: 'https://wa.me/8801XXXXXXXXX',
            bg: 'rgba(37,211,102,0.1)',
            border: 'rgba(37,211,102,0.28)',
            color: '#25d366',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25d366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            ),
          },
        ].map(btn => (
          <a
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              padding:        '13px 18px',
              background:     btn.bg,
              border:         `1px solid ${btn.border}`,
              borderRadius:   12,
              textDecoration: 'none',
              cursor:         'pointer',
            }}
          >
            {btn.icon}
            <span style={{ fontFamily: SANS, fontSize: '0.82rem', fontWeight: 600, color: btn.color }}>
              {btn.label}
            </span>
          </a>
        ))}
      </motion.div>

      <motion.p variants={fadeUp} style={{
        fontFamily: SERIF, fontSize: '0.85rem', fontStyle: 'italic',
        color: C.textMuted, textAlign: 'center', lineHeight: 1.6,
      }}>
        "We&apos;ll verify and unlock your account within 24 hours."
      </motion.p>
    </motion.div>
  );
}

// ─── WTP path ─────────────────────────────────────────────────────────────────

function WtpPath({ onBack }: { onBack: () => void }) {
  const [selected,  setSelected]  = useState<WtpOption | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const handleSubmit = async () => {
    if (!selected || loading) return;
    setLoading(true);
    try {
      await fetch('/api/vocab/upgrade-interest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ selectedOption: selected }),
      });
    } catch { /* silent */ }
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring' as const, stiffness: 340, damping: 28 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center', paddingTop: 8 }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring' as const, stiffness: 360, damping: 22, delay: 0.1 }}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(46,204,113,0.12)',
            border: '1.5px solid rgba(46,204,113,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M5 14.5l7 7L23 7" stroke="var(--color-lx-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
        <h2 style={{ fontFamily: SERIF, fontSize: '1.75rem', fontWeight: 700, fontStyle: 'italic', color: C.textPrim, margin: 0, lineHeight: 1.1 }}>
          Thank you.
        </h2>
        <p style={{ fontFamily: SANS, fontSize: '0.78rem', color: C.textSec, lineHeight: 1.7, maxWidth: '26rem', margin: 0 }}>
          You&apos;ll hear from us first when full access opens.{'\u00a0'}
          We&apos;ll notify you.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <motion.button
        variants={fadeUp}
        whileTap={{ scale: 0.95 }}
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: SANS, fontSize: '0.65rem', fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: C.textMuted, alignSelf: 'flex-start', padding: 0,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 1L2 5l5 4" />
        </svg>
        Back
      </motion.button>

      {/* Heading */}
      <motion.div variants={fadeUp}>
        <p style={{ fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.red, marginBottom: 8 }}>
          Help us find the right price
        </p>
        <h2 style={{ fontFamily: SERIF, fontSize: '1.6rem', fontWeight: 700, fontStyle: 'italic', color: C.textPrim, lineHeight: 1.15, margin: '0 0 8px' }}>
          What would feel like a fair trade for 12 months?
        </h2>
        <p style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.textMuted, lineHeight: 1.55, margin: 0 }}>
          No price tag yet — just exploring. Pick what feels honest.
        </p>
      </motion.div>

      {/* Options */}
      <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {WTP_OPTIONS.map(opt => {
          const active = selected === opt.id;
          return (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelected(opt.id)}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         12,
                padding:     '12px 16px',
                background:  active ? 'rgba(230,57,70,0.08)' : C.elevated,
                border:      `1px solid ${active ? 'rgba(230,57,70,0.45)' : C.border}`,
                borderRadius: 10,
                cursor:      'pointer',
                textAlign:   'left',
                transition:  'background 0.18s, border-color 0.18s',
              }}
            >
              {/* Radio dot */}
              <div style={{
                width:          18,
                height:         18,
                borderRadius:   '50%',
                border:         `1.5px solid ${active ? C.red : C.border}`,
                background:     active ? 'rgba(230,57,70,0.12)' : 'transparent',
                flexShrink:     0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                transition:     'border-color 0.18s, background 0.18s',
              }}>
                {active && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' as const, stiffness: 480, damping: 24 }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: C.red }}
                  />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: SERIF, fontSize: '1.05rem', fontWeight: 600, fontStyle: active ? 'italic' : 'normal', color: active ? C.textPrim : C.textSec, lineHeight: 1.2, display: 'block', transition: 'color 0.18s' }}>
                  {opt.label}
                </span>
                <span style={{ fontFamily: SANS, fontSize: '0.65rem', color: C.textMuted, lineHeight: 1.4, marginTop: 2, display: 'block' }}>
                  {opt.note}
                </span>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Submit */}
      <motion.button
        variants={fadeUp}
        whileTap={selected ? { scale: 0.97 } : {}}
        onClick={handleSubmit}
        disabled={!selected || loading}
        style={{
          width:          '100%',
          padding:        '14px',
          background:     selected ? C.red : 'rgba(255,255,255,0.06)',
          border:         `1px solid ${selected ? C.red : C.border}`,
          borderRadius:   12,
          cursor:         selected ? 'pointer' : 'default',
          fontFamily:     SANS,
          fontSize:       '0.875rem',
          fontWeight:     700,
          color:          selected ? '#fff' : C.textMuted,
          transition:     'all 0.22s ease',
          boxShadow:      selected ? '0 4px 18px rgba(230,57,70,0.3)' : 'none',
          opacity:        loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Submitting…' : 'Submit →'}
      </motion.button>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function UpgradeModal({ onClose }: Props) {
  const [path, setPath] = useState<Path>('choose');

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        variants={backdrop}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     60,
          background: 'rgba(5,5,7,0.72)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Sheet */}
      <motion.div
        key="sheet"
        variants={sheet}
        initial="hidden"
        animate="show"
        exit="exit"
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 500) onClose();
        }}
        style={{
          position:     'fixed',
          bottom:       0,
          left:         0,
          right:        0,
          zIndex:       61,
          background:   C.surface,
          borderRadius: '20px 20px 0 0',
          border:       `1px solid ${C.border}`,
          borderBottom: 'none',
          padding:      `1.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom))`,
          touchAction:  'none',
          maxWidth:     560,
          margin:       '0 auto',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: C.border,
          margin: '0 auto 1.5rem',
        }} />

        {/* Close button */}
        <CloseBtn onClose={onClose} />

        {/* Content — animated on path change */}
        <AnimatePresence mode="wait">
          {path === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ type: 'spring' as const, stiffness: 360, damping: 32 }}
            >
              <ChoosePath onPick={setPath} />
            </motion.div>
          )}
          {path === 'student' && (
            <motion.div
              key="student"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring' as const, stiffness: 360, damping: 32 }}
            >
              <StudentPath onBack={() => setPath('choose')} />
            </motion.div>
          )}
          {path === 'wtp' && (
            <motion.div
              key="wtp"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring' as const, stiffness: 360, damping: 32 }}
            >
              <WtpPath onBack={() => setPath('choose')} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
