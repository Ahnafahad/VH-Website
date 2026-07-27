/**
 * Shared Turso write-conflict detection for retryable transactions.
 *
 * Turso/libSQL surfaces write contention as an opaque HTTP 4xx ("SERVER_ERROR")
 * at a statement or at commit, rather than as a typed error. Callers that wrap a
 * transaction in a retry loop use `isTursoConflict` to decide whether a failure
 * is worth replaying.
 *
 * Extracted verbatim from the two identical copies that previously lived in
 * `api/vocab/quiz/answer/route.ts` and `lib/vocab/game/finalize-guess.ts`.
 * Behaviour is unchanged — this is a locality fix, not a semantic one.
 */

/** Attempts (including the first) a retryable transaction gets before giving up. */
export const MAX_TX_ATTEMPTS = 3;

/**
 * True when `err` (or any cause within 4 levels) looks like Turso write
 * contention rather than a genuine application error.
 */
export function isTursoConflict(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/SERVER_ERROR|returned HTTP status 4\d\d|SQLITE_BUSY|database is locked|write conflict/i.test(msg)) {
      return true;
    }
    e = e instanceof Error ? (e as { cause?: unknown }).cause : undefined;
  }
  return false;
}
