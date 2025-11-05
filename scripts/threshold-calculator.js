/**
 * Threshold Calculator Module
 *
 * Calculates dynamic thresholds for test sections to ensure at least 20% of students pass.
 *
 * Rules:
 * - All thresholds start at 40% (maximum)
 * - Thresholds calculated as percentage, then converted to MARKS
 * - Thresholds stored and displayed as MARKS (not percentages)
 * - Essay thresholds are ALWAYS fixed at 40% of total essay marks (never adjusted)
 * - Non-essay sections can be adjusted down to achieve 20% pass rate
 * - Students must pass ALL sections to pass overall
 * - Passed students are ranked first, failed students cannot outrank them
 * - Round calculated threshold MARKS to nearest 0.25
 *
 * Example:
 * - Section has 45 total marks
 * - Threshold calculated at 28.73%
 * - Convert to marks: 28.73% of 45 = 12.9285 marks
 * - Round down to 0.25: 12.75 marks
 * - Store and display: 12.75 marks
 */

const INITIAL_THRESHOLD_PERCENTAGE = 40;
const ESSAY_THRESHOLD_PERCENTAGE = 40;
const MINIMUM_PASS_RATE = 0.2; // 20%
const MARKS_ROUNDING = 0.25;

/**
 * Calculate thresholds for a test to ensure minimum pass rate
 * @param {Array} results - Array of test results
 * @param {Array} sectionIds - Array of section identifiers (e.g., ["1", "2", "3"])
 * @param {boolean} hasEssay - Whether the test has essay component
 * @param {string} testName - Name of the test (to detect mock tests)
 * @returns {Object} Calculated thresholds and pass/fail data
 */
function calculateThresholds(results, sectionIds, hasEssay = false, testName = '') {
  if (!results || results.length === 0) {
    return createDefaultThresholds(sectionIds, hasEssay, results);
  }

  const totalStudents = results.length;
  const minPassCount = Math.ceil(totalStudents * MINIMUM_PASS_RATE);

  console.log(`📊 Calculating thresholds for ${totalStudents} students (need ${minPassCount} to pass)`);

  // Get total marks for each section from first student
  const sectionTotalMarks = {};
  const firstStudent = results[0];

  sectionIds.forEach(sectionId => {
    const section = firstStudent.sections?.[sectionId];
    if (section && section.marks !== undefined && section.percentage !== undefined && section.percentage > 0) {
      // Calculate total marks: totalMarks = (marks / percentage) * 100
      sectionTotalMarks[sectionId] = (section.marks / section.percentage) * 100;
    } else {
      sectionTotalMarks[sectionId] = 100; // Default fallback
    }
  });

  // Initialize thresholds at 40% (converted to marks)
  let thresholds = {};
  sectionIds.forEach(sectionId => {
    const totalMarks = sectionTotalMarks[sectionId];
    thresholds[sectionId] = (INITIAL_THRESHOLD_PERCENTAGE / 100) * totalMarks;
  });

  if (hasEssay) {
    // Get essay total marks
    let essayTotalMarks = 100; // Default

    // For mock tests, essay is always out of 30 marks
    const isMockTest = testName.toLowerCase().startsWith('mock');
    if (isMockTest) {
      essayTotalMarks = 30;
    } else if (firstStudent.maxEssayMarks) {
      essayTotalMarks = firstStudent.maxEssayMarks;
    } else if (firstStudent.essayMarks !== undefined && firstStudent.essayPercentage !== undefined && firstStudent.essayPercentage > 0) {
      essayTotalMarks = (firstStudent.essayMarks / firstStudent.essayPercentage) * 100;
    }

    thresholds['essay'] = (ESSAY_THRESHOLD_PERCENTAGE / 100) * essayTotalMarks;
    console.log(`  📝 Essay total marks: ${essayTotalMarks}, threshold: ${thresholds['essay'].toFixed(2)} marks (40%)`);
  }

  // Step 1: Check how many pass with initial 40% threshold (in marks)
  let passData = calculatePassStatus(results, thresholds, sectionIds, hasEssay, sectionTotalMarks);

  if (passData.passCount >= minPassCount) {
    console.log(`✅ ${passData.passCount} students pass at 40% - no adjustment needed`);
    return {
      thresholds,
      passData,
      adjusted: false,
      sectionTotalMarks
    };
  }

  console.log(`⚙️ Only ${passData.passCount} students pass at 40% - adjusting thresholds...`);

  // Step 2: Adjust thresholds iteratively (works with percentages, then converts to marks)
  thresholds = adjustThresholds(results, thresholds, sectionIds, hasEssay, minPassCount, sectionTotalMarks);

  // Step 3: Round threshold MARKS to nearest 0.25
  Object.keys(thresholds).forEach(key => {
    if (key !== 'essay') { // Essay always stays at 40% (but stored as marks)
      thresholds[key] = roundMarksToQuarter(thresholds[key]);
    }
  });

  // Step 4: Recalculate pass status with final thresholds (in marks)
  passData = calculatePassStatus(results, thresholds, sectionIds, hasEssay, sectionTotalMarks);

  // Format thresholds for logging
  const thresholdsFormatted = {};
  Object.keys(thresholds).forEach(key => {
    thresholdsFormatted[key] = `${thresholds[key].toFixed(2)} marks`;
  });
  console.log(`✅ Final thresholds: ${JSON.stringify(thresholdsFormatted)} - ${passData.passCount} students pass`);

  return {
    thresholds,
    passData,
    adjusted: true,
    sectionTotalMarks
  };
}

/**
 * Adjust thresholds to achieve minimum pass count
 * @param {Array} results - Test results
 * @param {Object} thresholds - Current thresholds (in marks)
 * @param {Array} sectionIds - Section identifiers
 * @param {boolean} hasEssay - Has essay component
 * @param {number} minPassCount - Minimum students that must pass
 * @param {Object} sectionTotalMarks - Total marks for each section
 * @returns {Object} Adjusted thresholds (in marks)
 */
function adjustThresholds(results, thresholds, sectionIds, hasEssay, minPassCount, sectionTotalMarks) {
  const adjustedThresholds = { ...thresholds };

  // Sort students by total score (descending)
  const sortedResults = [...results].sort((a, b) => {
    const scoreA = calculateTotalScore(a, sectionIds, hasEssay);
    const scoreB = calculateTotalScore(b, sectionIds, hasEssay);
    return scoreB - scoreA;
  });

  // Get students that need to pass (top minPassCount students)
  const targetStudents = sortedResults.slice(0, minPassCount);

  // For each non-essay section, find the minimum marks to pass target students
  sectionIds.forEach(sectionId => {
    const totalMarks = sectionTotalMarks[sectionId];

    // Get all MARKS for this section from target students
    const sectionMarks = targetStudents.map(student => {
      if (student.sections && student.sections[sectionId]) {
        return student.sections[sectionId].marks || 0;
      }
      return 0;
    });

    // Find the minimum marks among target students for this section
    const minMarks = Math.min(...sectionMarks);

    // Calculate what 40% would be in marks
    const maxThresholdMarks = (INITIAL_THRESHOLD_PERCENTAGE / 100) * totalMarks;

    // Set threshold to this minimum (but not above 40%)
    // Apply absolute minimum floor of 0.25 marks (cannot be 0)
    const rawThreshold = Math.min(maxThresholdMarks, minMarks);
    const minimumFloor = MARKS_ROUNDING; // 0.25 marks minimum
    adjustedThresholds[sectionId] = Math.max(minimumFloor, rawThreshold);

    const percentage = (adjustedThresholds[sectionId] / totalMarks * 100).toFixed(2);
    console.log(`  Section ${sectionId}: Adjusted to ${adjustedThresholds[sectionId].toFixed(2)} marks (${percentage}%) - will round to 0.25`);
  });

  // Check if essay marks are limiting pass rate
  if (hasEssay) {
    const essayMarks = targetStudents.map(student => {
      return student.essayMarks || 0;
    });

    const minEssayMarks = Math.min(...essayMarks);
    const essayThresholdMarks = adjustedThresholds['essay'];
    console.log(`  Essay: Fixed at ${essayThresholdMarks.toFixed(2)} marks (40%) - min student marks: ${minEssayMarks.toFixed(2)}`);

    if (minEssayMarks < essayThresholdMarks) {
      console.log(`  ⚠️ Warning: ${targetStudents.length - essayMarks.filter(m => m >= essayThresholdMarks).length} target students fail essay threshold`);
    }
  }

  return adjustedThresholds;
}

/**
 * Calculate pass/fail status for all students
 * @param {Array} results - Test results
 * @param {Object} thresholds - Section thresholds (in MARKS)
 * @param {Array} sectionIds - Section identifiers
 * @param {boolean} hasEssay - Has essay component
 * @param {Object} sectionTotalMarks - Total marks for each section
 * @returns {Object} Pass data with rankings
 */
function calculatePassStatus(results, thresholds, sectionIds, hasEssay, sectionTotalMarks) {
  const passData = {
    passCount: 0,
    failCount: 0,
    students: []
  };

  results.forEach(student => {
    const studentData = {
      studentId: student.studentId,
      studentName: student.studentName,
      totalScore: calculateTotalScore(student, sectionIds, hasEssay),
      sectionResults: {},
      passedAll: true,
      failedSections: []
    };

    // Check each section (compare MARKS vs MARKS)
    sectionIds.forEach(sectionId => {
      const sectionMarks = getSectionMarks(student, sectionId);
      const sectionThreshold = thresholds[sectionId];
      const passed = sectionMarks >= sectionThreshold;

      studentData.sectionResults[sectionId] = {
        marks: sectionMarks,
        threshold: sectionThreshold,
        passed
      };

      if (!passed) {
        studentData.passedAll = false;
        studentData.failedSections.push(sectionId);
      }
    });

    // Check essay if exists (compare MARKS vs MARKS)
    if (hasEssay) {
      const essayMarks = getEssayMarks(student);
      const essayThreshold = thresholds['essay'];
      const passed = essayMarks >= essayThreshold;

      studentData.sectionResults['essay'] = {
        marks: essayMarks,
        threshold: essayThreshold,
        passed
      };

      if (!passed) {
        studentData.passedAll = false;
        studentData.failedSections.push('essay');
      }
    }

    // Update pass/fail counts
    if (studentData.passedAll) {
      passData.passCount++;
    } else {
      passData.failCount++;
    }

    passData.students.push(studentData);
  });

  // Calculate rankings
  passData.students = calculateRankings(passData.students);

  return passData;
}

/**
 * Calculate rankings with pass/fail logic
 * Passed students are ranked first, failed students cannot outrank passed students
 */
function calculateRankings(students) {
  // Separate passed and failed students
  const passedStudents = students.filter(s => s.passedAll);
  const failedStudents = students.filter(s => !s.passedAll);

  // Sort passed students by total score (descending)
  passedStudents.sort((a, b) => b.totalScore - a.totalScore);

  // Sort failed students by total score (descending)
  failedStudents.sort((a, b) => b.totalScore - a.totalScore);

  // Assign ranks
  let rank = 1;
  passedStudents.forEach(student => {
    student.rank = rank++;
    student.rankStatus = 'passed'; // Green
  });

  // Failed students start ranking after all passed students
  failedStudents.forEach(student => {
    student.rank = rank++;
    student.rankStatus = 'failed'; // Red
  });

  return [...passedStudents, ...failedStudents];
}

/**
 * Helper function to get section MARKS (not percentage)
 */
function getSectionMarks(student, sectionId) {
  if (!student.sections || !student.sections[sectionId]) {
    return 0;
  }

  const section = student.sections[sectionId];

  // Return marks directly
  if (section.marks !== undefined) {
    return section.marks;
  }

  return 0;
}

/**
 * Helper function to get essay MARKS (not percentage)
 */
function getEssayMarks(student) {
  // Return essay marks directly
  if (student.essayMarks !== undefined) {
    return student.essayMarks;
  }

  // Check for essay in essays object and sum them
  if (student.essays) {
    const essayValues = Object.values(student.essays);
    if (essayValues.length > 0) {
      const totalEssayMarks = essayValues.reduce((sum, val) => sum + val, 0);
      return totalEssayMarks;
    }
  }

  return 0;
}

/**
 * Helper function to get section score (percentage) - Used for ranking only
 */
function getSectionScore(student, sectionId) {
  if (!student.sections || !student.sections[sectionId]) {
    return 0;
  }

  const section = student.sections[sectionId];

  // Return percentage if available, otherwise calculate from marks
  if (section.percentage !== undefined) {
    return section.percentage;
  }

  if (section.marks !== undefined && section.totalMarks !== undefined) {
    return (section.marks / section.totalMarks) * 100;
  }

  if (section.score !== undefined) {
    return section.score;
  }

  return 0;
}

/**
 * Helper function to get essay score (percentage) - Used for ranking only
 */
function getEssayScore(student) {
  // Return essay percentage if available
  if (student.essayPercentage !== undefined) {
    return student.essayPercentage;
  }

  // Calculate from marks if available
  if (student.essayMarks !== undefined && student.maxEssayMarks !== undefined && student.maxEssayMarks > 0) {
    return (student.essayMarks / student.maxEssayMarks) * 100;
  }

  // Check for essay in essays object
  if (student.essays) {
    const essayValues = Object.values(student.essays);
    if (essayValues.length > 0) {
      // Assume essays are stored as percentages
      return essayValues.reduce((sum, val) => sum + val, 0) / essayValues.length;
    }
  }

  return 0;
}

/**
 * Helper function to calculate total score
 */
function calculateTotalScore(student, sectionIds, hasEssay) {
  let total = 0;

  sectionIds.forEach(sectionId => {
    total += getSectionScore(student, sectionId);
  });

  if (hasEssay) {
    total += getEssayScore(student);
  }

  return total;
}

/**
 * Round marks to nearest 0.25 (DOWNWARD)
 * Example: 5.9 → 5.75, 12.89 → 12.75
 */
function roundMarksToQuarter(marks) {
  return Math.floor(marks / MARKS_ROUNDING) * MARKS_ROUNDING;
}

/**
 * Create default thresholds (40% converted to marks for all)
 */
function createDefaultThresholds(sectionIds, hasEssay, results) {
  const thresholds = {};
  const sectionTotalMarks = {};

  if (results && results.length > 0) {
    const firstStudent = results[0];

    sectionIds.forEach(sectionId => {
      const section = firstStudent.sections?.[sectionId];
      if (section && section.marks !== undefined && section.percentage !== undefined && section.percentage > 0) {
        sectionTotalMarks[sectionId] = (section.marks / section.percentage) * 100;
      } else {
        sectionTotalMarks[sectionId] = 100; // Default
      }
      thresholds[sectionId] = (INITIAL_THRESHOLD_PERCENTAGE / 100) * sectionTotalMarks[sectionId];
    });

    if (hasEssay) {
      let essayTotalMarks = 100;
      if (firstStudent.maxEssayMarks) {
        essayTotalMarks = firstStudent.maxEssayMarks;
      }
      thresholds['essay'] = (ESSAY_THRESHOLD_PERCENTAGE / 100) * essayTotalMarks;
    }
  } else {
    // Fallback
    sectionIds.forEach(sectionId => {
      sectionTotalMarks[sectionId] = 100;
      thresholds[sectionId] = 40; // 40% of 100
    });
    if (hasEssay) {
      thresholds['essay'] = 40;
    }
  }

  return {
    thresholds,
    passData: { passCount: 0, failCount: 0, students: [] },
    adjusted: false,
    sectionTotalMarks
  };
}

/**
 * Determine if a test should have threshold logic applied
 * Based on test name starting with: English, Mathematics, Analytical, Mock
 */
function shouldApplyThresholds(testName) {
  const testNameLower = testName.toLowerCase();
  const applicableTests = ['english', 'mathematics', 'analytical', 'maths', 'mock'];

  return applicableTests.some(prefix => testNameLower.startsWith(prefix));
}

module.exports = {
  calculateThresholds,
  calculatePassStatus,
  shouldApplyThresholds,
  INITIAL_THRESHOLD_PERCENTAGE,
  ESSAY_THRESHOLD_PERCENTAGE,
  MINIMUM_PASS_RATE
};
