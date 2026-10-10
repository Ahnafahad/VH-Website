/**
 * Shared Essay types — safe to import from client and server code.
 */

export interface EssaySection {
  key: string;
  name: string;
  max: number;
}

export type EssaySubmissionStatus = 'submitted' | 'graded' | 'rejected';

/** Student-facing status of one essay slot in a series. */
export type EssaySlotStatus = 'open' | 'submitted' | 'rejected' | 'graded' | 'missed' | 'closed';

export interface EssaySeriesStudentEntry {
  id: number;
  title: string;
  essayDate: string | null;
  deadline: string; // ISO
  essayCount: number;
  totalMarks: number;
  published: boolean;
  /** One entry per essay number (1..essayCount). */
  slots: { essayIndex: number; status: EssaySlotStatus; total: number | null }[];
  /** Series total across graded essays, only once results are visible. */
  seriesTotal: number | null;
  seriesMax: number;
}

export interface EssayHistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface EssayStats {
  count: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  histogram: EssayHistogramBin[];
}

export interface EssayPageDTO {
  id: number;
  pageIndex: number;
  width: number;
  height: number;
  rotation: number;
  imageUrl: string;
  annotations: import('./annotations').EssayAnnotation[];
}
