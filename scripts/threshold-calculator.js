/**
 * Threshold Calculator Module
 *
 * Simple threshold calculation: For each section, find the mark where top 35% of students pass.
 *
 * Rules:
 * - For each section independently, sort all students by their marks in that section
 * - Take the top 35% of students
 * - The minimum mark from those top 35% becomes the threshold
 * - Round down to nearest 0.25 marks
 * - Essay thresholds are ALWAYS fixed at 40% of total essay marks (never adjusted)
 * - Students must pass ALL sections to pass overall
 * - Passed students are ranked first, failed students cannot outrank them
 *
 * Example:
 * - Section has 24 students
 * - Top 35% = 9 students (ceil(24 * 0.35))
 * - 9th student (when sorted by marks) has 12.9285 marks
 * - Round down to 0.25: 12.75 marks
 * - Threshold = 12.75 marks
 */

const INITIAL_THRESHOLD_PERCENTAGE = 40;
const ESSAY_THRESHOLD_PERCENTAGE = 40;
const SECTION_PASS_RATE = 0.35; // 35% of students should pass each section
const MARKS_ROUNDING = 0.25;

/**
 * Calculate thresholds for a test - Simple 35% pass rate per section
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
  const targetPassCount = Math.ceil(totalStudents * SECTION_PASS_RATE);

  console.log(`📊 Calculating thresholds for ${totalStudents} students (target: ${targetPassCount} students = 35%)`);

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

  // Initialize thresholds object
  let thresholds = {};

  // Set essay threshold (fixed at 40%)
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

  // Calculate thresholds for each section (35% pass rate)
  thresholds = adjustThresholds(results, thresholds, sectionIds, hasEssay, targetPassCount, sectionTotalMarks);

  // Calculate pass status with final thresholds
  const passData = calculatePassStatus(results, thresholds, sectionIds, hasEssay, sectionTotalMarks);

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
 * Adjust thresholds - Simple approach: find mark where 35% students pass each section
 * @param {Array} results - Test results
 * @param {Object} thresholds - Current thresholds (in marks)
 * @param {Array} sectionIds - Section identifiers
 * @param {boolean} hasEssay - Has essay component
 * @param {number} minPassCount - Minimum students that must pass (not used in new approach)
 * @param {Object} sectionTotalMarks - Total marks for each section
 * @returns {Object} Adjusted thresholds (in marks)
 */
function adjustThresholds(results, thresholds, sectionIds, hasEssay, minPassCount, sectionTotalMarks) {
  const adjustedThresholds = { ...thresholds };
  const totalStudents = results.length;
  const targetPassCount = Math.ceil(totalStudents * SECTION_PASS_RATE);

  console.log(`\n📊 Calculating thresholds for 35% pass rate (${targetPassCount} out of ${totalStudents} students)`);

  // For each section, find the mark where top 35% of students pass
  sectionIds.forEach(sectionId => {
    // Get all marks for this section from all students
    const sectionMarks = results.map(student => {
      if (student.sections && student.sections[sectionId]) {
        return student.sections[sectionId].marks || 0;
      }
      return 0;
    });

    // Sort marks in descending order
    const sortedMarks = [...sectionMarks].sort((a, b) => b - a);

    // Get the mark of the student at the 35% position (this is the minimum mark to be in top 35%)
    const thresholdIndex = Math.min(targetPassCount - 1, sortedMarks.length - 1);
    const rawThreshold = sortedMarks[thresholdIndex];

    // Round down to nearest 0.25
    const roundedThreshold = Math.floor(rawThreshold / MARKS_ROUNDING) * MARKS_ROUNDING;

    // Apply minimum floor of 0.25 marks
    adjustedThresholds[sectionId] = Math.max(MARKS_ROUNDING, roundedThreshold);

    const totalMarks = sectionTotalMarks[sectionId];
    const percentage = totalMarks > 0 ? (adjustedThresholds[sectionId] / totalMarks * 100).toFixed(2) : 0;

    console.log(`  Section ${sectionId}: ${adjustedThresholds[sectionId].toFixed(2)} marks (${percentage}%) - ${thresholdIndex + 1}th student had ${rawThreshold.toFixed(2)} marks`);
  });

  // Essay threshold remains fixed at 40%
  if (hasEssay) {
    console.log(`  Essay: Fixed at ${adjustedThresholds['essay'].toFixed(2)} marks (40%)`);
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
  SECTION_PASS_RATE
};
