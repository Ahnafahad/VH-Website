// Client-side only — module-level singleton cache for quiz generation prefetching.
// Allows the AI call to start while the user is reading the QuizConfigSheet.

type QuizBody =
  | { type: 'study';    themeId:  number;    questionCount: number }
  | { type: 'practice'; themeIds: number[];  questionCount: number }
  | { type: 'letter';   wordIds:  number[];  questionCount: number };

interface CacheEntry {
  promise:   Promise<unknown>;
  key:       string;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes

let entry: CacheEntry | null = null;

function buildKey(body: QuizBody): string {
  if (body.type === 'practice') {
    return `practice:${[...body.themeIds].sort((a, b) => a - b).join(',')}:${body.questionCount}`;
  }
  if (body.type === 'letter') {
    return `letter:${[...body.wordIds].sort((a, b) => a - b).join(',')}:${body.questionCount}`;
  }
  return `study:${body.themeId}:${body.questionCount}`;
}

/** Fire-and-forget: starts the AI call immediately and caches the promise.
 *  Deduplicates: skips if an identical in-flight request exists within TTL. */
export function prefetchQuiz(body: QuizBody): void {
  const key = buildKey(body);
  const now = Date.now();

  if (entry && entry.key === key && entry.expiresAt > now) return;

  const promise = fetch('/api/vocab/quiz/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).then(r => {
    if (!r.ok) throw new Error('generation failed');
    return r.json();
  });

  entry = { promise, key, expiresAt: now + TTL_MS };
}

/** Consume the cached promise if params match and TTL is valid.
 *  Clears the entry on hit (consume-once). Returns null on miss. */
export function consumePrefetch(body: QuizBody): Promise<unknown> | null {
  if (!entry) return null;
  const key = buildKey(body);
  if (entry.key !== key || entry.expiresAt < Date.now()) {
    entry = null;
    return null;
  }
  const p = entry.promise;
  entry = null;
  return p;
}
