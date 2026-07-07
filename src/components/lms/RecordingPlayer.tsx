'use client';

/**
 * RecordingPlayer
 *
 * Client component that:
 * 1. Fetches a short-lived presigned URL from /api/lms/recordings/[id]/watch-url
 * 2. Renders an HTML5 <video> element — bytes never pass through our server
 * 3. Seeks to resumeAt once metadata is loaded
 * 4. Heartbeats POST .../progress every 30 s while playing + on pause/unmount
 *    (sendBeacon fallback for unmount)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, AlertCircle, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  recordingId: number;
  sessionTitle: string;
  subject: string;
  scheduledAt: number; // epoch ms
  durationSeconds: number | null;
  recordingStatus: string;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; url: string; resumeAt: number }
  | { phase: 'error'; code: string; message: string };

const REASON_COPY: Record<string, string> = {
  NOT_READY:
    'This recording is still being processed. Check back in a few minutes.',
  EXPIRED_WINDOW:
    'Recording window has closed — ask your instructor for an extension.',
  LMS_ACCESS_DENIED: 'You do not have access to this class.',
};

export default function RecordingPlayer({
  recordingId,
  sessionTitle,
  subject,
  scheduledAt,
  durationSeconds,
  recordingStatus,
}: Props) {
  const [loadState, setLoadState] = useState<LoadState>({ phase: 'loading' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeApplied = useRef(false);
  const lastHeartbeatAt = useRef(Date.now());
  const watchStartPosition = useRef(0);
  const isPlaying = useRef(false);

  // ── Fetch presigned URL ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lms/recordings/${recordingId}/watch-url`);
        if (cancelled) return;

        if (!res.ok) {
          let code = 'UNKNOWN';
          try {
            const json = await res.json() as { code?: string; error?: string };
            code = json.code ?? code;
          } catch { /* ignore */ }
          const message = REASON_COPY[code] ?? 'This recording is not available right now.';
          setLoadState({ phase: 'error', code, message });
          return;
        }

        const json = await res.json() as { url: string; resumeAt: number };
        setLoadState({ phase: 'ready', url: json.url, resumeAt: json.resumeAt ?? 0 });
        watchStartPosition.current = json.resumeAt ?? 0;
      } catch (err) {
        if (cancelled) return;
        console.error('[RecordingPlayer] fetch error:', err);
        setLoadState({
          phase: 'error',
          code: 'FETCH_ERROR',
          message: 'Could not load the recording. Please try again.',
        });
      }
    })();
    return () => { cancelled = true; };
  }, [recordingId]);

  // ── Seek to resumeAt once metadata loaded ──────────────────────────────────
  const handleMetadataLoaded = useCallback(() => {
    if (resumeApplied.current) return;
    if (loadState.phase !== 'ready') return;
    const video = videoRef.current;
    if (!video) return;
    const pos = loadState.resumeAt;
    if (pos > 0 && isFinite(pos)) {
      video.currentTime = pos;
    }
    resumeApplied.current = true;
  }, [loadState]);

  // ── Progress heartbeat helper ──────────────────────────────────────────────
  const sendProgress = useCallback(
    (position: number, delta: number, useBeacon = false) => {
      const body = JSON.stringify({
        positionSeconds: Math.floor(position),
        secondsWatchedDelta: Math.floor(delta),
      });
      const url = `/api/lms/recordings/${recordingId}/progress`;
      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).catch((e) => console.warn('[RecordingPlayer] progress error:', e));
    },
    [recordingId],
  );

  // ── 30-second heartbeat while playing ─────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay  = () => { isPlaying.current = true; };
    const onPause = () => {
      isPlaying.current = false;
      const now = Date.now();
      const delta = (now - lastHeartbeatAt.current) / 1000;
      lastHeartbeatAt.current = now;
      sendProgress(video.currentTime, delta);
    };

    const interval = setInterval(() => {
      if (!isPlaying.current) return;
      const now = Date.now();
      const delta = (now - lastHeartbeatAt.current) / 1000;
      lastHeartbeatAt.current = now;
      sendProgress(video.currentTime, delta);
    }, 30_000);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      clearInterval(interval);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      // On unmount: send remaining watched time via sendBeacon
      if (video.currentTime > 0) {
        const delta = isPlaying.current
          ? (Date.now() - lastHeartbeatAt.current) / 1000
          : 0;
        sendProgress(video.currentTime, delta, true);
      }
    };
  }, [sendProgress, loadState]);

  const scheduledDate = new Date(scheduledAt);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#F7F4F0]"
      style={{ colorScheme: 'light' }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8DDD5] px-4 py-3 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#F7F4F0] transition-colors flex-shrink-0"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-[#5A0B0F]" strokeWidth={2} />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-[#1A0507] truncate leading-tight">
            {sessionTitle}
          </h1>
          <p className="text-[11px] text-[#A86E58] mt-0.5 capitalize">
            {subject} &middot; {formatDhaka(scheduledDate, 'date')}
          </p>
        </div>
      </div>

      {/* ── Video area ────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-0 sm:px-4 pt-4 sm:pt-6 pb-8">
        {loadState.phase === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="aspect-video bg-[#1A0507] flex flex-col items-center justify-center gap-3 sm:rounded-xl overflow-hidden"
          >
            <Loader2 className="w-8 h-8 text-[#D4B094] animate-spin" strokeWidth={1.5} />
            <p className="text-sm text-[#D4B094]/70">Loading recording…</p>
          </motion.div>
        )}

        {loadState.phase === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="aspect-video bg-[#1A0507] flex flex-col items-center justify-center gap-4 sm:rounded-xl overflow-hidden px-6 text-center"
          >
            <AlertCircle
              className="w-10 h-10 text-[#D62B38]"
              strokeWidth={1.5}
            />
            <div>
              <p className="text-sm font-medium text-[#FAF5EF] mb-1">
                Recording unavailable
              </p>
              <p className="text-xs text-[#D4B094]/70 leading-relaxed max-w-xs">
                {loadState.message}
              </p>
            </div>

            {/* If not-ready, show status context */}
            {recordingStatus === 'pending' || recordingStatus === 'processing' ? (
              <div className="flex items-center gap-1.5 text-[#D4B094]/60 text-xs mt-1">
                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>
                  {recordingStatus === 'pending'
                    ? 'Waiting for class to end'
                    : 'Processing video…'}
                </span>
              </div>
            ) : null}
          </motion.div>
        )}

        {loadState.phase === 'ready' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="sm:rounded-xl overflow-hidden shadow-lg"
          >
            <video
              ref={videoRef}
              src={loadState.url}
              controls
              playsInline
              onLoadedMetadata={handleMetadataLoaded}
              className="w-full aspect-video bg-black"
              style={{ display: 'block' }}
              preload="metadata"
            >
              Your browser does not support HTML5 video.
            </video>
          </motion.div>
        )}

        {/* ── Info below player ────────────────────────────────────────────── */}
        {loadState.phase === 'ready' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="px-4 sm:px-0 mt-4"
          >
            <div className="rounded-xl border border-[#E8DDD5] bg-white p-4 sm:p-5">
              <p className="text-[10px] uppercase tracking-widest text-[#A86E58] mb-1 font-sans">
                Class recording
              </p>
              <p className="text-sm font-semibold text-[#1A0507] leading-snug">
                {sessionTitle}
              </p>
              <p className="text-xs text-[#A86E58] mt-1">
                {formatDhaka(scheduledDate, 'datetime')}
                {durationSeconds ? ` · ${Math.round(durationSeconds / 60)} min` : ''}
              </p>
              <p className="text-xs text-[#A86E58]/60 mt-3 leading-relaxed">
                Your progress is saved automatically. You can close this page and resume later.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
