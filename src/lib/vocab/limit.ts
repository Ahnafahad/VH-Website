// Client helper for the free-plan 402 (code LEXICORE_LIMIT) the gated vocab routes return.

export type LimitKind = 'cards' | 'quizzes';

/** Thrown by fetch wrappers (e.g. quiz prefetch) so callers can tell "limit hit" from a real failure. */
export class LimitError extends Error {
  constructor(public kind: LimitKind) { super('LEXICORE_LIMIT'); }
}

/** The limit kind if `res` is a LexiCore daily-limit 402, else null. Safe to call before reading the body. */
export async function limitKindOf(res: Response, fallback: LimitKind = 'cards'): Promise<LimitKind | null> {
  if (res.status !== 402) return null;
  const body = await res.clone().json().catch(() => null) as { code?: string; kind?: string } | null;
  if (body?.code !== 'LEXICORE_LIMIT') return null;
  return body.kind === 'quizzes' || body.kind === 'cards' ? body.kind : fallback;
}
