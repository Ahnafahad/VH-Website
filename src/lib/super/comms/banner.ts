/** In-app banner stored in lmsSettings `super:comms:banner`. Global (not segment-scoped). */
import { z } from 'zod';
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';

export const BANNER_KEY = 'super:comms:banner';
export const BANNER_LEVELS = ['info', 'warn', 'urgent'] as const;
export const bannerSchema = z.object({
  text: z.string().trim().min(1).max(280),
  level: z.enum(BANNER_LEVELS),
  expiresAt: z.number().int(), // epoch ms
});
export type Banner = z.infer<typeof bannerSchema>;

/** Pure: returns the banner only while it is set and unexpired. */
export function activeBanner(raw: string | null | undefined, now = Date.now()): Banner | null {
  if (!raw) return null;
  try {
    const parsed = bannerSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.expiresAt > now ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getActiveBanner(): Promise<Banner | null> {
  return activeBanner(await getLmsSetting(BANNER_KEY));
}

export async function setBanner(b: Banner): Promise<void> {
  await setLmsSetting(BANNER_KEY, JSON.stringify(b));
}

/** Clearing = storing an already-expired empty marker (lmsSettings has no delete helper). */
export async function clearBanner(): Promise<void> {
  await setLmsSetting(BANNER_KEY, '');
}
