export type BlockType =
  | 'chapter' | 'section' | 'subsection' | 'subsubsection'
  | 'prose' | 'definition' | 'note' | 'rule' | 'passage' | 'usageNote' | 'challenge'
  | 'list' | 'math' | 'table' | 'mcq';

export interface McqOption {
  label: string;
  text: string;
}

export interface WorkbookBlock {
  id: string;
  type: BlockType;
  anchor?: string;
  content?: string;
  variant?: 'bullet' | 'ordered';
  items?: string[];
  // MCQ
  question?: string;
  questionType?: 'solved' | 'practice' | 'challenge';
  options?: McqOption[];
  correctLabel?: string | null;
  solutionHint?: string;
}

export interface WorkbookSection {
  id: string;
  title: string;
}

export interface WorkbookChapter {
  slug: string;
  part: string;
  chapterNumber: number;
  title: string;
  estimatedMinutes: number;
  sections: WorkbookSection[];
  blocks: WorkbookBlock[];
}

export interface ChapterMeta {
  slug: string;
  part: string;
  partSlug: string;
  chapterNumber: number;
  title: string;
  estimatedMinutes: number;
}

export interface WorkbookPart {
  slug: string;
  title: string;
  chapters: ChapterMeta[];
}

export type WorkbookProgressStatus = 'not_started' | 'in_progress' | 'completed';
