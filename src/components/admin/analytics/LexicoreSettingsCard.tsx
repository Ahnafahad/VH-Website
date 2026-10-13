'use client';

/**
 * LexiCore settings card (Statistics > Games). Admin / super_admin only.
 *
 * The three controls moved here from the old /admin/vocab page. Storage and semantics are unchanged:
 *   GET   /api/vocab/admin/settings            all settings as a key to value map
 *   PATCH /api/vocab/admin/settings            { key, value } for quiz_pass_threshold (stored 0-1) and phase_cutoff_date
 *   POST  /api/vocab/admin/ultimate-toggle     { enable } (retroactively awards badges when enabling)
 * Each control saves on its own and shows "Saved" beside it, so there is no form-level Save button.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BORDER, FieldInput, INK_SOFT, MUTED, OK, OK_BG, R_LG, RED_DARK, SHADOW_SM, SURFACE,
  T_BASE, T_LG, T_SM, T_XS, Toggle,
} from '../lms/lms-shared';

interface Settings {
  ultimate_achievements_visible: string;
  quiz_pass_threshold: string;
  phase_cutoff_date: string;
}

type Key = 'ua' | 'th' | 'co';

function toPercent(stored: string): number {
  const n = parseFloat(stored);
  return Number.isNaN(n) ? 70 : Math.round(n * 100);
}

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minHeight: 56, padding: '8px 0',
};
const rule: React.CSSProperties = { borderTop: `1px solid ${BORDER}` };

function SavedStamp({ show }: { show: boolean }) {
  return (
    <span
      aria-hidden={!show}
      style={{
        visibility: show ? 'visible' : 'hidden',
        fontSize: T_XS, fontWeight: 600, color: OK, background: OK_BG,
        border: `1px solid ${OK}`, borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em', textTransform: 'uppercase',
      }}
    >
      Saved
    </span>
  );
}

export default function LexicoreSettingsCard() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [cutoff, setCutoff] = useState('');
  const [busy, setBusy] = useState<Key | null>(null);
  const [saved, setSaved] = useState<Key | null>(null);
  const [error, setError] = useState<{ key: Key; message: string } | null>(null);
  const [note, setNote] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    let live = true;
    fetch('/api/vocab/admin/settings')
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Settings>; })
      .then(s => {
        if (!live) return;
        setSettings(s);
        setThreshold(String(toPercent(s.quiz_pass_threshold)));
        setCutoff(s.phase_cutoff_date ?? '');
      })
      .catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, []);

  const confirmSaved = useCallback((key: Key) => {
    setSaved(key);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(null), 2500);
  }, []);

  const fail = useCallback((key: Key, message: string) => setError({ key, message }), []);

  async function patch(key: Key, name: 'quiz_pass_threshold' | 'phase_cutoff_date', value: string): Promise<boolean> {
    setBusy(key);
    try {
      const res = await fetch('/api/vocab/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: name, value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSettings(prev => (prev ? { ...prev, [name]: value } : prev));
      confirmSaved(key);
      return true;
    } catch {
      fail(key, 'Could not save. Try again.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function toggleUltimate(enable: boolean) {
    if (!settings) return;
    const before = settings.ultimate_achievements_visible;
    setSettings({ ...settings, ultimate_achievements_visible: String(enable) });
    setBusy('ua');
    setNote('');
    try {
      const res = await fetch('/api/vocab/admin/ultimate-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { badgesAwarded?: number; usersChecked?: number };
      if (enable && data.badgesAwarded !== undefined) {
        setNote(`Checked ${data.usersChecked ?? 0} user(s), awarded ${data.badgesAwarded} badge(s) retroactively.`);
      } else if (!enable) {
        setNote('Hidden from users. Badges already awarded are kept.');
      }
      confirmSaved('ua');
    } catch {
      setSettings(prev => (prev ? { ...prev, ultimate_achievements_visible: before } : prev));
      fail('ua', 'Could not change this. Try again.');
    } finally {
      setBusy(null);
    }
  }

  function saveThreshold() {
    if (!settings) return;
    const pct = parseInt(threshold, 10);
    if (Number.isNaN(pct) || pct < 1 || pct > 100) {
      fail('th', 'Enter a whole number from 1 to 100.');
      return;
    }
    const stored = String(pct / 100);
    if (stored === settings.quiz_pass_threshold) { setError(null); return; }
    void patch('th', 'quiz_pass_threshold', stored);
  }

  function saveCutoff(value: string) {
    setCutoff(value);
    if (!settings || value === settings.phase_cutoff_date) return;
    void patch('co', 'phase_cutoff_date', value);
  }

  const ultimateOn = settings?.ultimate_achievements_visible === 'true';
  const errorFor = (k: Key) => (error?.key === k ? error.message : null);

  return (
    <section
      aria-labelledby="lexicore-settings-title"
      style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, boxShadow: SHADOW_SM, padding: '16px 20px', maxWidth: 620 }}
    >
      <h2 id="lexicore-settings-title" style={{ margin: 0, fontSize: T_LG, fontWeight: 600, color: INK_SOFT }}>LexiCore settings</h2>
      <p style={{ margin: '2px 0 8px', fontSize: T_SM, color: MUTED }}>Each setting saves as soon as you change it. Admin only.</p>

      {loadError && <p role="alert" style={{ color: RED_DARK, fontSize: T_BASE }}>Could not load the settings. Refresh to try again.</p>}
      {!settings && !loadError && (
        <div style={{ ...row, color: MUTED, fontSize: T_BASE }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading settings</div>
      )}

      {settings && (
        <div>
          <div style={row}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: T_BASE, fontWeight: 600, color: INK_SOFT }}>Ultimate Achievements</div>
              <div style={{ fontSize: T_SM, color: MUTED }}>Show the ultimate badges to students.</div>
            </div>
            {busy === 'ua' && <Loader2 size={16} aria-label="Saving" style={{ animation: 'spin 1s linear infinite', color: MUTED }} />}
            <SavedStamp show={saved === 'ua'} />
            <Toggle checked={ultimateOn} onChange={v => { if (busy !== 'ua') void toggleUltimate(v); }} label="" ariaLabel="Ultimate Achievements" />
          </div>
          {errorFor('ua') && <p role="alert" style={{ margin: '0 0 6px', fontSize: T_SM, color: RED_DARK }}>{errorFor('ua')}</p>}
          {note && <p style={{ margin: '0 0 6px', fontSize: T_SM, color: MUTED }}>{note}</p>}

          <div style={{ ...row, ...rule }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="lc-threshold" style={{ fontSize: T_BASE, fontWeight: 600, color: INK_SOFT }}>Quiz pass threshold</label>
              <div style={{ fontSize: T_SM, color: MUTED }}>Percent needed to pass a study quiz.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FieldInput
                id="lc-threshold"
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                onBlur={saveThreshold}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveThreshold(); } }}
                style={{ width: 84, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              />
              <span style={{ fontSize: T_BASE, color: MUTED }}>%</span>
            </div>
            {busy === 'th' && <Loader2 size={16} aria-label="Saving" style={{ animation: 'spin 1s linear infinite', color: MUTED }} />}
            <SavedStamp show={saved === 'th'} />
          </div>
          {errorFor('th') && <p role="alert" style={{ margin: '0 0 6px', fontSize: T_SM, color: RED_DARK }}>{errorFor('th')}</p>}

          <div style={{ ...row, ...rule }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="lc-cutoff" style={{ fontSize: T_BASE, fontWeight: 600, color: INK_SOFT }}>Phase 1 cut-off date</label>
              <div style={{ fontSize: T_SM, color: MUTED }}>Users who registered after this date are Phase 2 (limited access).</div>
            </div>
            <FieldInput
              id="lc-cutoff"
              type="date"
              value={cutoff}
              onChange={e => saveCutoff(e.target.value)}
              style={{ width: 170 }}
            />
            {busy === 'co' && <Loader2 size={16} aria-label="Saving" style={{ animation: 'spin 1s linear infinite', color: MUTED }} />}
            <SavedStamp show={saved === 'co'} />
          </div>
          {errorFor('co') && <p role="alert" style={{ margin: '0 0 6px', fontSize: T_SM, color: RED_DARK }}>{errorFor('co')}</p>}
        </div>
      )}
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {saved ? 'Saved' : ''}
      </span>
    </section>
  );
}
