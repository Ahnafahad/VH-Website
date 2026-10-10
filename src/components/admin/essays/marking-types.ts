import type { EssayAnnotation } from '@/lib/essays/annotations';
import type { EssayHistogramBin, EssayPageDTO, EssaySection } from '@/lib/essays/types';

export interface SeriesInfo {
  id: number;
  title: string;
  essayCount: number;
  sections: EssaySection[];
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
  pageCount: number;
  lockedBy: { id: number; name: string } | null;
  assignedTo: { id: number; name: string } | null;
}

export interface SeriesStats {
  count: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  histogram: EssayHistogramBin[];
  sectionAverages: { key: string; name: string; max: number; average: number | null }[];
}

export interface ScriptDetail {
  id: number;
  seriesId: number;
  essayIndex: number;
  status: 'submitted' | 'graded' | 'rejected';
  attempt: number;
  submittedAt: string;
  student: { id: number; name: string; email: string; studentId: string | null; batch: string | null } | null;
  marks: Record<string, number | null>;
  sectionComments: Record<string, string>;
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
  marks: Record<string, number | null>;
  sectionComments: Record<string, string>;
  overallFeedback: string;
  privateNote: string;
}

export interface BankComment {
  id: number;
  text: string;
  shared: boolean;
}

export type PageItems = Record<number, EssayAnnotation[]>;
