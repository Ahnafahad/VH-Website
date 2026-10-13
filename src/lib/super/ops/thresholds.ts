import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';
import { DEFAULT_THRESHOLDS, thresholdsSchema, type Thresholds } from './thresholds-core';

export const THRESHOLD_KEY = 'super:ops:thresholds';
export { thresholdsSchema };

export async function getThresholds(): Promise<Thresholds> {
  try {
    const raw = await getLmsSetting(THRESHOLD_KEY);
    if (raw) return thresholdsSchema.parse(JSON.parse(raw));
  } catch { /* fall back to defaults */ }
  return DEFAULT_THRESHOLDS;
}

export async function saveThresholds(t: Thresholds): Promise<void> {
  await setLmsSetting(THRESHOLD_KEY, JSON.stringify(t));
}
