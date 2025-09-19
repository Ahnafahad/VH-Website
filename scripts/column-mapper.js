// Dynamic Column Mapping System for Excel Processing
// Handles multiple naming patterns and fuzzy matching

const COLUMN_PATTERNS = {
  studentId: [
    'Student ID', 'student_id', 'ID', 'Roll', 'student id', 'StudentID', 'STUDENT_ID'
  ],
  studentName: [
    'Student Name', 'student_name', 'Name', 'student name', 'StudentName', 'STUDENT_NAME'
  ],
  correct: [
    'Correct', 'correct', 'CORRECT',
    // Section-specific patterns
    's1_correct', 's2_correct', 's3_correct',
    '1 Correct', '2 Correct', '3 Correct',
    'Section1 Correct', 'Section2 Correct', 'Section3 Correct'
  ],
  wrong: [
    'Wrong', 'wrong', 'WRONG',
    // Section-specific patterns
    's1_wrong', 's2_wrong', 's3_wrong',
    '1 Wrong', '2 Wrong', '3 Wrong',
    'Section1 Wrong', 'Section2 Wrong', 'Section3 Wrong'
  ],
  score: [
    'Score', 'score', 'SCORE', 'Marks', 'marks', 'MARKS',
    'Total Marks', 'total_score', 'total_marks',
    'Overall', 'overall', 'OVERALL', // Added for Maths Diagnostic Test
    // Section-specific patterns
    's1_score', 's2_score', 's3_score',
    '1 Marks', '2 Marks', '3 Marks',
    '1 Score', '2 Score', '3 Score'
  ],
  rank: [
    'Rank', 'rank', 'RANK', 'Position', 'position'
  ],
  threshold: [
    'Threshold', 'threshold', 'THRESHOLD', 'Pass Mark', 'pass_mark'
  ],
  totalQuestions: [
    'Total Questions', 'total_questions', 'Total Question', 'TotalQuestions',
    // Section-specific patterns
    's1_total_questions', 's2_total_questions', 's3_total_questions',
    'Total Question 1', 'Total Question 2', 'Total Question 3'
  ],
  unattempted: [
    'Unattempted', 'unattempted', 'UNATTEMPTED', 'Not Attempted', 'not_attempted'
  ],
  percentage: [
    'Percentage', 'percentage', 'PERCENTAGE', '%', 'Percent',
    // Section-specific patterns
    '1 Percentage', '2 Percentage', '3 Percentage'
  ],
  essays: [
    'Essay 1', 'Essay 2', 'Essay 3', 'Essay 4',
    'essay1', 'essay2', 'essay3', 'essay4',
    'Essay1', 'Essay2', 'Essay3', 'Essay4'
  ]
};

/**
 * Fuzzy match column names to known patterns
 * @param {string} columnName - The column name to match
 * @param {string[]} patterns - Array of patterns to match against
 * @returns {boolean} - Whether there's a match
 */
function fuzzyMatch(columnName, patterns) {
  const normalizedColumn = String(columnName || '').toLowerCase().trim();

  return patterns.some(pattern => {
    const normalizedPattern = pattern.toLowerCase().trim();

    // Exact match
    if (normalizedColumn === normalizedPattern) return true;

    // Contains match
    if (normalizedColumn.includes(normalizedPattern) || normalizedPattern.includes(normalizedColumn)) {
      return true;
    }

    // Remove spaces and special characters for matching
    const cleanColumn = normalizedColumn.replace(/[\s_-]/g, '');
    const cleanPattern = normalizedPattern.replace(/[\s_-]/g, '');

    return cleanColumn === cleanPattern;
  });
}

/**
 * Detect section number from column name
 * @param {string} columnName - The column name
 * @returns {string|null} - Section number or null
 */
function detectSectionNumber(columnName) {
  const columnStr = String(columnName || '');
  const sectionMatches = columnStr.match(/(?:s|section)?\s*(\d+)/i);
  if (sectionMatches) {
    return sectionMatches[1];
  }

  // Check for patterns like "1 Correct", "2 Wrong"
  const numberMatches = columnStr.match(/^(\d+)\s/);
  if (numberMatches) {
    return numberMatches[1];
  }

  return null;
}

/**
 * Detect essay number from column name
 * @param {string} columnName - The column name
 * @returns {string|null} - Essay number or null
 */
function detectEssayNumber(columnName) {
  const columnStr = String(columnName || '');
  const essayMatches = columnStr.match(/essay\s*(\d+)/i);
  return essayMatches ? essayMatches[1] : null;
}

/**
 * Map Excel headers to known column types
 * @param {string[]} headers - Array of header names from Excel
 * @returns {Object} - Mapped columns with indices and metadata
 */
function mapColumns(headers) {
  const mappedColumns = {
    basic: {},
    sections: {},
    essays: {},
    unmapped: []
  };

  headers.forEach((header, index) => {
    if (!header || String(header || '').trim() === '') {
      return; // Skip empty headers
    }

    let mapped = false;

    // Check basic columns
    for (const [columnType, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (columnType === 'essays') continue; // Handle essays separately

      if (fuzzyMatch(header, patterns)) {
        const sectionNumber = detectSectionNumber(header);

        if (sectionNumber && ['correct', 'wrong', 'score', 'totalQuestions', 'percentage'].includes(columnType)) {
          // This is a section-specific column
          if (!mappedColumns.sections[sectionNumber]) {
            mappedColumns.sections[sectionNumber] = {};
          }
          mappedColumns.sections[sectionNumber][columnType] = index;
        } else {
          // This is a basic column
          mappedColumns.basic[columnType] = index;
        }
        mapped = true;
        break;
      }
    }

    // Check for essays
    if (!mapped) {
      const essayNumber = detectEssayNumber(header);
      if (essayNumber || fuzzyMatch(header, COLUMN_PATTERNS.essays)) {
        const essayNum = essayNumber || String(header || '').match(/\d+/)?.[0] || Object.keys(mappedColumns.essays).length + 1;
        mappedColumns.essays[essayNum] = index;
        mapped = true;
      }
    }

    // Check for question response columns (Section1-Q1, etc.)
    if (!mapped && String(header || '').match(/Section\d+-Q\d+/i)) {
      if (!mappedColumns.responses) {
        mappedColumns.responses = {};
      }
      mappedColumns.responses[header] = index;
      mapped = true;
    }

    if (!mapped) {
      mappedColumns.unmapped.push({ header, index });
    }
  });

  return mappedColumns;
}

/**
 * Validate that required columns are present
 * @param {Object} mappedColumns - Result from mapColumns
 * @param {string} testType - 'simple' or 'full'
 * @returns {Object} - Validation result
 */
function validateColumns(mappedColumns, testType = 'simple') {
  const required = ['studentId', 'studentName'];
  const missing = [];
  const warnings = [];

  // Check required basic columns
  required.forEach(col => {
    if (mappedColumns.basic[col] === undefined) {
      missing.push(col);
    }
  });

  // For simple tests, we need at least score or correct/wrong
  if (testType === 'simple') {
    const hasScore = mappedColumns.basic.score !== undefined;
    const hasCorrectWrong = mappedColumns.basic.correct !== undefined && mappedColumns.basic.wrong !== undefined;
    const hasCorrectOnly = mappedColumns.basic.correct !== undefined; // Allow correct-only tests
    const hasSectionData = Object.keys(mappedColumns.sections).length > 0;

    if (!hasScore && !hasCorrectWrong && !hasCorrectOnly && !hasSectionData) {
      missing.push('score OR (correct AND wrong) OR correct OR section data');
    }
  }

  // Warnings for common issues
  if (mappedColumns.unmapped.length > 0) {
    warnings.push(`${mappedColumns.unmapped.length} columns could not be mapped: ${mappedColumns.unmapped.map(u => u.header).join(', ')}`);
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    summary: {
      basicColumns: Object.keys(mappedColumns.basic).length,
      sections: Object.keys(mappedColumns.sections).length,
      essays: Object.keys(mappedColumns.essays).length,
      responses: mappedColumns.responses ? Object.keys(mappedColumns.responses).length : 0,
      unmapped: mappedColumns.unmapped.length
    }
  };
}

/**
 * Extract data from Excel row using column mapping
 * @param {Array} row - Excel row data
 * @param {Object} mappedColumns - Column mapping
 * @returns {Object} - Extracted and structured data
 */
function extractRowData(row, mappedColumns) {
  const data = {
    basic: {},
    sections: {},
    essays: {},
    responses: {}
  };

  // Extract basic data
  for (const [columnType, index] of Object.entries(mappedColumns.basic)) {
    const value = row[index];
    if (value !== undefined && value !== null && value !== '') {
      data.basic[columnType] = columnType === 'studentId' ? String(value) : value;
    }
  }

  // Extract section data
  for (const [sectionNumber, sectionColumns] of Object.entries(mappedColumns.sections)) {
    data.sections[sectionNumber] = {};
    for (const [columnType, index] of Object.entries(sectionColumns)) {
      const value = row[index];
      if (value !== undefined && value !== null && value !== '') {
        data.sections[sectionNumber][columnType] = value;
      }
    }
  }

  // Extract essay data
  for (const [essayNumber, index] of Object.entries(mappedColumns.essays)) {
    const value = row[index];
    if (value !== undefined && value !== null && value !== '') {
      data.essays[essayNumber] = value;
    }
  }

  // Extract response data
  if (mappedColumns.responses) {
    for (const [questionId, index] of Object.entries(mappedColumns.responses)) {
      const value = row[index];
      if (value !== undefined && value !== null && value !== '') {
        data.responses[questionId] = String(value);
      }
    }
  }

  return data;
}

module.exports = {
  COLUMN_PATTERNS,
  mapColumns,
  validateColumns,
  extractRowData,
  fuzzyMatch,
  detectSectionNumber,
  detectEssayNumber
};