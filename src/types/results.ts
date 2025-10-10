// Results System Type Definitions
// Based on Excel file analysis and VH Results Claude Guide specifications

export interface StudentData {
  id: string;
  name: string;
  email: string;
}

export interface SimpleTestResult {
  studentId: string;
  studentName: string;
  correct: number;
  wrong: number;
  unattempted?: number;
  totalQuestions: number;
  score: number;
  rank: number;
  threshold: number;
  sections?: {
    [sectionNumber: string]: {
      correct: number;
      wrong: number;
      score: number;
      totalQuestions: number;
    };
  };
  essays?: {
    [essayNumber: string]: number;
  };
  analytics: {
    accuracy: number;
    attemptRate: number;
    passStatus: boolean;
    percentile: number;
  };
}

export interface FullTestResult {
  studentId: string;
  studentName: string;
  sections: {
    [sectionNumber: string]: {
      correct: number;
      wrong: number;
      marks: number;
      percentage: number;
      totalQuestions: number;
    };
  };
  totalMarks: number;
  mcqMarks?: number; // MCQ marks only
  essayMarks?: number; // Essay marks only
  mcqCorrect?: number; // Total MCQ correct answers
  mcqWrong?: number; // Total MCQ wrong answers
  mcqAccuracy?: number; // MCQ accuracy (correct/attempted) %
  mcqPercentage?: number; // MCQ percentage (separate from total)
  totalPercentage: number; // Overall percentage including essays
  maxEssayMarks?: number; // Maximum possible essay marks
  rank: number;
  essays?: {
    [essayNumber: string]: number;
  };
  responses: {
    [questionId: string]: string; // e.g., "E (C)", "NAN", "A (W)"
  };
  analytics: {
    skipStrategy: number; // 0-100 score
    questionChoiceStrategy: number; // 0-100 score
    recoveryScore: number; // 0-100 score
    sectionPerformance: {
      [sectionNumber: string]: {
        accuracy: number;
        attemptRate: number;
        efficiency: number;
      };
    };
  };
}

export interface TestClassStats {
  averageScore: number;
  top5Average: number;
  threshold: number;
  totalStudents: number;
  passRate: number;
  questionAnalytics?: {
    [questionId: string]: {
      correctCount: number;
      wrongCount: number;
      skippedCount: number;
      difficulty: number;
    };
  };
}

export interface SimpleTest {
  testName: string;
  testSeries: string;
  testNumber: number;
  testType: 'simple';
  results: {
    [studentId: string]: SimpleTestResult;
  };
  classStats: TestClassStats;
  metadata: {
    processedAt: string;
    sourceFile: string;
    sheetName: string;
  };
}

export interface FullTest {
  testName: string;
  testType: 'full';
  sections: string[];
  results: {
    [studentId: string]: FullTestResult;
  };
  classStats: TestClassStats;
  topQuestions: {
    [sectionNumber: string]: {
      mostCorrect: Array<{ questionId: string; count: number }>;
      mostWrong: Array<{ questionId: string; count: number }>;
      mostSkipped: Array<{ questionId: string; count: number }>;
    };
  };
  metadata: {
    processedAt: string;
    sourceFile: string;
    sheets: string[];
  };
}

export interface TestSeries {
  seriesName: string;
  tests: string[];
  progressionData: Array<{
    testName: string;
    studentPerformance: {
      [studentId: string]: {
        score: number;
        rank: number;
        accuracy: number;
        improvement: number; // vs previous test
      };
    };
  }>;
}

export interface StudentsData {
  students: {
    [studentId: string]: StudentData;
  };
  metadata: {
    totalStudents: number;
    lastUpdated: string;
  };
}

export interface SimpleTestsData {
  tests: {
    [testName: string]: SimpleTest;
  };
  series: {
    [seriesName: string]: TestSeries;
  };
  metadata: {
    totalTests: number;
    lastProcessed: string;
    version: string;
  };
}

export interface FullTestsData {
  tests: {
    [testName: string]: FullTest;
  };
  metadata: {
    totalTests: number;
    lastProcessed: string;
    version: string;
  };
}

export interface SystemMetadata {
  version: string;
  lastProcessed: string;
  totalStudents: number;
  totalSimpleTests: number;
  totalFullTests: number;
  processingStats: {
    successfulTests: number;
    failedTests: number;
    warnings: string[];
  };
}

// Column mapping for dynamic Excel parsing
export interface ColumnPatterns {
  studentId: string[];
  studentName: string[];
  correct: string[];
  wrong: string[];
  score: string[];
  rank: string[];
  threshold: string[];
  totalQuestions: string[];
  unattempted: string[];
  sectionCorrect: string[];
  sectionWrong: string[];
  sectionScore: string[];
  sectionTotalQuestions: string[];
  essays: string[];
}

export interface ParsedExcelSheet {
  sheetName: string;
  headers: string[];
  data: any[][];
  detectedColumns: {
    [key: string]: number; // column index
  };
  metadata: {
    rowCount: number;
    columnCount: number;
    hasData: boolean;
  };
}