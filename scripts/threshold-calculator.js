/**
 * Threshold Calculator Module
 *
 * Calculates dynamic thresholds for test sections to ensure at least 20% of students pass.
 *
 * Rules:
 * - All thresholds start at 40% (maximum)
 * - Thresholds can only be lowered (never exceed 40%)
 * - Essay thresholds are ALWAYS fixed at 40% (never adjusted)
 * - Non-essay sections can be adjusted down to achieve 20% pass rate
 * - Students must pass ALL sections to pass overall
 * - Passed students are ranked first, failed students cannot outrank them
 * - Round calculated thresholds to nearest 0.25
 */

const INITIAL_THRESHOLD = 40;
const ESSAY_THRESHOLD_FIXED = 40;
const MINIMUM_PASS_RATE = 0.2; // 20%
const THRESHOLD_ROUNDING = 0.25;

/**
 * Calculate thresholds for a test to ensure minimum pass rate
 * @param {Array} results - Array of test results
 * @param {Array} sectionIds - Array of section identifiers (e.g., ["1", "2", "3"])
 * @param {boolean} hasEssay - Whether the test has essay component
 * @returns {Object} Calculated thresholds and pass/fail data
 */
function calculateThresholds(results, sectionIds, hasEssay = false) {
  if (!results || results.length === 0) {
    return createDefaultThresholds(sectionIds, hasEssay);
  }

  const totalStudents = results.length;
  const minPassCount = Math.ceil(totalStudents * MINIMUM_PASS_RATE);

  console.log(`📊 Calculating thresholds for ${totalStudents} students (need ${minPassCount} to pass)`);

  // Initialize thresholds at 40%
  let thresholds = {};
  sectionIds.forEach(sectionId => {
    thresholds[sectionId] = INITIAL_THRESHOLD;
  });
  if (hasEssay) {
    thresholds['essay'] = ESSAY_THRESHOLD_FIXED;
  }

  // Step 1: Check how many pass with initial 40% threshold
  let passData = calculatePassStatus(results, thresholds, sectionIds, hasEssay);

  if (passData.passCount >= minPassCount) {
    console.log(`✅ ${passData.passCount} students pass at 40% - no adjustment needed`);
    return {
      thresholds,
      passData,
      adjusted: false
    };
  }

  console.log(`⚙️ Only ${passData.passCount} students pass at 40% - adjusting thresholds...`);

  // Step 2: Adjust thresholds iteratively
  thresholds = adjustThresholds(results, thresholds, sectionIds, hasEssay, minPassCount);

  // Step 3: Round thresholds to nearest 0.25
  Object.keys(thresholds).forEach(key => {
    if (key !== 'essay') { // Essay always stays at 40
      thresholds[key] = roundToQuarter(thresholds[key]);
    }
  });

  // Step 4: Recalculate pass status with final thresholds
  passData = calculatePassStatus(results, thresholds, sectionIds, hasEssay);

  console.log(`✅ Final thresholds: ${JSON.stringify(thresholds)} - ${passData.passCount} students pass`);

  return {
    thresholds,
    passData,
    adjusted: true
  };
}

/**
 * Adjust thresholds to achieve minimum pass count
 * @param {Array} results - Test results
 * @param {Object} thresholds - Current thresholds
 * @param {Array} sectionIds - Section identifiers
 * @param {boolean} hasEssay - Has essay component
 * @param {number} minPassCount - Minimum students that must pass
 * @returns {Object} Adjusted thresholds
 */
function adjustThresholds(results, thresholds, sectionIds, hasEssay, minPassCount) {
  const adjustedThresholds = { ...thresholds };

  // Sort students by total score (descending)
  const sortedResults = [...results].sort((a, b) => {
    const scoreA = calculateTotalScore(a, sectionIds, hasEssay);
    const scoreB = calculateTotalScore(b, sectionIds, hasEssay);
    return scoreB - scoreA;
  });

  // Get students that need to pass (top minPassCount students)
  const targetStudents = sortedResults.slice(0, minPassCount);

  // For each non-essay section, find the minimum threshold to pass target students
  sectionIds.forEach(sectionId => {
    // Get all scores for this section from target students
    const sectionScores = targetStudents.map(student => {
      if (student.sections && student.sections[sectionId]) {
        return student.sections[sectionId].percentage || student.sections[sectionId].score || 0;
      }
      return 0;
    });

    // Find the minimum score among target students for this section
    const minScore = Math.min(...sectionScores);

    // Set threshold to this minimum (but not above 40%)
    adjustedThresholds[sectionId] = Math.min(INITIAL_THRESHOLD, minScore);

    console.log(`  Section ${sectionId}: Adjusted to ${adjustedThresholds[sectionId]}% (min score: ${minScore}%)`);
  });

  // Check if essay scores are limiting pass rate
  if (hasEssay) {
    const essayScores = targetStudents.map(student => {
      if (student.essayMarks !== undefined) {
        const essayPercentage = (student.essayMarks / (student.maxEssayMarks || 100)) * 100;
        return essayPercentage;
      }
      return 0;
    });

    const minEssayScore = Math.min(...essayScores);
    console.log(`  Essay: Fixed at ${ESSAY_THRESHOLD_FIXED}% (min score: ${minEssayScore.toFixed(2)}%)`);

    if (minEssayScore < ESSAY_THRESHOLD_FIXED) {
      console.log(`  ⚠️ Warning: ${targetStudents.length - essayScores.filter(s => s >= ESSAY_THRESHOLD_FIXED).length} target students fail essay threshold`);
    }
  }

  return adjustedThresholds;
}

/**
 * Calculate pass/fail status for all students
 * @param {Array} results - Test results
 * @param {Object} thresholds - Section thresholds
 * @param {Array} sectionIds - Section identifiers
 * @param {boolean} hasEssay - Has essay component
 * @returns {Object} Pass data with rankings
 */
function calculatePassStatus(results, thresholds, sectionIds, hasEssay) {
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

    // Check each section
    sectionIds.forEach(sectionId => {
      const sectionScore = getSectionScore(student, sectionId);
      const sectionThreshold = thresholds[sectionId];
      const passed = sectionScore >= sectionThreshold;

      studentData.sectionResults[sectionId] = {
        score: sectionScore,
        threshold: sectionThreshold,
        passed
      };

      if (!passed) {
        studentData.passedAll = false;
        studentData.failedSections.push(sectionId);
      }
    });

    // Check essay if exists
    if (hasEssay) {
      const essayScore = getEssayScore(student);
      const essayThreshold = thresholds['essay'];
      const passed = essayScore >= essayThreshold;

      studentData.sectionResults['essay'] = {
        score: essayScore,
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
 * Helper function to get section score
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
 * Helper function to get essay score as percentage
 */
function getEssayScore(student) {
  if (student.essayMarks !== undefined && student.maxEssayMarks !== undefined) {
    return (student.essayMarks / student.maxEssayMarks) * 100;
  }

  // Check for essay in essays object
  if (student.essays) {
    const essayValues = Object.values(student.essays);
    if (essayValues.length > 0) {
      const totalEssayScore = essayValues.reduce((sum, val) => sum + val, 0);
      // Assume each essay is out of 100 or proportional
      return totalEssayScore;
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
 * Round number to nearest 0.25
 */
function roundToQuarter(value) {
  return Math.floor(value / THRESHOLD_ROUNDING) * THRESHOLD_ROUNDING;
}

/**
 * Create default thresholds (40% for all)
 */
function createDefaultThresholds(sectionIds, hasEssay) {
  const thresholds = {};
  sectionIds.forEach(sectionId => {
    thresholds[sectionId] = INITIAL_THRESHOLD;
  });
  if (hasEssay) {
    thresholds['essay'] = ESSAY_THRESHOLD_FIXED;
  }

  return {
    thresholds,
    passData: { passCount: 0, failCount: 0, students: [] },
    adjusted: false
  };
}

/**
 * Determine if a test should have threshold logic applied
 * Based on test name starting with: English, Mathematics, Analytical
 */
function shouldApplyThresholds(testName) {
  const testNameLower = testName.toLowerCase();
  const applicableTests = ['english', 'mathematics', 'analytical', 'maths'];

  return applicableTests.some(prefix => testNameLower.startsWith(prefix));
}

module.exports = {
  calculateThresholds,
  calculatePassStatus,
  shouldApplyThresholds,
  INITIAL_THRESHOLD,
  ESSAY_THRESHOLD_FIXED,
  MINIMUM_PASS_RATE
};
