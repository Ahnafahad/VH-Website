// ─── Recall.ai Recording Provider ────────────────────────────────────────────
// Implements RecordingProvider against the Recall.ai REST API.
//
// Endpoints used:
//   POST   /api/v1/bot             — schedule a bot
//   DELETE /api/v1/bot/{id}/       — cancel a bot
//   GET    /api/v1/bot/{id}/       — fetch bot details (for video URL)
//
// Auth header: Authorization: Token {RECALL_API_KEY}
// Default base URL: https://us-east-1.recall.ai  (configurable via RECALL_REGION)
//
// Env vars (lazy — throw at call time, not at import time):
//   RECALL_API_KEY      — required
//   RECALL_REGION       — optional, default 'us-east-1'

import type { RecordingProvider, ScheduleBotArgs, ScheduleBotResult } from './provider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.RECALL_API_KEY;
  if (!key) throw new Error('RECALL_API_KEY is not set.');
  return key;
}

function getBaseUrl(): string {
  const region = process.env.RECALL_REGION ?? 'us-east-1';
  return `https://${region}.recall.ai`;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Token ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

async function recallFetch(
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
    throw new Error(`Recall.ai ${method} ${path} → ${res.status}: ${text}`);
  }

  // DELETE 204 has no body
  if (res.status === 204) return null;
  return res.json() as Promise<unknown>;
}

// ─── Provider implementation ──────────────────────────────────────────────────

class RecallProvider implements RecordingProvider {
  async scheduleBot(args: ScheduleBotArgs): Promise<ScheduleBotResult> {
    const payload = {
      meeting_url: args.meetingUrl,
      join_at: args.joinAt.toISOString(),
      bot_name: args.botName ?? 'VH Recorder',
      recording_config: {
        video_mixed_mp4: {},
      },
    };

    const data = await recallFetch('POST', '/api/v1/bot/', payload) as { id: string };
    if (!data?.id) throw new Error('Recall.ai scheduleBot: missing id in response');
    return { botId: data.id };
  }

  async cancelBot(botId: string): Promise<void> {
    await recallFetch('DELETE', `/api/v1/bot/${botId}/`);
  }

  async rescheduleBot(
    botId: string,
    args: ScheduleBotArgs,
  ): Promise<ScheduleBotResult> {
    // Recall.ai has no PATCH/reschedule — cancel + create
    try {
      await this.cancelBot(botId);
    } catch (err) {
      // Log but proceed — old bot may already be done
      console.warn('[Recall] cancelBot during reschedule failed (non-fatal):', err);
    }
    return this.scheduleBot(args);
  }

  async getVideoUrl(botPayloadOrId: unknown): Promise<string | null> {
    // If a string was passed, treat as bot id and fetch from API
    let bot: Record<string, unknown>;

    if (typeof botPayloadOrId === 'string') {
      bot = await recallFetch('GET', `/api/v1/bot/${botPayloadOrId}/`) as Record<string, unknown>;
    } else if (botPayloadOrId && typeof botPayloadOrId === 'object') {
      bot = botPayloadOrId as Record<string, unknown>;
    } else {
      return null;
    }

    // Recall.ai bot object shape (best-effort — may vary by SDK version):
    // bot.video_url  — direct download URL (some regions)
    // bot.recordings[].media_shortcuts.video_mixed_mp4.data.url
    // bot.recordings[].media_shortcuts.video_mixed_mp4.download_url

    // Try top-level video_url first
    if (typeof bot.video_url === 'string' && bot.video_url) {
      return bot.video_url;
    }

    // Walk recordings array
    const recordings = Array.isArray(bot.recordings) ? bot.recordings as Record<string, unknown>[] : [];
    for (const rec of recordings) {
      const shortcuts = rec.media_shortcuts as Record<string, unknown> | undefined;
      if (!shortcuts) continue;

      const mp4 = shortcuts.video_mixed_mp4 as Record<string, unknown> | undefined;
      if (!mp4) continue;

      // download_url is typically a pre-signed URL
      if (typeof mp4.download_url === 'string' && mp4.download_url) {
        return mp4.download_url;
      }

      // Fallback: data.url
      const data = mp4.data as Record<string, unknown> | undefined;
      if (typeof data?.url === 'string' && data.url) {
        return data.url as string;
      }
    }

    // Try output_media for older API versions
    const outputMedia = Array.isArray(bot.output_media)
      ? (bot.output_media as Record<string, unknown>[])
      : [];
    for (const om of outputMedia) {
      if (typeof om.download_url === 'string' && om.download_url) return om.download_url;
      if (typeof om.url === 'string' && om.url) return om.url;
    }

    return null;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _provider: RecallProvider | null = null;

/**
 * Returns the Recall.ai provider, or null if RECALL_API_KEY is not set
 * (feature degrades gracefully — callers must handle null).
 */
export function getRecordingProvider(): RecordingProvider | null {
  if (!process.env.RECALL_API_KEY) return null;
  if (!_provider) _provider = new RecallProvider();
  return _provider;
}
