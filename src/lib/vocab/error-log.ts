/**
 * LexiCore error logger.
 *
 * Inserts rows into vocab_error_logs. Completely non-throwing — any failure
 * inside this module is caught and printed to console, never re-thrown, so a
 * logging failure can never break the request that triggered it.
 */

import { after } from 'next/server';
import { db } from '@/lib/db';
import { vocabErrorLogs } from '@/lib/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VocabErrorEntry {
  source:     'quiz_generation' | 'api' | 'client';
  severity?:  'error' | 'warning';
  context:    string;
  message:    string;
  detail?:    unknown;
  userEmail?: string | null;
}

const DETAIL_MAX_LEN = 8000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeStringify(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    // Circular reference or other serialisation error — try a plain toString
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

// ─── Core logger ─────────────────────────────────────────────────────────────

export async function logVocabError(entry: VocabErrorEntry): Promise<void> {
  try {
    const rawDetail = safeStringify(entry.detail);
    const detail    = rawDetail && rawDetail.length > DETAIL_MAX_LEN
      ? rawDetail.slice(0, DETAIL_MAX_LEN)
      : rawDetail;

    await db.insert(vocabErrorLogs).values({
      source:    entry.source,
      severity:  entry.severity ?? 'error',
      context:   entry.context,
      message:   entry.message,
      detail:    detail ?? null,
      userEmail: entry.userEmail ?? null,
    });
  } catch (err) {
    // Logging must never throw — print and swallow.
    console.error('[VocabErrorLog] Failed to write error log entry:', err);
  }
}

// ─── Fire-and-forget wrapper ──────────────────────────────────────────────────
// For call sites that cannot await (e.g. inside catch blocks in sync-looking code).

export function logVocabErrorSafe(entry: VocabErrorEntry): void {
  const pending = logVocabError(entry); // never rejects
  // On serverless the function freezes once the response is sent, dropping
  // in-flight writes — after() keeps it alive until the insert lands.
  try {
    after(pending);
  } catch {
    // Outside a request scope (tests, scripts) — plain fire-and-forget.
  }
}
