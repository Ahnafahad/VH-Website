/**
 * POST /api/lms/recordings/webhook
 *
 * Receives Recall.ai webhook events delivered via Svix.
 * No session auth — authenticated by Svix HMAC-SHA256 signature.
 *
 * Handled events:
 *   bot.done / recording.done  → download video → upload to R2 → mark available
 *   bot.fatal / bot.failed     → mark recording failed + notify admins
 *
 * maxDuration = 300 so the function can stream a full video to R2.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, recordings } from '@/lib/db/schema';
import { r2PutStream } from '@/lib/storage/r2';
import { getRecordingProvider } from '@/lib/recording/recall';
import { sendRecordingFailedAlert } from '@/lib/email';

export const maxDuration = 300;

// ─── Svix signature verification ──────────────────────────────────────────────
// Recall.ai uses Svix for webhook delivery.
// Signature spec: HMAC-SHA256 over "{svix-id}.{svix-timestamp}.{body}"
// The RECALL_WEBHOOK_SECRET is in the format "whsec_<base64-payload>".

function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
): boolean {
  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[webhook] RECALL_WEBHOOK_SECRET not set — skipping verification (dev mode)');
    return true; // degrade gracefully at build time; in prod the secret must be set
  }

  const svixId        = headers.get('svix-id')        ?? '';
  const svixTimestamp = headers.get('svix-timestamp')  ?? '';
  const svixSignature = headers.get('svix-signature')  ?? '';

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Decode the base64 part after 'whsec_'
  const base64Part = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keyBytes = Buffer.from(base64Part, 'base64');

  // Svix signed content: "{svix-id}.{svix-timestamp}.{rawBody}"
  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const computed = createHmac('sha256', keyBytes).update(toSign).digest('base64');

  // svix-signature may be "v1,<sig>" or space-separated multiple sigs
  const sigs = svixSignature.split(' ');
  for (const sigEntry of sigs) {
    const sig = sigEntry.startsWith('v1,') ? sigEntry.slice(3) : sigEntry;
    try {
      const computedBuf = Buffer.from(computed, 'base64');
      const receivedBuf = Buffer.from(sig, 'base64');
      if (
        computedBuf.length === receivedBuf.length &&
        timingSafeEqual(computedBuf, receivedBuf)
      ) {
        return true;
      }
    } catch {
      // malformed sig — continue to next
    }
  }
  return false;
}

// ─── Bot ID extraction (tolerant of different payload shapes) ─────────────────

function extractBotId(payload: Record<string, unknown>): string | null {
  // Shape 1: { event: 'bot.done', data: { bot: { id: '...' } } }
  const data = payload.data as Record<string, unknown> | undefined;
  if (data) {
    const bot = data.bot as Record<string, unknown> | undefined;
    if (typeof bot?.id === 'string') return bot.id;
    if (typeof data.bot_id === 'string') return data.bot_id;
    if (typeof data.id === 'string') return data.id;
  }
  // Shape 2: top-level { bot_id: '...' }
  if (typeof payload.bot_id === 'string') return payload.bot_id;
  // Shape 3: top-level { id: '...' }
  if (typeof payload.id === 'string') return payload.id;
  return null;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Read body as text for signature verification
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, req.headers)) {
    console.warn('[webhook] Svix signature verification failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = typeof payload.event === 'string' ? payload.event : '';

  // ── Classify event ────────────────────────────────────────────────────────
  const isDone =
    event === 'bot.done' ||
    event === 'recording.done' ||
    event === 'bot.status_change' ||
    // Some Recall versions use 'status_change' with status.code = 'done'
    (event === 'bot.status_change' &&
      ((payload.data as Record<string, unknown>)?.status as Record<string, unknown>)?.code === 'done');

  const isFailed =
    event === 'bot.fatal' ||
    event === 'bot.failed' ||
    event === 'recording.failed' ||
    (event === 'bot.status_change' &&
      (
        ((payload.data as Record<string, unknown>)?.status as Record<string, unknown>)?.code === 'fatal' ||
        ((payload.data as Record<string, unknown>)?.status as Record<string, unknown>)?.code === 'error'
      ));

  if (!isDone && !isFailed) {
    // Unknown event type — ack and ignore
    return NextResponse.json({ ignored: true, event });
  }

  const botId = extractBotId(payload);
  if (!botId) {
    console.warn('[webhook] Could not extract botId from payload', JSON.stringify(payload).slice(0, 500));
    return NextResponse.json({ ignored: true, reason: 'no_bot_id' });
  }

  // Look up session by recallBotId
  const session = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.recallBotId, botId))
    .get();

  if (!session) {
    console.log(`[webhook] No session found for botId ${botId} — ignoring`);
    return NextResponse.json({ ignored: true });
  }

  // Load recording row
  const recording = await db
    .select()
    .from(recordings)
    .where(eq(recordings.classSessionId, session.id))
    .get();

  if (!recording) {
    console.warn(`[webhook] No recordings row for session ${session.id} — ignoring`);
    return NextResponse.json({ ignored: true, reason: 'no_recording_row' });
  }

  // ── Handle failure events ─────────────────────────────────────────────────
  if (isFailed) {
    const errMsg =
      (typeof (payload.data as Record<string, unknown>)?.error === 'string'
        ? ((payload.data as Record<string, unknown>).error as string)
        : null) ?? `bot event: ${event}`;

    await db
      .update(recordings)
      .set({ status: 'failed', errorMessage: errMsg })
      .where(eq(recordings.id, recording.id));

    // Notify admins
    sendRecordingFailedAlert({
      sessionTitle: session.title,
      sessionId: session.id,
      botId,
      errorMessage: errMsg,
    }).catch((e) => console.error('[webhook] sendRecordingFailedAlert error:', e));

    return NextResponse.json({ ok: true, action: 'marked_failed' });
  }

  // ── Handle done event ─────────────────────────────────────────────────────
  // Mark as processing first so duplicate webhooks are harmless
  await db
    .update(recordings)
    .set({ status: 'processing' })
    .where(eq(recordings.id, recording.id));

  try {
    const provider = getRecordingProvider();
    if (!provider) throw new Error('RECALL_API_KEY not set — cannot fetch video URL');

    // Fetch bot details to get the video URL
    const videoUrl = await provider.getVideoUrl(botId);
    if (!videoUrl) throw new Error(`No video URL found for bot ${botId}`);

    // Stream from Recall → R2 (server-to-server only, never through response)
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video from Recall: ${videoRes.status}`);
    }

    // Determine file size from headers if available
    const contentLength = videoRes.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength, 10) : undefined;

    // Extract duration from payload if present
    const data = payload.data as Record<string, unknown> | undefined;
    const durationSeconds =
      typeof data?.duration === 'number' ? Math.floor(data.duration) :
      typeof (data?.recording as Record<string, unknown>)?.duration === 'number'
        ? Math.floor((data!.recording as Record<string, unknown>).duration as number)
        : undefined;

    // Upload to R2 via streaming
    const r2Key = recording.r2Key;
    if (!videoRes.body) throw new Error('Video response has no body');

    // Node.js ReadableStream → upload
    await r2PutStream(r2Key, videoRes.body as never, 'video/mp4');

    // Mark available
    await db
      .update(recordings)
      .set({
        status: 'available',
        ...(fileSize !== undefined ? { fileSize } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        errorMessage: null,
      })
      .where(eq(recordings.id, recording.id));

    // Mark session as completed
    await db
      .update(classSessions)
      .set({ status: 'completed' })
      .where(eq(classSessions.id, session.id));

    console.log(`[webhook] Recording ${recording.id} uploaded to R2 (${r2Key})`);
    return NextResponse.json({ ok: true, action: 'uploaded', recordingId: recording.id });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Recording pipeline failed for session ${session.id}:`, errMsg);

    await db
      .update(recordings)
      .set({ status: 'failed', errorMessage: errMsg })
      .where(eq(recordings.id, recording.id));

    // Notify admins
    sendRecordingFailedAlert({
      sessionTitle: session.title,
      sessionId: session.id,
      botId,
      errorMessage: errMsg,
    }).catch((e) => console.error('[webhook] sendRecordingFailedAlert error (pipeline failure):', e));

    // Return 200 so Recall doesn't retry (we've logged the error)
    return NextResponse.json({ ok: false, error: errMsg });
  }
}
