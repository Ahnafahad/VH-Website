// Main Excel Processing Engine
// Handles reading, processing, and converting Excel files to JSON

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { mapColumns, validateColumns, extractRowData } = require('./column-mapper');
const {
  calculateBasicAnalytics,
  calculateClassStats,
  calculatePercentile,
  calculateSkipStrategy,
  calculateQuestionChoiceStrategy,
  calculateRecoveryScore,
  generateQuestionAnalytics,
  calculateSectionAnalytics,
  calculateSeriesProgression
} = require('./analytics-engine');
const {
  calculateThresholds,
  shouldApplyThresholds
} = require('./threshold-calculator');

class ExcelProcessor {
  constructor() {
    this.resultsDir = path.join(process.cwd(), 'Results');
    this.outputDir = path.join(process.cwd(), 'public', 'data');
    this.studentsData = {};
    this.simpleTests = {};
    this.fullTests = {};
    this.mockTests = {};
    this.processedTests = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Initialize processor and ensure output directory exists
   */
  initialize() {
    console.log('🚀 Initializing Excel Processor...');

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`✅ Created output directory: ${this.outputDir}`);
    }

    // Load existing student data if available
    this.loadStudentsData();

    console.log('✅ Processor initialized successfully');
  }

  /**
   * Load students data from Students sheet or existing JSON
   * Merges both 6-digit IDs (from IBA tests) and 7-digit IDs (from DU FBS Mocks)
   */
  loadStudentsData() {
    this.studentsData = {};
    const studentsByName = new Map(); // Track students by name to merge IDs

    // STEP 1: Load students from Simple Test Data.xlsx (6-digit IDs)
    const possiblePaths = [
      path.join(this.resultsDir, 'Simple Test Data.xlsx'),
      path.join(this.resultsDir, 'IBA', 'Simple Test Data.xlsx'),
      path.join(this.resultsDir, 'IBA Mock', 'Simple Test Data.xlsx')
    ];

    let simpleTestLoaded = false;
    for (const simpleTestFile of possiblePaths) {
      if (fs.existsSync(simpleTestFile)) {
        try {
          const workbook = XLSX.readFile(simpleTestFile);
          if (workbook.SheetNames.includes('Students')) {
            const studentsSheet = workbook.Sheets['Students'];
            const studentsArray = XLSX.utils.sheet_to_json(studentsSheet);

            studentsArray.forEach(student => {
              const studentId = String(student['Student ID'] || student['student_id'] || student['ID'] || '');
              const studentName = student['Student Name'] || student['student_name'] || student['Name'] || '';
              const studentEmail = student['Student Email'] || student['student_email'] || student['Email'] || '';

              if (studentId && studentName) {
                this.studentsData[studentId] = {
                  id: studentId,
                  name: studentName,
                  email: studentEmail
                };
                studentsByName.set(studentName, {
                  id: studentId,
                  name: studentName,
                  email: studentEmail
                });
              }
            });

            console.log(`✅ Loaded ${Object.keys(this.studentsData).length} students (6-digit IDs) from ${path.relative(this.resultsDir, simpleTestFile)}`);
            simpleTestLoaded = true;
            break;
          }
        } catch (error) {
          this.warnings.push(`Failed to load students data from ${simpleTestFile}: ${error.message}`);
        }
      }
    }

    if (!simpleTestLoaded) {
      console.log('⚠️  No Students sheet found in Simple Test Data.xlsx');
    }

    // STEP 2: Load students from DU FBS Mock files (7-digit IDs)
    const fbsMockDir = path.join(this.resultsDir, 'DU FBS Mocks');
    if (fs.existsSync(fbsMockDir)) {
      const fbsMockFiles = fs.readdirSync(fbsMockDir).filter(f => f.endsWith('.xlsx'));

      fbsMockFiles.forEach(fbsFile => {
        try {
          const workbook = XLSX.readFile(path.join(fbsMockDir, fbsFile));
          if (workbook.SheetNames.includes('Sheet1')) {
            const sheet = workbook.Sheets['Sheet1'];
            const data = XLSX.utils.sheet_to_json(sheet);

            data.forEach(row => {
              const studentId = String(row.ID || '');
              const studentName = row.Name || '';

              if (studentId && studentName && studentId !== 'undefined') {
                // Check if this student already exists (by name)
                const existingStudent = studentsByName.get(studentName);

                if (existingStudent) {
                  // Student exists with 6-digit ID, add the 7-digit ID pointing to same data
                  this.studentsData[studentId] = existingStudent;
                } else {
                  // New student only in FBS mocks
                  const studentData = {
                    id: studentId,
                    name: studentName,
                    email: '' // FBS mock files don't have email
                  };
                  this.studentsData[studentId] = studentData;
                  studentsByName.set(studentName, studentData);
                }
              }
            });
          }
        } catch (error) {
          this.warnings.push(`Failed to load students from ${fbsFile}: ${error.message}`);
        }
      });

      console.log(`✅ Total students after merging FBS IDs: ${Object.keys(this.studentsData).length} entries`);
      console.log(`   Unique students: ${studentsByName.size}`);
    }
  }

  /**
   * Process a single Excel file
   * @param {string} filename - Excel filename
   * @returns {Object} - Processing result
   */
  processExcelFile(filename) {
    const filePath = path.join(this.resultsDir, filename);

    console.log(`\n📊 Processing: ${filename}`);

    if (!fs.existsSync(filePath)) {
      const error = `File not found: ${filename}`;
      this.errors.push(error);
      return { success: false, error };
    }

    try {
      const workbook = XLSX.readFile(filePath);
      console.log(`📋 Sheets found: ${workbook.SheetNames.join(', ')}`);

      if (filename.includes('Simple Test Data.xlsx')) {
        return this.processSimpleTestFile(workbook, filename);
      } else {
        return this.processFullTestFile(workbook, filename);
      }

    } catch (error) {
      const errorMsg = `Error processing ${filename}: ${error.message}`;
      this.errors.push(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Process Simple Test Data.xlsx file
   * @param {Object} workbook - XLSX workbook
   * @param {string} filename - Source filename
   * @returns {Object} - Processing result
   */
  processSimpleTestFile(workbook, filename) {
    const results = { success: true, testsProcessed: 0, errors: [] };

    workbook.SheetNames.forEach(sheetName => {
      if (sheetName === 'Students') {
        return; // Skip students sheet, already processed
      }

      try {
        console.log(`  📄 Processing sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (rawData.length < 2) {
          this.warnings.push(`Sheet ${sheetName} has insufficient data`);
          return;
        }

        const headers = rawData[0];
        const dataRows = rawData.slice(1);

        // Map columns
        const mappedColumns = mapColumns(headers);
        const validation = validateColumns(mappedColumns, 'simple');

        if (!validation.isValid) {
          const error = `Sheet ${sheetName}: Missing required columns: ${validation.missing.join(', ')}`;
          this.errors.push(error);
          results.errors.push(error);
          return;
        }

        // Process test data
        const testData = this.processSimpleTestSheet(sheetName, dataRows, mappedColumns);
        testData.metadata = {
          processedAt: new Date().toISOString(),
          sourceFile: filename,
          sheetName: sheetName
        };

        this.simpleTests[sheetName] = testData;
        results.testsProcessed++;

        console.log(`    ✅ Processed ${Object.keys(testData.results).length} student results`);

      } catch (error) {
        const errorMsg = `Error processing sheet ${sheetName}: ${error.message}`;
        this.errors.push(errorMsg);
        results.errors.push(errorMsg);
      }
    });

    return results;
  }

  /**
   * Process a simple test sheet
   * @param {string} testName - Test name
   * @param {Array} dataRows - Raw data rows
   * @param {Object} mappedColumns - Column mapping
   * @returns {Object} - Processed test data
   */
  processSimpleTestSheet(testName, dataRows, mappedColumns) {
    const results = {};
    const allScores = [];

    // Extract test series and number
    const seriesMatch = testName.match(/^(.+?)\s+(\d+)$/);
    const testSeries = seriesMatch ? seriesMatch[1] : testName;
    const testNumber = seriesMatch ? parseInt(seriesMatch[2]) : 1;

    dataRows.forEach(row => {
      try {
        const extractedData = extractRowData(row, mappedColumns);

        if (!extractedData.basic.studentId || !extractedData.basic.studentName) {
          return; // Skip rows without student ID or name
        }

        const studentId = extractedData.basic.studentId;
        const studentResult = this.processSimpleTestStudent(extractedData, mappedColumns);

        results[studentId] = studentResult;
        allScores.push(studentResult.score);

      } catch (error) {
        this.warnings.push(`Error processing student row in ${testName}: ${error.message}`);
      }
    });

    // Calculate class statistics
    const classStats = calculateClassStats(Object.values(results), 'score');

    // Calculate percentiles for each student
    Object.values(results).forEach(studentResult => {
      studentResult.analytics.percentile = calculatePercentile(studentResult.score, allScores);
    });

    return {
      testName,
      testSeries,
      testNumber,
      testType: 'simple',
      results,
      classStats
    };
  }

  /**
   * Process a single student's simple test data
   * @param {Object} extractedData - Extracted student data
   * @param {Object} mappedColumns - Column mapping
   * @returns {Object} - Processed student result
   */
  processSimpleTestStudent(extractedData, mappedColumns) {
    const basic = extractedData.basic;
    const sections = extractedData.sections;
    const essays = extractedData.essays;

    // Calculate main performance metrics
    let correct = basic.correct || 0;
    let wrong = basic.wrong || 0;
    let score = basic.score || 0;
    let totalQuestions = basic.totalQuestions || 0;

    // If wrong is missing but we have correct and totalQuestions, calculate wrong
    if (wrong === 0 && correct > 0 && totalQuestions > 0) {
      wrong = Math.max(0, totalQuestions - correct);
    }

    // If we have section data, aggregate it
    if (Object.keys(sections).length > 0) {
      correct = 0;
      wrong = 0;
      score = 0;

      Object.values(sections).forEach(section => {
        correct += section.correct || 0;
        wrong += section.wrong || 0;
        score += section.score || 0;
        if (section.totalQuestions) {
          totalQuestions = Math.max(totalQuestions, section.totalQuestions);
        }
      });
    }

    // Calculate analytics
    const basicAnalytics = calculateBasicAnalytics(correct, wrong, totalQuestions);
    const threshold = basic.threshold || 0;
    const passStatus = score >= threshold;

    const studentResult = {
      studentId: basic.studentId,
      studentName: basic.studentName,
      correct,
      wrong,
      unattempted: basicAnalytics.unattempted,
      totalQuestions,
      score,
      rank: basic.rank || 0,
      threshold,
      analytics: {
        accuracy: basicAnalytics.accuracy,
        attemptRate: basicAnalytics.attemptRate,
        passStatus,
        percentile: 0 // Will be calculated later
      }
    };

    // Add section data if available
    if (Object.keys(sections).length > 0) {
      studentResult.sections = {};
      Object.entries(sections).forEach(([sectionNumber, sectionData]) => {
        studentResult.sections[sectionNumber] = {
          correct: sectionData.correct || 0,
          wrong: sectionData.wrong || 0,
          score: sectionData.score || 0,
          totalQuestions: sectionData.totalQuestions || 0
        };
      });
    }

    // Add essay data if available
    if (Object.keys(essays).length > 0) {
      studentResult.essays = essays;
    }

    return studentResult;
  }

  /**
   * Process a full test file (like Mathematics CT 2.xlsx)
   * @param {Object} workbook - XLSX workbook
   * @param {string} filename - Source filename
   * @returns {Object} - Processing result
   */
  processFullTestFile(workbook, filename) {
    console.log(`  📊 Processing full test file: ${filename}`);

    const testName = filename.replace('.xlsx', '');
    const sheets = workbook.SheetNames;

    try {
      // Sheet 1: Main performance data
      const sheet1Data = this.processFullTestSheet1(workbook.Sheets[sheets[0]]);

      // Sheet 2: Top questions analytics (if available)
      let topQuestionsData = {};
      if (sheets.length > 1 && workbook.Sheets[sheets[1]]) {
        topQuestionsData = this.processFullTestSheet2(workbook.Sheets[sheets[1]]);
      }

      // Sheet 3: Individual responses (if available)
      let responsesData = {};
      if (sheets.length > 2 && workbook.Sheets[sheets[2]]) {
        responsesData = this.processFullTestSheet3(workbook.Sheets[sheets[2]]);
      }

      // Combine all data
      const fullTestData = this.combineFullTestData(testName, sheet1Data, topQuestionsData, responsesData);
      fullTestData.metadata = {
        processedAt: new Date().toISOString(),
        sourceFile: filename,
        sheets: sheets
      };

      // Check if this is a mock test (filename or path contains "Mock")
      const isMockTest = filename.toLowerCase().includes('mock') || testName.toLowerCase().includes('mock');

      if (isMockTest) {
        this.mockTests[testName] = fullTestData;
        console.log(`    ✅ Processed mock test with ${Object.keys(fullTestData.results).length} students`);
      } else {
        this.fullTests[testName] = fullTestData;
        console.log(`    ✅ Processed full test with ${Object.keys(fullTestData.results).length} students`);
      }

      return { success: true, testsProcessed: 1, errors: [] };

    } catch (error) {
      const errorMsg = `Error processing full test ${filename}: ${error.message}`;
      this.errors.push(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Process Sheet 1 of full test (main performance data)
   * @param {Object} worksheet - XLSX worksheet
   * @returns {Object} - Processed sheet 1 data
   */
  processFullTestSheet1(worksheet) {
    // Use defval to ensure all cells are included, even empty ones
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (rawData.length < 2) {
      throw new Error('Sheet 1 has insufficient data');
    }

    const headers = rawData[0];
    const dataRows = rawData.slice(1);

    const mappedColumns = mapColumns(headers);
    const validation = validateColumns(mappedColumns, 'full');

    if (!validation.isValid) {
      throw new Error(`Missing required columns: ${validation.missing.join(', ')}`);
    }

    const results = {};

    dataRows.forEach(row => {
      try {
        const extractedData = extractRowData(row, mappedColumns);

        if (!extractedData.basic.studentId) {
          return; // Skip rows without student ID
        }

        const studentId = extractedData.basic.studentId;
        results[studentId] = this.processFullTestStudentSheet1(extractedData);

      } catch (error) {
        this.warnings.push(`Error processing student row in Sheet 1: ${error.message}`);
      }
    });

    return results;
  }

  /**
   * Process a student's data from Sheet 1 of full test
   * @param {Object} extractedData - Extracted student data
   * @returns {Object} - Processed student result
   */
  processFullTestStudentSheet1(extractedData) {
    const basic = extractedData.basic;
    const sections = extractedData.sections;
    const essays = extractedData.essays;

    // Calculate MCQ marks and essay marks separately
    let mcqMarks = 0;
    let essayMarks = 0;
    let essayCount = 0;
    let totalMCQCorrect = 0;
    let totalMCQWrong = 0;

    // Process section data
    const processedSections = {};
    Object.entries(sections).forEach(([sectionNumber, sectionData]) => {
      const sectionMarks = sectionData.score || 0;
      const sectionCorrect = sectionData.correct || 0;
      const sectionWrong = sectionData.wrong || 0;

      mcqMarks += sectionMarks;
      totalMCQCorrect += sectionCorrect;
      totalMCQWrong += sectionWrong;

      processedSections[sectionNumber] = {
        correct: sectionCorrect,
        wrong: sectionWrong,
        marks: sectionMarks,
        percentage: Math.round((sectionData.percentage || 0) * 100) / 100,
        totalQuestions: sectionData.totalQuestions || 0
      };
    });

    // Calculate essay marks
    if (Object.keys(essays).length > 0) {
      Object.values(essays).forEach(score => {
        essayMarks += score || 0;
        essayCount++;
      });
    }

    // Calculate total marks including essays
    const totalMarks = basic.score || (mcqMarks + essayMarks);

    // Calculate MCQ accuracy (correct/attempted)
    const mcqAttempted = totalMCQCorrect + totalMCQWrong;
    const mcqAccuracy = mcqAttempted > 0 ? (totalMCQCorrect / mcqAttempted) * 100 : 0;

    // Calculate percentages
    // MCQ percentage is already in basic.percentage or can be calculated
    const mcqPercentage = Math.round((basic.percentage || 0) * 100) / 100;

    // Total possible marks = MCQ marks (from file) + essays (always 30 total for IBA)
    // Essay section is always out of 30, whether there's 1, 2, or 3 essays
    const maxEssayMarks = essayCount > 0 ? 30 : 0;
    const maxTotalMarks = (mcqPercentage > 0 ? (mcqMarks / mcqPercentage) * 100 : 0) + maxEssayMarks;
    const totalPercentage = maxTotalMarks > 0 ? (totalMarks / maxTotalMarks) * 100 : 0;

    // Use Rank in MCQ as fallback if Rank is not provided
    const rank = basic.rank || basic.rankInMCQ || 0;

    const studentResult = {
      studentId: basic.studentId,
      studentName: basic.studentName,
      sections: processedSections,
      totalMarks,
      mcqMarks,
      essayMarks,
      mcqCorrect: totalMCQCorrect,
      mcqWrong: totalMCQWrong,
      mcqAccuracy: Math.round(mcqAccuracy * 100) / 100,
      mcqPercentage,
      totalPercentage: Math.round(totalPercentage * 100) / 100,
      rank
    };

    // Add essay data if available
    if (Object.keys(essays).length > 0) {
      studentResult.essays = essays;
      studentResult.maxEssayMarks = maxEssayMarks;
    }

    return studentResult;
  }

  /**
   * Process Sheet 2 of full test (top questions analytics)
   * @param {Object} worksheet - XLSX worksheet
   * @returns {Object} - Top questions data
   */
  processFullTestSheet2(worksheet) {
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (rawData.length < 2) {
      return {};
    }

    const topQuestions = {};

    // Process the top questions data
    const headers = rawData[0];
    const dataRows = rawData.slice(1);

    // Find section patterns in headers
    const sectionColumns = {};
    headers.forEach((header, index) => {
      const sectionMatch = header.match(/(\d+)\s+.*?(right|skipped|wrong)/i);
      if (sectionMatch) {
        const sectionNumber = sectionMatch[1];
        const questionType = sectionMatch[2].toLowerCase();

        if (!sectionColumns[sectionNumber]) {
          sectionColumns[sectionNumber] = {};
        }

        if (questionType === 'right') {
          sectionColumns[sectionNumber].rightQuestions = index;
        } else if (questionType === 'skipped') {
          sectionColumns[sectionNumber].skippedQuestions = index;
        } else if (questionType === 'wrong') {
          sectionColumns[sectionNumber].wrongQuestions = index;
        }
      }
    });

    // Extract top questions for each section
    Object.entries(sectionColumns).forEach(([sectionNumber, columns]) => {
      topQuestions[sectionNumber] = {
        mostCorrect: [],
        mostSkipped: [],
        mostWrong: []
      };

      dataRows.forEach(row => {
        if (columns.rightQuestions !== undefined && row[columns.rightQuestions]) {
          topQuestions[sectionNumber].mostCorrect.push({
            questionId: row[columns.rightQuestions],
            count: row[columns.rightQuestions + 1] || 0
          });
        }

        if (columns.skippedQuestions !== undefined && row[columns.skippedQuestions]) {
          topQuestions[sectionNumber].mostSkipped.push({
            questionId: row[columns.skippedQuestions],
            count: row[columns.skippedQuestions + 1] || 0
          });
        }

        if (columns.wrongQuestions !== undefined && row[columns.wrongQuestions]) {
          topQuestions[sectionNumber].mostWrong.push({
            questionId: row[columns.wrongQuestions],
            count: row[columns.wrongQuestions + 1] || 0
          });
        }
      });
    });

    return topQuestions;
  }

  /**
   * Process Sheet 3 of full test (individual responses)
   * @param {Object} worksheet - XLSX worksheet
   * @returns {Object} - Individual responses data
   */
  processFullTestSheet3(worksheet) {
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (rawData.length < 2) {
      return {};
    }

    const headers = rawData[0];
    const dataRows = rawData.slice(1);

    const responsesData = {};

    // Find student ID column and question columns
    const studentIdColumn = headers.findIndex(header =>
      ['Roll', 'ID', 'Student ID', 'student_id'].some(pattern =>
        header.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    if (studentIdColumn === -1) {
      this.warnings.push('No student ID column found in responses sheet');
      return {};
    }

    // Process each student's responses
    dataRows.forEach(row => {
      const studentId = String(row[studentIdColumn] || '');
      if (!studentId) return;

      responsesData[studentId] = {};

      headers.forEach((header, index) => {
        if (index === studentIdColumn) return; // Skip student ID column

        // Check if this is a question column (Section1-Q1, etc.)
        if (header.match(/Section\d+-Q\d+/i)) {
          const response = row[index];
          if (response && response !== '') {
            responsesData[studentId][header] = String(response);
          }
        }
      });
    });

    return responsesData;
  }

  /**
   * Combine all full test data and calculate advanced analytics
   * @param {string} testName - Test name
   * @param {Object} sheet1Data - Main performance data
   * @param {Object} topQuestionsData - Top questions analytics
   * @param {Object} responsesData - Individual responses
   * @returns {Object} - Complete full test data
   */
  combineFullTestData(testName, sheet1Data, topQuestionsData, responsesData) {
    const results = {};

    // Generate question analytics from responses - convert format first
    const formattedResults = {};
    Object.entries(responsesData).forEach(([studentId, responses]) => {
      formattedResults[studentId] = { responses };
    });
    const questionAnalytics = generateQuestionAnalytics(formattedResults);

    Object.entries(sheet1Data).forEach(([studentId, studentData]) => {
      const studentResponses = responsesData[studentId] || {};

      // Calculate advanced analytics
      const analytics = {
        skipStrategy: calculateSkipStrategy(studentResponses, questionAnalytics),
        questionChoiceStrategy: calculateQuestionChoiceStrategy(studentResponses, questionAnalytics),
        recoveryScore: calculateRecoveryScore(studentResponses, questionAnalytics),
        sectionPerformance: {}
      };

      // Calculate section performance analytics
      Object.entries(studentData.sections).forEach(([sectionNumber, sectionData]) => {
        // Fix totalQuestions if missing - calculate from responses
        const sectionResponses = Object.keys(studentResponses).filter(q => q.startsWith(`Section${sectionNumber}-`));
        const fixedSectionData = {
          ...sectionData,
          totalQuestions: sectionData.totalQuestions || sectionResponses.length || (sectionData.correct + sectionData.wrong)
        };
        analytics.sectionPerformance[sectionNumber] = calculateSectionAnalytics(fixedSectionData);
      });

      results[studentId] = {
        ...studentData,
        responses: studentResponses,
        analytics
      };
    });

    // Calculate class statistics
    const classStats = calculateClassStats(Object.values(results), 'totalMarks');

    // Determine sections
    const sections = Object.keys(Object.values(results)[0]?.sections || {});

    // Apply threshold logic if applicable
    if (shouldApplyThresholds(testName)) {
      console.log(`    🎯 Applying threshold logic to ${testName}`);

      // Get section IDs from first student
      const firstStudent = Object.values(results)[0];
      const sectionIds = sections;
      const hasEssay = firstStudent.essayMarks !== undefined && firstStudent.essayMarks > 0;

      // Calculate thresholds
      const thresholdData = calculateThresholds(Object.values(results), sectionIds, hasEssay, testName);

      // Apply thresholds to class stats
      classStats.sectionThresholds = thresholdData.thresholds;
      classStats.thresholdsAdjusted = thresholdData.adjusted;
      classStats.passedStudents = thresholdData.passData.passCount;
      classStats.failedStudents = thresholdData.passData.failCount;
      classStats.absentStudents = thresholdData.passData.absentCount || 0;

      // Update student results with threshold data
      thresholdData.passData.students.forEach(studentData => {
        if (results[studentData.studentId]) {
          results[studentData.studentId].rank = studentData.rank;
          results[studentData.studentId].rankStatus = studentData.rankStatus;
          results[studentData.studentId].passedAll = studentData.passedAll;
          results[studentData.studentId].failedSections = studentData.failedSections;
          results[studentData.studentId].isAbsent = studentData.isAbsent || false;

          // Update section thresholds and pass status
          if (results[studentData.studentId].sections) {
            Object.keys(results[studentData.studentId].sections).forEach(sectionId => {
              if (studentData.sectionResults[sectionId]) {
                results[studentData.studentId].sections[sectionId].threshold = studentData.sectionResults[sectionId].threshold;
                results[studentData.studentId].sections[sectionId].passed = studentData.sectionResults[sectionId].passed;
              }
            });
          }

          // Update essay threshold and pass status
          if (hasEssay && studentData.sectionResults['essay']) {
            results[studentData.studentId].essayThreshold = studentData.sectionResults['essay'].threshold;
            results[studentData.studentId].essayPassed = studentData.sectionResults['essay'].passed;
            if (firstStudent.essayPercentage !== undefined) {
              results[studentData.studentId].essayPercentage = firstStudent.essayPercentage;
            }
          }
        }
      });

      const absentMsg = thresholdData.passData.absentCount > 0 ? `, ${thresholdData.passData.absentCount} absent` : '';
      console.log(`    ✅ Thresholds: ${JSON.stringify(thresholdData.thresholds)} | ${thresholdData.passData.passCount} passed, ${thresholdData.passData.failCount} failed${absentMsg}`);
    }

    return {
      testName,
      testType: 'full',
      sections,
      results,
      classStats,
      topQuestions: topQuestionsData
    };
  }

  /**
   * Generate optimized JSON files for Vercel serving
   */
  generateJSONFiles() {
    console.log('\n📁 Generating JSON files...');

    try {
      // Students data
      const studentsOutput = {
        students: this.studentsData,
        metadata: {
          totalStudents: Object.keys(this.studentsData).length,
          lastUpdated: new Date().toISOString()
        }
      };

      this.writeJSONFile('students.json', studentsOutput);

      // Simple tests data with series information
      const simpleTestsOutput = {
        tests: this.simpleTests,
        series: this.generateSeriesData(),
        metadata: {
          totalTests: Object.keys(this.simpleTests).length,
          lastProcessed: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      this.writeJSONFile('simple-tests.json', simpleTestsOutput);

      // Full tests data
      const fullTestsOutput = {
        tests: this.fullTests,
        metadata: {
          totalTests: Object.keys(this.fullTests).length,
          lastProcessed: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      this.writeJSONFile('full-tests.json', fullTestsOutput);

      // Mock tests data
      const mockTestsOutput = {
        tests: this.mockTests,
        metadata: {
          totalTests: Object.keys(this.mockTests).length,
          lastProcessed: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      this.writeJSONFile('mock-tests.json', mockTestsOutput);

      // System metadata
      const systemMetadata = {
        version: '1.0.0',
        lastProcessed: new Date().toISOString(),
        totalStudents: Object.keys(this.studentsData).length,
        totalSimpleTests: Object.keys(this.simpleTests).length,
        totalFullTests: Object.keys(this.fullTests).length,
        totalMockTests: Object.keys(this.mockTests).length,
        processingStats: {
          successfulTests: this.processedTests.length,
          failedTests: this.errors.length,
          warnings: this.warnings
        }
      };

      this.writeJSONFile('metadata.json', systemMetadata);

      console.log('✅ All JSON files generated successfully');

    } catch (error) {
      console.error('❌ Error generating JSON files:', error.message);
      this.errors.push(`JSON generation failed: ${error.message}`);
    }
  }

  /**
   * Generate series data for test progression
   * @returns {Object} - Series data
   */
  generateSeriesData() {
    const series = {};

    Object.values(this.simpleTests).forEach(test => {
      if (!series[test.testSeries]) {
        series[test.testSeries] = {
          seriesName: test.testSeries,
          tests: [],
          progressionData: []
        };
      }

      series[test.testSeries].tests.push(test.testName);
    });

    // Calculate progression data for each series
    Object.entries(series).forEach(([seriesName, seriesData]) => {
      const testsInSeries = seriesData.tests
        .map(testName => this.simpleTests[testName])
        .filter(test => test)
        .sort((a, b) => a.testNumber - b.testNumber);

      Object.keys(this.studentsData).forEach(studentId => {
        const studentProgression = calculateSeriesProgression(testsInSeries, studentId);

        studentProgression.forEach((progression, index) => {
          if (!seriesData.progressionData[index]) {
            seriesData.progressionData[index] = {
              testName: progression.testName,
              studentPerformance: {}
            };
          }

          seriesData.progressionData[index].studentPerformance[studentId] = {
            score: progression.score,
            rank: progression.rank,
            accuracy: progression.accuracy,
            improvement: progression.improvement
          };
        });
      });
    });

    return series;
  }

  /**
   * Write JSON file with error handling
   * @param {string} filename - Output filename
   * @param {Object} data - Data to write
   */
  writeJSONFile(filename, data) {
    const filePath = path.join(this.outputDir, filename);
    const jsonString = JSON.stringify(data, null, 2);

    fs.writeFileSync(filePath, jsonString);

    const sizeKB = (jsonString.length / 1024).toFixed(2);
    console.log(`  ✅ ${filename}: ${sizeKB}KB`);

    if (sizeKB > 5000) { // 5MB warning
      this.warnings.push(`${filename} is large (${sizeKB}KB) - consider optimization`);
    }
  }

  /**
   * Scan Results directory and get all Excel files
   * @returns {Array} - List of Excel filenames to process
   */
  scanResultsDirectory() {
    console.log('📂 Scanning Results directory for Excel files (including subdirectories)...');

    if (!fs.existsSync(this.resultsDir)) {
      console.error(`❌ Results directory not found: ${this.resultsDir}`);
      return [];
    }

    const excelFiles = [];
    const excludePatterns = ['template', '~$', '.tmp', 'DU FBS Mocks'];

    // Recursively scan for Excel files
    const scanDir = (dir) => {
      const items = fs.readdirSync(dir);

      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip DU FBS Mocks directory (processed separately)
          if (!excludePatterns.some(pattern => item.toLowerCase().includes(pattern.toLowerCase()))) {
            scanDir(fullPath);
          }
        } else if (stat.isFile() && item.endsWith('.xlsx')) {
          // Check if file should be excluded
          const shouldExclude = excludePatterns.some(pattern =>
            item.toLowerCase().includes(pattern.toLowerCase())
          );

          if (!shouldExclude) {
            // Store relative path from Results directory
            const relativePath = path.relative(this.resultsDir, fullPath);
            excelFiles.push(relativePath);
          }
        }
      });
    };

    scanDir(this.resultsDir);

    console.log(`✅ Found ${excelFiles.length} Excel file(s) to process:`);
    excelFiles.forEach(file => console.log(`   - ${file}`));

    return excelFiles;
  }

  /**
   * Run the complete processing pipeline
   */
  async run() {
    console.log('🚀 Starting Excel Processing Pipeline\n');

    this.initialize();

    // Automatically scan for all Excel files
    const filesToProcess = this.scanResultsDirectory();

    if (filesToProcess.length === 0) {
      console.log('⚠️  No Excel files found to process');
      return {
        success: false,
        processed: 0,
        errors: ['No Excel files found'],
        warnings: this.warnings
      };
    }

    // Process each file
    for (const filename of filesToProcess) {
      const result = this.processExcelFile(filename);
      if (result.success) {
        this.processedTests.push(filename);
      }
    }

    // Generate JSON outputs
    this.generateJSONFiles();

    // Print summary
    this.printSummary();

    return {
      success: this.errors.length === 0,
      processed: this.processedTests.length,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Print processing summary
   */
  printSummary() {
    console.log('\n📊 PROCESSING SUMMARY');
    console.log('====================');
    console.log(`✅ Successfully processed: ${this.processedTests.length} files`);
    console.log(`📚 Students loaded: ${Object.keys(this.studentsData).length}`);
    console.log(`📝 Simple tests: ${Object.keys(this.simpleTests).length}`);
    console.log(`📋 Full tests: ${Object.keys(this.fullTests).length}`);
    console.log(`🎭 Mock tests: ${Object.keys(this.mockTests).length}`);

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${this.warnings.length}):`);
      this.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors (${this.errors.length}):`);
      this.errors.forEach(error => console.log(`   - ${error}`));
    } else {
      console.log('\n🎉 All processing completed successfully!');
    }
  }
}

module.exports = ExcelProcessor;