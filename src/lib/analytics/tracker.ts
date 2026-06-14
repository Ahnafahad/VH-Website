/**
 * Analytics tracker — CLIENT-SAFE utility (no React, guards all browser APIs).
 * Import from any client component or 'use client' boundary.
 */

import type { AnalyticsEventType, AnalyticsModule } from '@/lib/db/schema';

// ─── Re-export types so callers can import from one place ────────────────────
export type { AnalyticsEventType, AnalyticsModule };

// ─── Constants ────────────────────────────────────────────────────────────────

const ANON_ID_KEY    = 'vh_anon_id';
const SESSION_ID_KEY = 'vh_session_id';
const SESSION_TS_KEY = 'vh_session_ts';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const MAX_QUEUE_SIZE = 50;
const INGEST_URL = '/api/analytics/ingest';

// ─── Module-level state ───────────────────────────────────────────────────────

let _userId: number | null = null;
let _isAuthenticated = false;

interface QueuedEvent {
  sessionId: string;
  anonId: string;
  userId: number | null;
  type: AnalyticsEventType;
  module: AnalyticsModule;
  path?: string;
  name?: string;
  props?: Record<string, unknown>;
  durationMs?: number;
  ts: number;
}

const _queue: QueuedEvent[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

// ─── ID helpers ───────────────────────────────────────────────────────────────

export function getAnonId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  const now = Date.now();
  const lastTs = parseInt(sessionStorage.getItem(SESSION_TS_KEY) ?? '0', 10);
  const gap = now - lastTs;
  const existingId = sessionStorage.getItem(SESSION_ID_KEY);

  // Start new session if gap > 30 min OR no existing session
  if (!existingId || (lastTs > 0 && gap > SESSION_TIMEOUT_MS)) {
    const newId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, newId);
    sessionStorage.setItem(SESSION_TS_KEY, String(now));
    return newId;
  }

  // Refresh last-activity timestamp
  sessionStorage.setItem(SESSION_TS_KEY, String(now));
  return existingId;
}

// ─── Device detection ─────────────────────────────────────────────────────────

export function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const w = window.innerWidth;
  const isMobileUA = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|Tablet/i.test(ua);
  if (isMobileUA && !isTabletUA && w < 768) return 'mobile';
  if (isTabletUA || (w >= 768 && w < 1024)) return 'tablet';
  return 'desktop';
}

// ─── UTM parsing ─────────────────────────────────────────────────────────────

export function parseUtm(): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
} {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(location.search);
  const result: { utmSource?: string; utmMedium?: string; utmCampaign?: string } = {};
  const src = params.get('utm_source');
  const med = params.get('utm_medium');
  const cam = params.get('utm_campaign');
  if (src) result.utmSource = src;
  if (med) result.utmMedium = med;
  if (cam) result.utmCampaign = cam;
  return result;
}

// ─── Auth state ───────────────────────────────────────────────────────────────

export function setAnalyticsUser(userId: number | null, isAuthenticated = true): void {
  _userId = userId;
  _isAuthenticated = isAuthenticated;
}

// ─── Session payload builder ──────────────────────────────────────────────────

function buildSessionPayload() {
  if (typeof window === 'undefined') return null;
  const utm = parseUtm();
  return {
    id:              getSessionId(),
    anonId:          getAnonId(),
    userId:          _userId,
    isAuthenticated: _isAuthenticated,
    entryPath:       location.pathname,
    referrer:        document.referrer || undefined,
    device:          detectDevice(),
    userAgent:       navigator.userAgent,
    ...utm,
  };
}

// ─── Flush logic ──────────────────────────────────────────────────────────────

export function flush(useBeacon = false): void {
  if (typeof window === 'undefined') return;
  if (_queue.length === 0) return;

  const events = _queue.splice(0, _queue.length);
  const session = buildSessionPayload();
  if (!session) return;

  const payload = JSON.stringify({ session, events });

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(INGEST_URL, new Blob([payload], { type: 'application/json' }));
  } else {
    fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* fire-and-forget; never throw */ });
  }
}

function scheduledFlush(): void {
  if (_flushTimer) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flush();
  }, 1000); // 1-second debounce for pageviews
}

function enqueue(event: QueuedEvent, immediate = false): void {
  if (_queue.length >= MAX_QUEUE_SIZE) {
    // Queue full — drop oldest to make room
    _queue.shift();
  }
  _queue.push(event);

  if (immediate) {
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    flush();
  } else {
    scheduledFlush();
  }
}

// ─── Public tracking functions ────────────────────────────────────────────────

export function trackPageview(path: string, module: AnalyticsModule): void {
  if (typeof window === 'undefined') return;
  const event: QueuedEvent = {
    sessionId:  getSessionId(),
    anonId:     getAnonId(),
    userId:     _userId,
    type:       'pageview',
    module,
    path,
    ts:         Date.now(),
  };
  enqueue(event, false); // debounced
}

export function trackPageExit(path: string, module: AnalyticsModule, durationMs: number): void {
  if (typeof window === 'undefined') return;
  const event: QueuedEvent = {
    sessionId:  getSessionId(),
    anonId:     getAnonId(),
    userId:     _userId,
    type:       'page_exit',
    module,
    path,
    durationMs,
    ts:         Date.now(),
  };
  enqueue(event, true); // immediate flush on exit
}

export function trackFeature(
  name: string,
  module: AnalyticsModule,
  props?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  const event: QueuedEvent = {
    sessionId: getSessionId(),
    anonId:    getAnonId(),
    userId:    _userId,
    type:      'feature',
    module,
    path:      location.pathname,
    name,
    props,
    ts:        Date.now(),
  };
  enqueue(event, true); // immediate flush on feature events
}

export function trackEvent(e: {
  type: AnalyticsEventType;
  name?: string;
  module: AnalyticsModule;
  path?: string;
  props?: Record<string, unknown>;
  durationMs?: number;
}): void {
  if (typeof window === 'undefined') return;
  const immediate = e.type === 'feature' || e.type === 'page_exit' || e.type === 'click';
  const event: QueuedEvent = {
    sessionId:  getSessionId(),
    anonId:     getAnonId(),
    userId:     _userId,
    type:       e.type,
    module:     e.module,
    path:       e.path ?? (typeof window !== 'undefined' ? location.pathname : undefined),
    name:       e.name,
    props:      e.props,
    durationMs: e.durationMs,
    ts:         Date.now(),
  };
  enqueue(event, immediate);
}
