'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Link2, Unlink, RefreshCw, Calendar, Video, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface StatusConnected {
  connected: true;
  email:     string | null;
  name:      string | null;
  expiresAt: number;
  updatedAt: number;
}

interface StatusDisconnected {
  connected: false;
}

type Status = StatusConnected | StatusDisconnected;

interface Props {
  status:          Status;
  flashConnected:  boolean;
  flashError:      string | null;
  meetAutoCreate:  boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized:    'You must be signed in as staff to connect Google Calendar.',
  missing_params:  'OAuth callback was missing required parameters.',
  state_mismatch:  'Security check failed. Please try connecting again.',
  exchange_failed: 'Could not exchange the authorisation code. Please try again.',
  access_denied:   'You denied access. Please try again and allow calendar access.',
};

export default function GoogleCalendarClient({ status, flashConnected, flashError, meetAutoCreate: initialMeetAutoCreate }: Props) {
  const router              = useRouter();
  const [busy, setBusy]     = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // ── Meet auto-create toggle ────────────────────────────────────────────────
  const [meetAutoCreate, setMeetAutoCreate]       = useState(initialMeetAutoCreate);
  const [toggleBusy, setToggleBusy]               = useState(false);
  const [toggleSaved, setToggleSaved]             = useState(false);

  // ── Activation guide collapse state ───────────────────────────────────────
  const [guideOpen, setGuideOpen] = useState(false);

  async function handleToggleMeetAutoCreate() {
    if (toggleBusy) return;
    const next = !meetAutoCreate;
    setToggleBusy(true);
    setToggleSaved(false);
    try {
      const res = await fetch('/api/lms/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetAutoCreate: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLocalError((data as { error?: string }).error ?? 'Failed to save setting.');
        return;
      }
      setMeetAutoCreate(next);
      setToggleSaved(true);
      setTimeout(() => setToggleSaved(false), 2000);
    } catch {
      setLocalError('Network error. Please try again.');
    } finally {
      setToggleBusy(false);
    }
  }

  const errorMsg = flashError
    ? (ERROR_MESSAGES[flashError] ?? `Google error: ${flashError}`)
    : localError;

  async function handleDisconnect() {
    if (busy) return;
    setBusy(true);
    setLocalError(null);

    try {
      const res = await fetch('/api/lms/admin/google', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLocalError((data as { error?: string }).error ?? 'Failed to disconnect.');
        return;
      }
      router.refresh();
    } catch {
      setLocalError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Flash success banner */}
      {flashConnected && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 380, damping: 28 }}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '12px 16px',
            borderRadius: 10,
            background:   '#F0FDF4',
            border:       '1px solid #BBF7D0',
            marginBottom: 20,
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#16A34A', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#15803D', fontWeight: 500 }}>
            Google Calendar connected successfully.
          </p>
        </motion.div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 380, damping: 28 }}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '12px 16px',
            borderRadius: 10,
            background:   '#FEF2F2',
            border:       '1px solid #FCA5A5',
            marginBottom: 20,
          }}
        >
          <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#B91C1C' }}>{errorMsg}</p>
        </motion.div>
      )}

      {/* Status card */}
      <div
        style={{
          border:       '1px solid #E5E7EB',
          borderRadius: 14,
          padding:      '20px 24px',
          background:   '#FFFFFF',
          boxShadow:    '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        {/* Icon + status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width:           44,
              height:          44,
              borderRadius:    12,
              background:      status.connected ? '#F0FDF4' : '#F9FAFB',
              border:          `1px solid ${status.connected ? '#BBF7D0' : '#E5E7EB'}`,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              flexShrink:      0,
            }}
          >
            <Calendar size={20} style={{ color: status.connected ? '#16A34A' : '#9CA3AF' }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin:     0,
                fontSize:   14,
                fontWeight: 600,
                color:      '#0F172A',
                letterSpacing: '-0.01em',
              }}
            >
              {status.connected ? 'Connected' : 'Not connected'}
            </p>
            <p
              style={{
                margin:   0,
                fontSize: 12,
                color:    '#6B7280',
                marginTop: 2,
              }}
            >
              {status.connected
                ? `Host account: ${status.email ?? 'Unknown'}`
                : 'Connect a Google account to enable automatic Meet links.'}
            </p>
          </div>

          {/* Connection status badge */}
          <span
            style={{
              fontSize:     11,
              fontWeight:   600,
              padding:      '3px 10px',
              borderRadius: 20,
              background:   status.connected ? '#DCFCE7' : '#F3F4F6',
              color:        status.connected ? '#15803D' : '#6B7280',
              letterSpacing: '0.02em',
              flexShrink:   0,
            }}
          >
            {status.connected ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Additional info when connected */}
        {status.connected && (
          <div
            style={{
              padding:      '12px 14px',
              borderRadius: 8,
              background:   '#F9FAFB',
              border:       '1px solid #F3F4F6',
              marginBottom: 20,
              fontSize:     12,
              color:        '#6B7280',
              lineHeight:   1.6,
            }}
          >
            <div>Token expires: <strong style={{ color: '#374151' }}>{new Date(status.expiresAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}</strong></div>
            <div>Last updated:  <strong style={{ color: '#374151' }}>{new Date(status.updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}</strong></div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Connect / Reconnect */}
          <motion.a
            href="/api/lms/admin/google/connect"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            7,
              padding:        '9px 18px',
              borderRadius:   9,
              background:     '#0F172A',
              color:          '#FFFFFF',
              fontSize:       13,
              fontWeight:     600,
              textDecoration: 'none',
              letterSpacing:  '-0.01em',
              cursor:         'pointer',
            }}
          >
            {status.connected ? (
              <>
                <RefreshCw size={14} />
                Reconnect
              </>
            ) : (
              <>
                <Link2 size={14} />
                Connect Google Account
              </>
            )}
          </motion.a>

          {/* Disconnect (only when connected) */}
          {status.connected && (
            <motion.button
              onClick={handleDisconnect}
              disabled={busy}
              whileHover={busy ? {} : { scale: 1.02 }}
              whileTap={busy ? {} : { scale: 0.97 }}
              style={{
                display:       'inline-flex',
                alignItems:    'center',
                gap:           7,
                padding:       '9px 18px',
                borderRadius:  9,
                background:    'transparent',
                border:        '1px solid #E5E7EB',
                color:         busy ? '#9CA3AF' : '#DC2626',
                fontSize:      13,
                fontWeight:    500,
                cursor:        busy ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em',
              }}
            >
              <Unlink size={14} />
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </motion.button>
          )}
        </div>
      </div>

      {/* Explainer */}
      <div
        style={{
          marginTop:    16,
          padding:      '12px 14px',
          borderRadius: 8,
          background:   '#FFFBEB',
          border:       '1px solid #FDE68A',
          fontSize:     12,
          color:        '#92400E',
          lineHeight:   1.6,
        }}
      >
        <strong>How it works:</strong> When you create a class, a Google Meet link is generated automatically and
        all enrolled students are added as attendees. The token auto-refreshes — no daily re-auth needed.
        Only one host account is active at a time; reconnecting replaces the current one.
      </div>

      {/* ── Meet auto-create toggle ─────────────────────────────────────────── */}
      <div
        style={{
          marginTop:    24,
          border:       '1px solid #E5E7EB',
          borderRadius: 14,
          padding:      '20px 24px',
          background:   '#FFFFFF',
          boxShadow:    '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: '#F0F9FF', border: '1px solid #BAE6FD',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Video size={16} style={{ color: '#0284C7' }} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0F172A', letterSpacing: '-0.01em' }}>
                Auto-create Meet links for new classes
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
              When enabled, every new class and online booking slot automatically gets a Google Meet link.
              Disable to manage Meet links manually — you can still paste links directly on each class.
              {!status.connected && (
                <span style={{ color: '#D97706', display: 'block', marginTop: 4 }}>
                  Note: no Google account is connected, so auto-creation will silently skip even when enabled.
                </span>
              )}
            </p>
          </div>

          {/* Spring toggle switch */}
          <motion.button
            onClick={() => { void handleToggleMeetAutoCreate(); }}
            disabled={toggleBusy}
            aria-label={meetAutoCreate ? 'Disable Meet auto-create' : 'Enable Meet auto-create'}
            aria-pressed={meetAutoCreate}
            style={{
              position: 'relative',
              flexShrink: 0,
              width: 48,
              height: 28,
              borderRadius: 14,
              border: 'none',
              cursor: toggleBusy ? 'not-allowed' : 'pointer',
              background: meetAutoCreate ? '#0284C7' : '#D1D5DB',
              padding: 0,
              opacity: toggleBusy ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
            whileTap={!toggleBusy ? { scale: 0.94 } : {}}
          >
            <motion.span
              layout
              animate={{ x: meetAutoCreate ? 22 : 2 }}
              transition={{ type: 'spring' as const, stiffness: 500, damping: 30 }}
              style={{
                position: 'absolute',
                top: 3,
                left: 0,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#FFFFFF',
                boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
              }}
            />
          </motion.button>
        </div>

        {/* Saved flash */}
        <AnimatePresence>
          {toggleSaved && (
            <motion.p
              key="saved"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ margin: '10px 0 0', fontSize: 12, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <CheckCircle2 size={13} />
              {meetAutoCreate ? 'Auto-create enabled' : 'Auto-create disabled'}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── Activation status chips ─────────────────────────────────────────── */}
      <div
        style={{
          marginTop:   24,
          display:     'flex',
          flexWrap:    'wrap',
          gap:         8,
          alignItems:  'center',
        }}
      >
        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Status:</span>

        {/* API env set? */}
        <span
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          4,
            fontSize:     11,
            fontWeight:   600,
            padding:      '3px 9px',
            borderRadius: 20,
            background:   process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_REDIRECT_URI_SET !== 'false'
              ? '#DCFCE7' : '#F3F4F6',
            color:        '#374151',
          }}
        >
          Redirect URI env
          {/* env is checked at build time; show connected badge when Google account is linked */}
          {status.connected ? ' ✓' : ' —'}
        </span>

        {/* Connected? */}
        <span
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          4,
            fontSize:     11,
            fontWeight:   600,
            padding:      '3px 9px',
            borderRadius: 20,
            background:   status.connected ? '#DCFCE7' : '#F3F4F6',
            color:        status.connected ? '#15803D' : '#6B7280',
          }}
        >
          {status.connected ? '✓ Host connected' : '✗ Not connected'}
        </span>

        {/* Toggle state */}
        <span
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          4,
            fontSize:     11,
            fontWeight:   600,
            padding:      '3px 9px',
            borderRadius: 20,
            background:   meetAutoCreate ? '#DCFCE7' : '#F3F4F6',
            color:        meetAutoCreate ? '#15803D' : '#6B7280',
          }}
        >
          {meetAutoCreate ? '✓ Auto-create on' : '✗ Auto-create off'}
        </span>
      </div>

      {/* ── How to activate guide (collapsed) ──────────────────────────────── */}
      <div
        style={{
          marginTop:    16,
          border:       '1px solid #E5E7EB',
          borderRadius: 12,
          overflow:     'hidden',
          background:   '#FAFAFA',
        }}
      >
        {/* Collapsible header */}
        <button
          onClick={() => setGuideOpen((v) => !v)}
          style={{
            width:         '100%',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'space-between',
            gap:           10,
            padding:       '14px 16px',
            background:    'transparent',
            border:        'none',
            cursor:        'pointer',
            textAlign:     'left',
          }}
          aria-expanded={guideOpen}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: '#D97706', flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', letterSpacing: '-0.01em' }}>
              How to activate Google Meet (when you&apos;re ready)
            </span>
          </div>
          {guideOpen
            ? <ChevronUp  size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} aria-hidden />
            : <ChevronDown size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} aria-hidden />
          }
        </button>

        <AnimatePresence initial={false}>
          {guideOpen && (
            <motion.div
              key="guide"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring' as const, stiffness: 320, damping: 28 }}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  padding:    '0 16px 16px',
                  borderTop:  '1px solid #E5E7EB',
                }}
              >
                <p style={{ margin: '12px 0 10px', fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                  Four quick steps — takes under 10 minutes once you have your Google Cloud Console open.
                </p>

                <ol style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'none' }}>
                  {[
                    {
                      n:    1,
                      head: 'Enable Google Calendar API',
                      body: 'In Google Cloud Console (same project as your OAuth client), go to APIs & Services → Library, search "Google Calendar API" and click Enable.',
                    },
                    {
                      n:    2,
                      head: 'Add redirect URI & set env var',
                      body: 'In your OAuth 2.0 client, add an Authorised redirect URI: {NEXTAUTH_URL}/api/lms/admin/google/callback. Then set GOOGLE_CALENDAR_REDIRECT_URI to the same value in Vercel environment variables.',
                    },
                    {
                      n:    3,
                      head: 'Connect the host Google account',
                      body: 'Click "Connect Google Account" above and sign in with the Google account that will host all class events. Approve the calendar access. You\'ll be redirected back here when done.',
                    },
                    {
                      n:    4,
                      head: 'Flip "Auto-create Meet links" on',
                      body: 'Enable the toggle above. From now on, every new class session and online booking slot will automatically get a Google Meet link and invite enrolled students.',
                    },
                  ].map((step) => (
                    <li
                      key={step.n}
                      style={{
                        display:      'flex',
                        gap:          12,
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          flexShrink:     0,
                          width:          22,
                          height:         22,
                          borderRadius:   '50%',
                          background:     '#0F172A',
                          color:          '#FFFFFF',
                          fontSize:       11,
                          fontWeight:     700,
                          display:        'flex',
                          alignItems:     'center',
                          justifyContent: 'center',
                          marginTop:      1,
                        }}
                      >
                        {step.n}
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
                          {step.head}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
