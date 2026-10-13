import type { RecorderRecording } from '@/lib/lms/today-cockpit';

export interface OfflineShowcaseEntry {
  submissionId: number;
  userId: number;
  userName: string;
  userEmail: string;
  checked: boolean;
  submittedAt: number;
  assignmentId: number;
  assignmentTitle: string;
}

export interface TodaySession {
  id: number;
  title: string;
  subject: string;
  product: string;
  batch: string | null;
  scheduledAt: number;
  durationMinutes: number;
  status: string;
  meetLink: string | null;
  description: string | null;
  recallBotId: string | null;
  recording: RecorderRecording | null;
  homework: { id: number; title: string; dueAt: number }[];
  attendanceCount: number;
  materialsCount: number;
  pendingReviewCount: number;
  offlineShowcase: OfflineShowcaseEntry[];
}

export interface BatchOption {
  id: number;
  name: string;
  product: string;
  status: string;
}

export type SessionPatch = Partial<TodaySession> | ((s: TodaySession) => Partial<TodaySession>);
