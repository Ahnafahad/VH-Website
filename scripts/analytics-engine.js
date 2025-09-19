// Analytics Engine for Results Processing
// Calculates all metrics and advanced analytics

/**
 * Calculate basic accuracy and attempt rate
 * @param {number} correct - Number of correct answers
 * @param {number} wrong - Number of wrong answers
 * @param {number} totalQuestions - Total questions in test
 * @returns {Object} - Basic analytics
 */
function calculateBasicAnalytics(correct, wrong, totalQuestions) {
  const attempted = correct + wrong;
  const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
  const attemptRate = totalQuestions > 0 ? (attempted / totalQuestions) * 100 : 0;

  return {
    accuracy: Math.round(accuracy * 100) / 100, // Round to 2 decimal places
    attemptRate: Math.round(attemptRate * 100) / 100,
    attempted,
    unattempted: totalQuestions - attempted
  };
}

/**
 * Calculate class statistics
 * @param {Array} allResults - Array of student results
 * @param {string} scoreField - Field to use for scoring ('score' or 'totalMarks')
 * @returns {Object} - Class statistics
 */
function calculateClassStats(allResults, scoreField = 'score') {
  if (allResults.length === 0) {
    return {
      averageScore: 0,
      top5Average: 0,
      totalStudents: 0,
      passRate: 0,
      maxScore: 0,
      minScore: 0
    };
  }

  const scores = allResults.map(result => result[scoreField] || 0);
  const validScores = scores.filter(score => !isNaN(score));

  if (validScores.length === 0) {
    return {
      averageScore: 0,
      top5Average: 0,
      totalStudents: allResults.length,
      passRate: 0,
      maxScore: 0,
      minScore: 0
    };
  }

  const sortedScores = validScores.sort((a, b) => b - a);
  const averageScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;

  // Top 5 or top 20% average, whichever is larger
  const top5Count = Math.max(5, Math.ceil(validScores.length * 0.2));
  const top5Scores = sortedScores.slice(0, top5Count);
  const top5Average = top5Scores.reduce((sum, score) => sum + score, 0) / top5Scores.length;

  // Calculate pass rate (assuming pass threshold is available in results)
  const threshold = allResults[0]?.threshold || averageScore * 0.6; // Default to 60% of average
  const passCount = validScores.filter(score => score >= threshold).length;
  const passRate = (passCount / validScores.length) * 100;

  return {
    averageScore: Math.round(averageScore * 100) / 100,
    top5Average: Math.round(top5Average * 100) / 100,
    totalStudents: allResults.length,
    passRate: Math.round(passRate * 100) / 100,
    maxScore: Math.max(...validScores),
    minScore: Math.min(...validScores),
    threshold
  };
}

/**
 * Calculate percentile ranking for a student
 * @param {number} studentScore - Student's score
 * @param {Array} allScores - All students' scores
 * @returns {number} - Percentile (0-100)
 */
function calculatePercentile(studentScore, allScores) {
  if (allScores.length === 0) return 0;

  const validScores = allScores.filter(score => !isNaN(score));
  if (validScores.length === 0) return 0;

  const lowerScores = validScores.filter(score => score < studentScore).length;
  const percentile = (lowerScores / validScores.length) * 100;

  return Math.round(percentile * 100) / 100;
}

/**
 * Calculate skip strategy score (how well student skipped difficult questions)
 * @param {Object} responses - Student's responses {questionId: "A (C)", ...}
 * @param {Object} questionStats - Question difficulty stats
 * @returns {number} - Skip strategy score (0-100)
 */
function calculateSkipStrategy(responses, questionStats) {
  if (!questionStats || Object.keys(responses).length === 0) return 0;

  let skipPoints = 0;
  let totalPossiblePoints = 0;

  for (const [questionId, response] of Object.entries(responses)) {
    const stat = questionStats[questionId];
    if (!stat) continue;

    totalPossiblePoints += 10; // Each question worth 10 points

    if (response === 'NAN') {
      // Student skipped - calculate if it was a good skip
      const difficulty = stat.difficulty || 50; // Default medium difficulty

      if (difficulty > 70) {
        skipPoints += 10; // Excellent skip of hard question
      } else if (difficulty > 50) {
        skipPoints += 6; // Good skip of medium-hard question
      } else if (difficulty > 30) {
        skipPoints += 3; // Okay skip of medium question
      } else {
        skipPoints += 0; // Poor skip of easy question
      }
    } else {
      // Student attempted - check if answer was correct
      const isCorrect = response.includes('(C)');
      const difficulty = stat.difficulty || 50;

      if (isCorrect) {
        skipPoints += 10; // Full points for correct answer
      } else {
        // Penalty for wrong answer on easy questions
        if (difficulty < 30) {
          skipPoints += 2; // Should have gotten this right
        } else if (difficulty < 50) {
          skipPoints += 5; // Reasonable attempt
        } else {
          skipPoints += 7; // Good attempt on hard question
        }
      }
    }
  }

  return totalPossiblePoints > 0 ? Math.round((skipPoints / totalPossiblePoints) * 100) : 0;
}

/**
 * Calculate question choice strategy score
 * @param {Object} responses - Student's responses
 * @param {Object} questionStats - Question difficulty and attempt stats
 * @returns {number} - Strategy score (0-100)
 */
function calculateQuestionChoiceStrategy(responses, questionStats) {
  if (!questionStats || Object.keys(responses).length === 0) return 0;

  let strategyPoints = 0;
  let totalQuestions = 0;

  const attemptedQuestions = Object.entries(responses).filter(([_, response]) => response !== 'NAN');
  const skippedQuestions = Object.entries(responses).filter(([_, response]) => response === 'NAN');

  totalQuestions = Object.keys(responses).length;

  // Analyze attempt pattern
  for (const [questionId, response] of attemptedQuestions) {
    const stat = questionStats[questionId];
    if (!stat) continue;

    const difficulty = stat.difficulty || 50;
    const isCorrect = response.includes('(C)');

    if (isCorrect) {
      // Points for getting questions right
      if (difficulty < 30) {
        strategyPoints += 8; // Expected to get easy questions right
      } else if (difficulty < 60) {
        strategyPoints += 10; // Good job on medium questions
      } else {
        strategyPoints += 12; // Excellent job on hard questions
      }
    } else {
      // Penalty for getting questions wrong
      if (difficulty < 30) {
        strategyPoints += 2; // Should have gotten easy questions right
      } else if (difficulty < 60) {
        strategyPoints += 6; // Reasonable miss on medium questions
      } else {
        strategyPoints += 8; // Understandable miss on hard questions
      }
    }
  }

  // Analyze skip pattern
  for (const [questionId] of skippedQuestions) {
    const stat = questionStats[questionId];
    if (!stat) continue;

    const difficulty = stat.difficulty || 50;

    if (difficulty > 70) {
      strategyPoints += 9; // Good skip of very hard question
    } else if (difficulty > 50) {
      strategyPoints += 7; // Reasonable skip
    } else {
      strategyPoints += 4; // Could have attempted easier questions
    }
  }

  const maxPossiblePoints = totalQuestions * 12; // Maximum points per question
  return maxPossiblePoints > 0 ? Math.round((strategyPoints / maxPossiblePoints) * 100) : 0;
}

/**
 * Calculate recovery score (how quickly student recovered from mistakes)
 * @param {Object} responses - Student's responses in order
 * @param {Object} questionStats - Question stats
 * @returns {number} - Recovery score (0-100)
 */
function calculateRecoveryScore(responses, questionStats) {
  if (!questionStats || Object.keys(responses).length === 0) return 0;

  const responseEntries = Object.entries(responses);
  let recoveryPoints = 0;
  let totalRecoveryOpportunities = 0;

  for (let i = 1; i < responseEntries.length; i++) {
    const [prevQuestionId, prevResponse] = responseEntries[i - 1];
    const [currentQuestionId, currentResponse] = responseEntries[i];

    const prevWasWrong = prevResponse.includes('(W)');
    const currentIsCorrect = currentResponse.includes('(C)');

    if (prevWasWrong) {
      totalRecoveryOpportunities += 1;

      if (currentIsCorrect) {
        recoveryPoints += 10; // Good recovery
      } else if (currentResponse === 'NAN') {
        recoveryPoints += 6; // Caution after mistake
      } else {
        recoveryPoints += 2; // Still struggling
      }
    }
  }

  return totalRecoveryOpportunities > 0
    ? Math.round((recoveryPoints / (totalRecoveryOpportunities * 10)) * 100)
    : 75; // Default good score if no mistakes were made
}

/**
 * Calculate question difficulty based on class performance
 * @param {string} questionId - Question identifier
 * @param {Array} allStudentResponses - All students' responses for this question
 * @returns {number} - Difficulty score (0-100, higher = more difficult)
 */
function calculateQuestionDifficulty(questionId, allStudentResponses) {
  if (allStudentResponses.length === 0) return 50; // Default medium difficulty

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  allStudentResponses.forEach(response => {
    if (response === 'NAN') {
      skippedCount++;
    } else if (response.includes('(C)')) {
      correctCount++;
    } else if (response.includes('(W)')) {
      wrongCount++;
    }
  });

  const totalAttempted = correctCount + wrongCount;
  const totalStudents = allStudentResponses.length;

  if (totalAttempted === 0) {
    // Everyone skipped - very difficult
    return 95;
  }

  const successRate = correctCount / totalAttempted;
  const attemptRate = totalAttempted / totalStudents;

  // Calculate difficulty based on success rate and attempt rate
  let difficulty = 100 - (successRate * 100);

  // Adjust for skip rate
  const skipRate = skippedCount / totalStudents;
  difficulty += skipRate * 30; // High skip rate increases perceived difficulty

  // Ensure difficulty is within bounds
  return Math.max(0, Math.min(100, Math.round(difficulty)));
}

/**
 * Generate question analytics for a test
 * @param {Object} allResults - All student results with responses
 * @returns {Object} - Question analytics
 */
function generateQuestionAnalytics(allResults) {
  const questionStats = {};

  // Collect all responses by question
  const responsesByQuestion = {};

  Object.values(allResults).forEach(studentResult => {
    if (studentResult.responses) {
      Object.entries(studentResult.responses).forEach(([questionId, response]) => {
        if (!responsesByQuestion[questionId]) {
          responsesByQuestion[questionId] = [];
        }
        responsesByQuestion[questionId].push(response);
      });
    }
  });

  // Calculate stats for each question
  Object.entries(responsesByQuestion).forEach(([questionId, responses]) => {
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;

    responses.forEach(response => {
      if (response === 'NAN') {
        skippedCount++;
      } else if (response.includes('(C)')) {
        correctCount++;
      } else if (response.includes('(W)')) {
        wrongCount++;
      }
    });

    const difficulty = calculateQuestionDifficulty(questionId, responses);

    questionStats[questionId] = {
      correctCount,
      wrongCount,
      skippedCount,
      difficulty,
      totalResponses: responses.length,
      successRate: correctCount / (correctCount + wrongCount) || 0,
      attemptRate: (correctCount + wrongCount) / responses.length || 0
    };
  });

  return questionStats;
}

/**
 * Calculate section performance analytics
 * @param {Object} sectionData - Section data with correct, wrong, total
 * @returns {Object} - Section analytics
 */
function calculateSectionAnalytics(sectionData) {
  const { correct = 0, wrong = 0, totalQuestions = 0 } = sectionData;

  const basicAnalytics = calculateBasicAnalytics(correct, wrong, totalQuestions);

  // Calculate efficiency (accuracy weighted by attempt rate)
  const efficiency = (basicAnalytics.accuracy * basicAnalytics.attemptRate) / 100;

  return {
    ...basicAnalytics,
    efficiency: Math.round(efficiency * 100) / 100
  };
}

/**
 * Calculate series progression data
 * @param {Array} testResults - Array of test results in chronological order
 * @param {string} studentId - Student ID to track
 * @returns {Object} - Progression analytics
 */
function calculateSeriesProgression(testResults, studentId) {
  const studentProgression = [];
  let previousScore = null;

  testResults.forEach((test, index) => {
    const studentResult = test.results[studentId];
    if (studentResult) {
      const currentScore = studentResult.score || studentResult.totalMarks || 0;
      const improvement = previousScore !== null ? currentScore - previousScore : 0;

      studentProgression.push({
        testName: test.testName,
        score: currentScore,
        rank: studentResult.rank,
        accuracy: studentResult.analytics?.accuracy || 0,
        improvement,
        testIndex: index
      });

      previousScore = currentScore;
    }
  });

  return studentProgression;
}

module.exports = {
  calculateBasicAnalytics,
  calculateClassStats,
  calculatePercentile,
  calculateSkipStrategy,
  calculateQuestionChoiceStrategy,
  calculateRecoveryScore,
  calculateQuestionDifficulty,
  generateQuestionAnalytics,
  calculateSectionAnalytics,
  calculateSeriesProgression
};