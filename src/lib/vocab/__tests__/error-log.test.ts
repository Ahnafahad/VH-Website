import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing the logger
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
  vocabErrorLogs: {},
}));

import { logVocabError, logVocabErrorSafe } from '../error-log';

describe('logVocabError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves without throwing on a normal entry', async () => {
    await expect(
      logVocabError({ source: 'api', context: '/api/vocab/test', message: 'test error' })
    ).resolves.toBeUndefined();
  });

  it('resolves without throwing even when db.insert rejects', async () => {
    const { db } = await import('@/lib/db');
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      values: vi.fn().mockRejectedValueOnce(new Error('DB is down')),
    });

    await expect(
      logVocabError({ source: 'api', context: '/api/vocab/test', message: 'another error' })
    ).resolves.toBeUndefined();
  });

  it('truncates detail to 8000 chars', async () => {
    const { db } = await import('@/lib/db');
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({ values: valuesMock });

    const bigDetail = { data: 'x'.repeat(10_000) };
    await logVocabError({
      source:  'quiz_generation',
      context: 'all_providers_failed',
      message: 'too big',
      detail:  bigDetail,
    });

    const callArg = valuesMock.mock.calls[0]?.[0] as { detail?: string };
    expect(callArg.detail).toBeDefined();
    expect(callArg.detail!.length).toBeLessThanOrEqual(8000);
  });

  it('handles circular reference in detail without throwing', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(
      logVocabError({ source: 'client', context: 'page', message: 'circular', detail: circular })
    ).resolves.toBeUndefined();
  });

  it('uses "error" severity by default', async () => {
    const { db } = await import('@/lib/db');
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({ values: valuesMock });

    await logVocabError({ source: 'api', context: '/api/vocab/test', message: 'err' });

    const callArg = valuesMock.mock.calls[0]?.[0] as { severity?: string };
    expect(callArg.severity).toBe('error');
  });
});

describe('logVocabErrorSafe', () => {
  it('does not throw synchronously', () => {
    expect(() => {
      logVocabErrorSafe({ source: 'api', context: '/test', message: 'fire-and-forget' });
    }).not.toThrow();
  });
});
