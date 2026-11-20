import { describe, it, expect, vi, afterEach } from 'vitest';
import { postWithRetry } from '../post-with-retry';

const res = (status: number) => new Response('{}', { status });
afterEach(() => vi.unstubAllGlobals());

describe('postWithRetry', () => {
  it('retries network errors then returns the success', async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', f);
    expect((await postWithRetry('/x', { a: 1 }, { baseDelayMs: 0 })).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][1].body).toBe('{"a":1}');
  });

  it('retries 5xx but returns 4xx at once', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(400));
    vi.stubGlobal('fetch', f);
    expect((await postWithRetry('/x', {}, { baseDelayMs: 0 })).status).toBe(400);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('throws after the last failed attempt', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', f);
    await expect(postWithRetry('/x', {}, { baseDelayMs: 0 })).rejects.toThrow('offline');
    expect(f).toHaveBeenCalledTimes(3);
  });
});
