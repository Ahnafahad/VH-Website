// ─── Skribby Recording Provider ──────────────────────────────────────────────
// Implements RecordingProvider against the Skribby REST API.
//
// Endpoints used:
//   POST /api/v1/bot             — schedule a bot
//   POST /api/v1/bot/{id}/stop   — stop/cancel a bot
//   GET  /api/v1/bot/{id}        — fetch bot details (for video URL)
//
// Auth header: Authorization: Bearer {SKRIBBY_API_KEY}
// Base URL: https://platform.skribby.io/api/v1 (EU) — configurable via SKRIBBY_REGION=jp
//
// Env vars (lazy — throw at call time, not at import time):
//   SKRIBBY_API_KEY      — required
//   SKRIBBY_REGION        — optional, 'eu' (default) or 'jp'
//   NEXTAUTH_URL          — optional, used to build the webhook_url sent to Skribby

import type { RecordingProvider, ScheduleBotArgs, ScheduleBotResult } from './provider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_TRANSCRIPTION_MODEL = 'deepgram/nova-2';

function getApiKey(): string {
  const key = process.env.SKRIBBY_API_KEY;
  if (!key) throw new Error('SKRIBBY_API_KEY is not set.');
  return key;
}

function getBaseUrl(): string {
  const region = process.env.SKRIBBY_REGION ?? 'eu';
  return region === 'jp' ? 'https://platform-jp.skribby.io/api/v1' : 'https://platform.skribby.io/api/v1';
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

function getWebhookUrl(): string {
  const base = (process.env.NEXTAUTH_URL ?? 'https://www.vh-beyondthehorizons.org').replace(/\/$/, '');
  return `${base}/api/lms/recordings/webhook`;
}

async function skribbyFetch(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Skribby ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<unknown>;
}

// ─── Provider implementation ──────────────────────────────────────────────────

class SkribbyProvider implements RecordingProvider {
  async scheduleBot(args: ScheduleBotArgs): Promise<ScheduleBotResult> {
    const payload = {
      meeting_url: args.meetingUrl,
      service: 'gmeet',
      bot_name: args.botName ?? 'VH Recorder',
      transcription_model: DEFAULT_TRANSCRIPTION_MODEL,
      video: true,
      scheduled_start_time: Math.floor(args.joinAt.getTime() / 1000),
      webhook_url: getWebhookUrl(),
    };

    const data = await skribbyFetch('POST', '/bot', payload) as { id: string };
    if (!data?.id) throw new Error('Skribby scheduleBot: missing id in response');
    return { botId: data.id };
  }

  async cancelBot(botId: string): Promise<void> {
    await skribbyFetch('POST', `/bot/${botId}/stop`);
  }

  async rescheduleBot(
    botId: string,
    args: ScheduleBotArgs,
  ): Promise<ScheduleBotResult> {
    // Skribby has no atomic reschedule for our purposes — stop + create
    try {
      await this.cancelBot(botId);
    } catch (err) {
      // Log but proceed — old bot may already be done
      console.warn('[Skribby] cancelBot during reschedule failed (non-fatal):', err);
    }
    return this.scheduleBot(args);
  }

  async getVideoUrl(botPayloadOrId: unknown): Promise<string | null> {
    let bot: Record<string, unknown>;

    if (typeof botPayloadOrId === 'string') {
      bot = await skribbyFetch('GET', `/bot/${botPayloadOrId}`) as Record<string, unknown>;
    } else if (botPayloadOrId && typeof botPayloadOrId === 'object') {
      bot = botPayloadOrId as Record<string, unknown>;
    } else {
      return null;
    }

    if (typeof bot.recording_url === 'string' && bot.recording_url) {
      return bot.recording_url;
    }

    return null;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _provider: SkribbyProvider | null = null;

/**
 * Returns the Skribby provider, or null if SKRIBBY_API_KEY is not set
 * (feature degrades gracefully — callers must handle null).
 */
export function getRecordingProvider(): RecordingProvider | null {
  if (!process.env.SKRIBBY_API_KEY) return null;
  if (!_provider) _provider = new SkribbyProvider();
  return _provider;
}
