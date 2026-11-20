/**
 * fetch POST with JSON body, retrying network errors and 5xx responses with backoff.
 * Only for endpoints that are safe to repeat (quiz/answer, practice/rate).
 * Returns the response like fetch does (callers keep their own res.ok handling);
 * throws only if the network fails on every attempt.
 */
export async function postWithRetry(
  url: string,
  body: unknown,
  { retries = 2, baseDelayMs = 400 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status < 500 || attempt >= retries) return res;
    } catch (err) {
      if (attempt >= retries) throw err;
    }
    await new Promise(r => setTimeout(r, baseDelayMs * 2 ** attempt));
  }
}
