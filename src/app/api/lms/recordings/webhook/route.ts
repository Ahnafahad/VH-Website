/**
 * POST /api/lms/recordings/webhook
 *
 * Receives Skribby webhook events.
 * No session auth — authenticated by X-Skribby-Signature HMAC-SHA256 header.
 *
 * Skribby only sends one event type, 'status_update'. On new_status='finished'
 * we poll GET /bot/{id} to fetch the recording_url (not included in the webhook
 * payload itself), then download and upload it to R2. Other terminal statuses
 * (not_admitted, bot_detected, auth_required, invalid_credentials, failed) are
 * treated as failures.
 *
 * maxDuration = 300 so the function can stream a full video to R2.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { Readable } from 'stream';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, recordings } from '@/lib/db/schema';
import { r2PutStream } from '@/lib/storage/r2';
import { getRecordingProvider } from '@/lib/recording/skribby';
import { sendRecordingFailedAlert } from '@/lib/email';

export const maxDuration = 300;

// ─── Signature verification ────────────────────────────────────────────────────
// Skribby signs: HMAC-SHA256(timestamp + "." + raw_body, SKRIBBY_WEBHOOK_SECRET)
// Header: X-Skribby-Signature: "sha256=<hex>"; X-Skribby-Timestamp: unix seconds

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

function verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.SKRIBBY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[webhook] SKRIBBY_WEBHOOK_SECRET not set — skipping verification (dev mode)');
    return true; // degrade gracefully at build time; in prod the secret must be set
  }

  const signatureHeader = headers.get('x-skribby-signature') ?? '';
  const timestampHeader  = headers.get('x-skribby-timestamp') ?? '';
  if (!signatureHeader || !timestampHeader) return false;

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const receivedHex = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
  const computedHex = createHmac('sha256', secret).update(`${timestampHeader}.${rawBody}`).digest('hex');

  try {
    const receivedBuf = Buffer.from(receivedHex, 'hex');
    const computedBuf = Buffer.from(computedHex, 'hex');
    return receivedBuf.length === computedBuf.length && timingSafeEqual(receivedBuf, computedBuf);
  } catch {
    return false;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

const FAILURE_STATUSES = new Set([
  'not_admitted',
  'bot_detected',
  'auth_required',
  'invalid_credentials',
  'failed',
]);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, req.headers)) {
    console.warn('[webhook] Skribby signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.type !== 'status_update') {
    return NextResponse.json({ ignored: true, type: payload.type });
  }

  const botId = typeof payload.bot_id === 'string' ? payload.bot_id : null;
  const data = payload.data as Record<string, unknown> | undefined;
  const newStatus = typeof data?.new_status === 'string' ? data.new_status : null;

  if (!botId || !newStatus) {
    console.warn('[webhook] Missing bot_id or new_status in payload', JSON.stringify(payload).slice(0, 500));
    return NextResponse.json({ ignored: true, reason: 'malformed_payload' });
  }

  const isDone = newStatus === 'finished';
  const isFailed = FAILURE_STATUSES.has(newStatus);

  if (!isDone && !isFailed) {
    // Intermediate status (booting, joining, recording, processing, transcribing, ...) — ack and ignore
    return NextResponse.json({ ignored: true, status: newStatus });
  }

  // Look up session by botId (stored in the recallBotId column, reused across providers)
  const session = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.recallBotId, botId))
    .get();

  if (!session) {
    console.log(`[webhook] No session found for botId ${botId} — ignoring`);
    return NextResponse.json({ ignored: true });
  }

  const recording = await db
    .select()
    .from(recordings)
    .where(eq(recordings.classSessionId, session.id))
    .get();

  if (!recording) {
    console.warn(`[webhook] No recordings row for session ${session.id} — ignoring`);
    return NextResponse.json({ ignored: true, reason: 'no_recording_row' });
  }

  // ── Handle failure statuses ───────────────────────────────────────────────
  if (isFailed) {
    const stopReason = typeof data?.stop_reason === 'string' ? data.stop_reason : newStatus;

    await db
      .update(recordings)
      .set({ status: 'failed', errorMessage: stopReason })
      .where(eq(recordings.id, recording.id));

    sendRecordingFailedAlert({
      sessionTitle: session.title,
      sessionId: session.id,
      botId,
      errorMessage: stopReason,
    }).catch((e) => console.error('[webhook] sendRecordingFailedAlert error:', e));

    return NextResponse.json({ ok: true, action: 'marked_failed' });
  }

  // ── Handle 'finished' status ──────────────────────────────────────────────
  // Mark as processing first so duplicate webhooks are harmless
  await db
    .update(recordings)
    .set({ status: 'processing' })
    .where(eq(recordings.id, recording.id));

  try {
    const provider = getRecordingProvider();
    if (!provider) throw new Error('SKRIBBY_API_KEY not set — cannot fetch video URL');

    // recording_url is not included in the webhook payload — poll the bot object
    const videoUrl = await provider.getVideoUrl(botId);
    if (!videoUrl) throw new Error(`No recording_url found for bot ${botId}`);

    // Stream from Skribby → R2 (server-to-server only, never through response)
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to fetch recording from Skribby: ${videoRes.status}`);
    }

    const contentLength = videoRes.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength, 10) : undefined;

    const r2Key = recording.r2Key;
    if (!videoRes.body) throw new Error('Video response has no body');

    // fetch()'s .body is a WHATWG ReadableStream — the S3 SDK's checksum
    // middleware needs a Node Readable, not that shape (throws "Unable to
    // calculate hash for flowing readable stream" otherwise).
    await r2PutStream(r2Key, Readable.fromWeb(videoRes.body as never), 'video/mp4');

    await db
      .update(recordings)
      .set({
        status: 'available',
        ...(fileSize !== undefined ? { fileSize } : {}),
        errorMessage: null,
      })
      .where(eq(recordings.id, recording.id));

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

    sendRecordingFailedAlert({
      sessionTitle: session.title,
      sessionId: session.id,
      botId,
      errorMessage: errMsg,
    }).catch((e) => console.error('[webhook] sendRecordingFailedAlert error (pipeline failure):', e));

    // Return 200 so Skribby doesn't retry (we've logged the error) — matches
    // Skribby's own "no automatic retry" behavior, kept for parity with our side.
    return NextResponse.json({ ok: false, error: errMsg });
  }
}
