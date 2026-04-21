'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { X, Send, CheckCircle2 } from 'lucide-react';

const sheetBackdropV: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.22 } },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
};

const sheetV: Variants = {
  hidden: { y: '100%', opacity: 0.5 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 340, damping: 34 },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
};

const successV: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: 10 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 380, damping: 30, delay: 0.05 },
  },
};

type SheetState = 'form' | 'submitting' | 'success' | 'error';

interface Props {
  title:    string;
  subtitle?: string;
  onClose:  () => void;
}

export default function AccessRequestSheet({ title, subtitle, onClose }: Props) {
  const [state,      setState]    = useState<SheetState>('form');
  const [whatsapp,   setWhatsapp] = useState('');
  const [message,    setMessage]  = useState('');
  const [errorMsg,   setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!whatsapp.trim()) {
      setErrorMsg('Please enter your WhatsApp number.');
      return;
    }
    setErrorMsg('');
    setState('submitting');

    try {
      const res = await fetch('/api/vocab/access-request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          whatsapp: whatsapp.trim(),
          message:  message.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg((body as { error?: string }).error ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }

      setState('success');
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setState('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width:        '100%',
    background:   'var(--form-field-bg)',
    border:       '1px solid var(--form-border)',
    borderRadius: '10px',
    padding:      '13px 14px',
    fontFamily:   "'Sora', sans-serif",
    fontSize:     '15px',
    fontWeight:   400,
    color:        'var(--form-input-text)',
    outline:      'none',
    boxSizing:    'border-box',
  };

  return (
    <motion.div
      key="sheet-backdrop"
      variants={sheetBackdropV}
      initial="hidden"
      animate="show"
      exit="exit"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9998,
        background:     'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display:        'flex',
        alignItems:     'flex-end',
        justifyContent: 'center',
      }}
    >
      <motion.div
        key="sheet"
        variants={sheetV}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={e => e.stopPropagation()}
        style={{
          width:           '100%',
          maxWidth:        '430px',
          background:      'var(--color-lx-surface)',
          borderRadius:    '20px 20px 0 0',
          borderTop:       '1px solid var(--color-lx-border)',
          borderLeft:      '1px solid var(--color-lx-border)',
          borderRight:     '1px solid var(--color-lx-border)',
          padding:         '8px 0 0',
          paddingBottom:   'calc(32px + env(safe-area-inset-bottom))',
          overflow:        'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            width:        '36px',
            height:       '4px',
            borderRadius: '2px',
            background:   'var(--color-lx-border)',
            margin:       '0 auto 16px',
          }}
        />

        <AnimatePresence mode="wait">
          {state === 'success' ? (
            <motion.div
              key="success"
              variants={successV}
              initial="hidden"
              animate="show"
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                padding:        '24px 28px 32px',
                textAlign:      'center',
              }}
            >
              <div
                style={{
                  width:          64,
                  height:         64,
                  borderRadius:   '50%',
                  background:     'rgba(201,168,76,0.12)',
                  border:         '1px solid rgba(201,168,76,0.3)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  marginBottom:   '20px',
                }}
              >
                <CheckCircle2
                  size={28}
                  strokeWidth={1.5}
                  style={{ color: '#C9A84C' }}
                />
              </div>

              <h3
                className="lx-word"
                style={{
                  fontSize:     '1.7rem',
                  fontWeight:   600,
                  fontStyle:    'italic',
                  color:        'var(--color-lx-text-primary)',
                  margin:       '0 0 10px',
                  lineHeight:   1.2,
                }}
              >
                Request Sent
              </h3>

              <p
                style={{
                  fontFamily:   "'Sora', sans-serif",
                  fontSize:     '13px',
                  fontWeight:   300,
                  color:        'var(--color-lx-text-secondary)',
                  lineHeight:   1.6,
                  margin:       '0 0 28px',
                }}
              >
                We&apos;ll be in touch via WhatsApp once your access is approved.
              </p>

              <button
                onClick={onClose}
                style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      '13px',
                  fontWeight:    600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color:         '#C9A84C',
                  background:    'rgba(201,168,76,0.1)',
                  border:        '1px solid rgba(201,168,76,0.3)',
                  borderRadius:  '10px',
                  padding:       '12px 32px',
                  cursor:        'pointer',
                  width:         '100%',
                }}
              >
                Done
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              style={{ padding: '4px 24px 0' }}
            >
              <div
                style={{
                  display:        'flex',
                  alignItems:     'flex-start',
                  justifyContent: 'space-between',
                  marginBottom:   '20px',
                }}
              >
                <div>
                  <h2
                    className="lx-word"
                    style={{
                      fontSize:   '1.55rem',
                      fontWeight: 600,
                      fontStyle:  'italic',
                      color:      'var(--color-lx-text-primary)',
                      margin:     '0 0 4px',
                      lineHeight: 1.2,
                    }}
                  >
                    {title}
                  </h2>
                  {subtitle && (
                    <p
                      style={{
                        fontFamily: "'Sora', sans-serif",
                        fontSize:   '11px',
                        fontWeight: 400,
                        color:      'var(--color-lx-text-muted)',
                        margin:     0,
                      }}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>

                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width:          32,
                    height:         32,
                    borderRadius:   '8px',
                    background:     'var(--color-lx-elevated)',
                    border:         '1px solid var(--color-lx-border)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    cursor:         'pointer',
                    flexShrink:     0,
                    marginTop:      '2px',
                  }}
                >
                  <X size={14} style={{ color: 'var(--color-lx-text-muted)' }} />
                </button>
              </div>

              <div
                aria-hidden
                style={{
                  height:       '1px',
                  background:   'var(--color-lx-border)',
                  marginBottom: '20px',
                }}
              />

              <div style={{ marginBottom: '14px' }}>
                <label
                  htmlFor="lx-whatsapp"
                  style={{
                    display:       'block',
                    fontFamily:    "'Sora', sans-serif",
                    fontSize:      '11px',
                    fontWeight:    600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color:         'var(--form-label)',
                    marginBottom:  '6px',
                  }}
                >
                  WhatsApp Number <span style={{ color: 'var(--color-lx-accent-red)' }}>*</span>
                </label>
                <input
                  id="lx-whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+880 1XXX XXXXXX"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  disabled={state === 'submitting'}
                  style={{
                    ...inputStyle,
                    borderColor: errorMsg && !whatsapp.trim()
                      ? 'var(--form-focus)'
                      : undefined,
                  }}
                  onFocus={e => {
                    (e.target as HTMLInputElement).style.borderColor = 'var(--form-focus)';
                    (e.target as HTMLInputElement).style.boxShadow   = '0 0 0 3px var(--form-focus-ring)';
                  }}
                  onBlur={e => {
                    (e.target as HTMLInputElement).style.borderColor = 'var(--form-border)';
                    (e.target as HTMLInputElement).style.boxShadow   = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label
                  htmlFor="lx-message"
                  style={{
                    display:       'block',
                    fontFamily:    "'Sora', sans-serif",
                    fontSize:      '11px',
                    fontWeight:    600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color:         'var(--form-label)',
                    marginBottom:  '6px',
                  }}
                >
                  Message <span style={{ color: 'var(--color-lx-text-secondary)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  id="lx-message"
                  rows={3}
                  placeholder="Tell us a bit about yourself or your goals..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  disabled={state === 'submitting'}
                  style={{
                    ...inputStyle,
                    resize:    'none',
                    lineHeight: 1.55,
                  }}
                  onFocus={e => {
                    (e.target as HTMLTextAreaElement).style.borderColor = 'var(--form-focus)';
                    (e.target as HTMLTextAreaElement).style.boxShadow   = '0 0 0 3px var(--form-focus-ring)';
                  }}
                  onBlur={e => {
                    (e.target as HTMLTextAreaElement).style.borderColor = 'var(--form-border)';
                    (e.target as HTMLTextAreaElement).style.boxShadow   = 'none';
                  }}
                />
              </div>

              <AnimatePresence>
                {(errorMsg) && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: '12px' }}
                    exit={{   opacity: 0, height: 0, marginBottom: 0 }}
                    role="alert"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   '12px',
                      fontWeight: 400,
                      color:      'var(--color-lx-accent-red)',
                      lineHeight: 1.5,
                      overflow:   'hidden',
                    }}
                  >
                    {errorMsg}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                whileTap={state === 'submitting' ? {} : { scale: 0.97 }}
                onClick={handleSubmit}
                disabled={state === 'submitting'}
                style={{
                  width:         '100%',
                  display:       'flex',
                  alignItems:    'center',
                  justifyContent: 'center',
                  gap:           '8px',
                  padding:       '14px 24px',
                  borderRadius:  '12px',
                  background:    state === 'submitting'
                    ? 'rgba(201,168,76,0.08)'
                    : 'linear-gradient(135deg, rgba(201,168,76,0.22) 0%, rgba(201,168,76,0.1) 100%)',
                  border:        '1px solid rgba(201,168,76,0.38)',
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      '13px',
                  fontWeight:    600,
                  letterSpacing: '0.06em',
                  color:         state === 'submitting' ? 'rgba(201,168,76,0.5)' : '#C9A84C',
                  cursor:        state === 'submitting' ? 'default' : 'pointer',
                  marginBottom:  '10px',
                }}
              >
                {state === 'submitting' ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      style={{
                        width:        14,
                        height:       14,
                        borderRadius: '50%',
                        border:       '2px solid rgba(201,168,76,0.3)',
                        borderTop:    '2px solid rgba(201,168,76,0.7)',
                      }}
                    />
                    Sending&hellip;
                  </>
                ) : (
                  <>
                    <Send size={14} strokeWidth={2} />
                    Send Request
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
