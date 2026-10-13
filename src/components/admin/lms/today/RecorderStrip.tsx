'use client';

/**
 * Persistent meeting-recorder strip: bot status, where it is, and one-click
 * Send / Retry / Copy / Open / Edit link. Polls every ~15 s while the class
 * is live (visibility-aware, cleared on unmount).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Video, Copy, ExternalLink, RotateCw, Send, Pencil, Check, X } from 'lucide-react';
import {
  deriveRecorder, meetingPlatform, normaliseMaterialLink, shouldPollRecorder,
  type ClockPhase, type RecorderRecording,
} from '@/lib/lms/today-cockpit';
import { BORDER, MUTED, SLATE, SURFACE, BG, R_MD, T_XS, T_SM, T_BASE, fmtDhaka, OK_BG, WARN_BG, INFO_BG, SURFACE_ALT, RED } from '../lms-shared';
import { Btn, Stamp, apiJson } from './cockpit-ui';
import { FieldInput } from '../lms-shared';

export interface RecorderSession {
  id: number;
  meetLink: string | null;
  recallBotId: string | null;
  scheduledAt: number;
  recording: RecorderRecording | null;
}

const POLL_MS = 15_000;

const TINT = { ok: OK_BG, warn: WARN_BG, info: INFO_BG, muted: SURFACE_ALT, bad: BG } as const;

export default function RecorderStrip({
  session, phase, onPatch, notify,
}: {
  session: RecorderSession;
  phase: ClockPhase;
  /** Merge changed recorder/meeting fields into the parent's session. */
  onPatch: (patch: Partial<RecorderSession>) => void;
  notify: (m: string) => void;
}) {
  const view = deriveRecorder(session);
  const platform = meetingPlatform(session.meetLink);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = shouldPollRecorder(phase, view.kind);
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;

  // ── Poll while live ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!poll) return;
    let stopped = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await apiJson<{ meetLink: string | null; recallBotId: string | null; recording: RecorderRecording | null }>(
          `/api/lms/admin/classes/${session.id}/recorder`,
        );
        if (!stopped) onPatchRef.current({ meetLink: r.meetLink, recallBotId: r.recallBotId, recording: r.recording });
      } catch { /* transient: the next tick retries */ }
    };
    const iv = setInterval(() => { void tick(); }, POLL_MS);
    const onVis = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [poll, session.id]);

  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

  const sendBot = useCallback(async () => {
    setBusy(true);
    try {
      const r = await apiJson<{ recallBotId: string }>(`/api/lms/admin/classes/${session.id}/retry-bot`, { method: 'POST' });
      onPatch({
        recallBotId: r.recallBotId,
        recording: {
          status: 'pending', errorMessage: null, durationSeconds: null,
          botStatus: null, botStatusAt: null, botJoinedAt: null, botRecordingAt: null,
        },
      });
      notify('Bot sent. It joins the meeting in about a minute.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not send the bot.');
    } finally {
      setBusy(false);
    }
  }, [session.id, onPatch, notify]);

  const copyLink = async () => {
    if (!session.meetLink) return;
    try {
      await navigator.clipboard.writeText(session.meetLink);
      setCopied(true);
      notify('Meeting link copied.');
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Could not copy. Select the link and copy it by hand.');
    }
  };

  const saveLink = async () => {
    const trimmed = linkDraft.trim();
    const next = trimmed === '' ? null : normaliseMaterialLink(trimmed);
    if (trimmed !== '' && !next) { notify('Enter a valid http(s) link.'); return; }
    setSavingLink(true);
    const previous = session.meetLink;
    onPatch({ meetLink: next });
    try {
      const r = await apiJson<{ recallBotId: string | null; recordingWarning?: string; calendarWarning?: string }>(
        `/api/lms/admin/classes/${session.id}`,
        { method: 'PATCH', json: { meetLink: next } },
      );
      onPatch({ meetLink: next, recallBotId: r.recallBotId });
      notify(r.recordingWarning ?? r.calendarWarning ?? 'Meeting link saved.');
      setEditing(false);
    } catch (e) {
      onPatch({ meetLink: previous });
      notify(e instanceof Error ? e.message : 'Could not save the link.');
    } finally {
      setSavingLink(false);
    }
  };

  const when = view.at ? fmtDhaka(view.at, { timeStyle: 'short' }) : null;

  return (
    <div
      role="group"
      aria-label="Meeting recorder"
      style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, background: TINT[view.tone], display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span aria-live="polite" style={{ display: 'inline-flex' }}>
          <Stamp tone={view.tone}>
            <Video size={12} aria-hidden />
            {view.label}
          </Stamp>
        </span>
        <div style={{ minWidth: 0, flex: '1 1 200px', fontSize: T_SM, color: SLATE }}>
          {platform ? (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              <b>{platform.name}</b>
              {platform.name !== platform.host && <span style={{ color: MUTED }}> · {platform.host}</span>}
              {view.atLabel && when && <span style={{ color: MUTED }}> · {view.atLabel} <span style={{ fontVariantNumeric: 'tabular-nums', color: SLATE }}>{when}</span></span>}
            </span>
          ) : (
            <span style={{ color: MUTED }}>No meeting link set</span>
          )}
          {view.reason && (
            <span style={{ display: 'block', fontSize: T_XS, color: view.tone === 'bad' ? RED : MUTED }}>{view.reason}</span>
          )}
        </div>
        <div className="tdy-recorder-actions">
          {view.canSend && <Btn variant="primary" onClick={() => void sendBot()} loading={busy}><Send size={13} aria-hidden />Send bot now</Btn>}
          {view.canRetry && <Btn variant={view.kind === 'failed' ? 'primary' : 'ghost'} onClick={() => void sendBot()} loading={busy}><RotateCw size={13} aria-hidden />Retry</Btn>}
          {session.meetLink && (
            <>
              <Btn onClick={() => void copyLink()} ariaLabel="Copy meeting link">
                {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}Copy link
              </Btn>
              <Btn href={session.meetLink} ariaLabel="Open meeting in a new tab"><ExternalLink size={13} aria-hidden />Open meeting</Btn>
            </>
          )}
          <Btn onClick={() => { setLinkDraft(session.meetLink ?? ''); setEditing(e => !e); }} ariaLabel="Edit meeting link">
            <Pencil size={13} aria-hidden />{session.meetLink ? 'Edit link' : 'Add link'}
          </Btn>
        </div>
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <FieldInput
              aria-label="Meeting link"
              value={linkDraft}
              onChange={e => setLinkDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void saveLink(); if (e.key === 'Escape') setEditing(false); }}
              placeholder="https://meet.google.com/..."
              inputMode="url"
              style={{ background: SURFACE, fontSize: T_BASE, borderRadius: R_MD }}
            />
          </div>
          <Btn variant="primary" onClick={() => void saveLink()} loading={savingLink}>Save link</Btn>
          <Btn onClick={() => setEditing(false)} ariaLabel="Cancel editing link"><X size={13} aria-hidden />Cancel</Btn>
        </div>
      )}
    </div>
  );
}
