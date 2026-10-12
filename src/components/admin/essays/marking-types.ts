import type { EssayAnnotation } from '@/lib/essays/annotations';
import type { EssayIndexStats } from '@/lib/essays/stats';
import type { EssayPageDTO } from '@/lib/essays/types';

export interface SeriesInfo {
  id: number;
  title: string;
  essayCount: number;
  totalMarks: number;
  deadline: string;
  publishedAt: string | null;
}

export interface ScriptListRow {
  id: number;
  studentName: string;
  essayIndex: number;
  status: 'submitted' | 'graded' | 'rejected';
  total: number | null;
  /** This essay's maximum. */
  max: number;
  pageCount: number;
  lockedBy: { id: number; name: string } | null;
  assignedTo: { id: number; name: string } | null;
}

export interface SeriesStats {
  /** One entry per essay number (index 0 = essay 1), each on that essay's own scale. */
  byEssay: EssayIndexStats[];
}

export interface ScriptDetail {
  id: number;
  seriesId: number;
  essayIndex: number;
  status: 'submitted' | 'graded' | 'rejected';
  attempt: number;
  submittedAt: string;
  student: { id: number; name: string; email: string; studentId: string | null; batch: string | null } | null;
  /** This essay's prompt ('' when the series prompt covers it). */
  prompt: string;
  /** This essay's maximum. */
  max: number;
  /** The mark for this essay. */
  total: number | null;
  overallFeedback: string;
  privateNote: string;
  rejectReason: string | null;
  gradedBy: { id: number; name: string } | null;
  gradedAt: string | null;
  lockedBy: { id: number; name: string } | null;
  isReference: boolean;
  referenceLabel: string | null;
  pages: EssayPageDTO[];
  history: { id: number; action: string; actor: string | null; at: string; before: unknown; after: unknown }[];
}

export interface MarksDraft {
  mark: number | null;
  overallFeedback: string;
  privateNote: string;
}

export interface BankComment {
  id: number;
  text: string;
  shared: boolean;
}

export type PageItems = Record<number, EssayAnnotation[]>;
