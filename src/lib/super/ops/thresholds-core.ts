import { z } from 'zod';

// Pure (no DB): safe to import from client components.
export type Tone = 'ok' | 'warn' | 'bad';

const limit = z.object({ warn: z.number().nonnegative(), bad: z.number().nonnegative() }).refine(l => l.warn <= l.bad, 'warn must be <= bad');
export const thresholdsSchema = z.object({ tursoRows: limit, tursoBytes: limit, r2Bytes: limit, r2Objects: limit });
export type Thresholds = z.infer<typeof thresholdsSchema>;

const GB = 1024 ** 3;
// ponytail: defaults sized to the free tiers (Turso 5 GB, R2 10 GB); edit in the UI.
export const DEFAULT_THRESHOLDS: Thresholds = {
  tursoRows: { warn: 1_000_000, bad: 5_000_000 },
  tursoBytes: { warn: 4 * GB, bad: 5 * GB },
  r2Bytes: { warn: 8 * GB, bad: 10 * GB },
  r2Objects: { warn: 50_000, bad: 100_000 },
};

export function evaluateThreshold(value: number | null | undefined, l: { warn: number; bad: number }): Tone | undefined {
  if (value == null) return undefined;
  return value >= l.bad ? 'bad' : value >= l.warn ? 'warn' : 'ok';
}
