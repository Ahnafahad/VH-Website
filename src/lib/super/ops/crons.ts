import vercelConfig from '../../../../vercel.json';
import { getCronRun, isCronPaused, type CronRun } from './cron-log';

const DESCRIPTIONS: Record<string, string> = {
  'weekly-reset': 'LexiCore weekly leaderboard reset',
  decay: 'LexiCore daily streak/points decay',
  'weekly-summary': 'Weekly progress summary emails',
  'check-streaks': 'Streak-lost notification emails',
  'email-warmup': 'Sender-reputation email warm-up batch',
  'registration-blast': 'One-time registration announcement blast',
  'orientation-blast': 'One-time orientation announcement blast',
  'lms-generate-sessions': 'Generate upcoming class sessions',
  'recordings-cleanup': 'Report recordings past the student window (report-only, deletes nothing)',
  'lms-reminders': 'Class / homework / recording reminders',
  essays: 'Essay auto-publish sweep and deadline reminders',
};

export const cronName = (path: string) => path.split('/').pop() as string;

export interface CronInfo { name: string; path: string; schedules: string[]; description: string; paused: boolean; lastRun: CronRun | null }

export async function listCrons(): Promise<CronInfo[]> {
  const byName = new Map<string, { path: string; schedules: string[] }>();
  for (const c of vercelConfig.crons) {
    const name = cronName(c.path);
    const e = byName.get(name) ?? { path: c.path, schedules: [] };
    e.schedules.push(c.schedule);
    byName.set(name, e);
  }
  return Promise.all([...byName].map(async ([name, e]) => ({
    name, ...e, description: DESCRIPTIONS[name] ?? '',
    paused: await isCronPaused(name).catch(() => false),
    lastRun: await getCronRun(name),
  })));
}

export function knownCron(name: string) {
  return vercelConfig.crons.find(c => cronName(c.path) === name);
}
