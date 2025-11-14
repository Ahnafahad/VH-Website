#!/usr/bin/env node

/**
 * DU FBS Mock Test Processor
 * Processes DU FBS Mock Excel files and generates JSON for results display
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class FBSMockProcessor {
  constructor() {
    this.resultsDir = path.join(process.cwd(), 'Results', 'DU FBS Mocks');
    this.outputDir = path.join(process.cwd(), 'public', 'data');
    this.fbsMocks = {};
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Main processing function
   */
  async run() {
    console.log('🎓 DU FBS Mock Test Processor');
    console.log('==============================\n');

    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      // Get all Excel files in DU FBS Mocks folder
      const files = fs.readdirSync(this.resultsDir)
        .filter(file => file.endsWith('.xlsx') && file.includes('Mock'));

      console.log(`📁 Found ${files.length} FBS mock files\n`);

      // Process each mock file
      for (const file of files) {
        await this.processFBSMock(file);
      }

      // Save to JSON
      this.saveFBSMocks();

      // Print summary
      this.printSummary();

      return { success: true };

    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      this.errors.push(error.message);
      return { success: false };
    }
  }

  /**
   * Process Sheet2 to extract top questions data
   */
  processSheet2TopQuestions(workbook, testName) {
    try {
      const sheet2 = workbook.Sheets['Sheet2'];
      if (!sheet2) {
        console.log(`   ⚠️  Sheet2 not found in ${testName}`);
        return null;
      }

      const data = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' });
      const topQuestions = {};

      // Section mappings for FBS
      const sections = [
        { name: 'English', start: 1, end: 16 },
        { name: 'Adv English', start: 17, end: 28 },
        { name: 'Business Studies', start: 29, end: 44 },
        { name: 'Accounting', start: 45, end: 60 },
        { name: 'Economics', start: 61, end: 76 }
      ];

      sections.forEach(section => {
        const sectionData = {
          mostCorrect: [],
          mostWrong: [],
          mostSkipped: []
        };

        // Find columns for this section
        const correctColPrefix = `${section.name} Top 10 Correct`;
        const wrongColPrefix = `${section.name} Top 10 Wrong`;
        const skippedColPrefix = `${section.name} Top 10 Skipped`;

        // Extract top 10 for each category
        for (let i = 1; i < data.length && i <= 10; i++) {
          const row = data[i];

          // Most Correct
          const correctIdx = data[0].findIndex(h => String(h).includes(correctColPrefix));
          const correctCountIdx = data[0].findIndex(h => String(h).toLowerCase().includes('no. of correct'));
          if (correctIdx !== -1 && row[correctIdx]) {
            const qNum = parseInt(String(row[correctIdx]).replace(/\D/g, ''));
            if (qNum >= section.start && qNum <= section.end) {
              sectionData.mostCorrect.push({
                questionNumber: qNum,
                count: row[correctCountIdx] || 0
              });
            }
          }

          // Most Wrong
          const wrongIdx = data[0].findIndex(h => String(h).includes(wrongColPrefix));
          const wrongCountIdx = data[0].findIndex(h => String(h).toLowerCase().includes('no. of wrong'));
          if (wrongIdx !== -1 && row[wrongIdx]) {
            const qNum = parseInt(String(row[wrongIdx]).replace(/\D/g, ''));
            if (qNum >= section.start && qNum <= section.end) {
              sectionData.mostWrong.push({
                questionNumber: qNum,
                count: row[wrongCountIdx] || 0
              });
            }
          }

          // Most Skipped
          const skippedIdx = data[0].findIndex(h => String(h).includes(skippedColPrefix));
          const skippedCountIdx = data[0].findIndex(h => String(h).toLowerCase().includes('no. of skipped'));
          if (skippedIdx !== -1 && row[skippedIdx]) {
            const qNum = parseInt(String(row[skippedIdx]).replace(/\D/g, ''));
            if (qNum >= section.start && qNum <= section.end) {
              sectionData.mostSkipped.push({
                questionNumber: qNum,
                count: row[skippedCountIdx] || 0
              });
            }
          }
        }

        topQuestions[section.name.toLowerCase().replace(/\s+/g, '')] = sectionData;
      });

      return topQuestions;
    } catch (error) {
      console.log(`   ⚠️  Error processing Sheet2: ${error.message}`);
      return null;
    }
  }

  /**
   * Process Sheet3 to extract individual student responses
   */
  processSheet3Responses(workbook, testName) {
    try {
      const sheet3 = workbook.Sheets['Sheet3'];
      if (!sheet3) {
        console.log(`   ⚠️  Sheet3 not found in ${testName}`);
        return {};
      }

      const data = XLSX.utils.sheet_to_json(sheet3, { header: 1, defval: '' });
      const headers = data[0];
      const responses = {};

      // Find Roll/ID column
      const idColIdx = headers.findIndex(h =>
        String(h).toLowerCase() === 'roll' ||
        String(h).toLowerCase() === 'id'
      );

      if (idColIdx === -1) {
        console.log(`   ⚠️  Roll/ID column not found in Sheet3`);
        return {};
      }

      // Process each student row
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const studentId = String(row[idColIdx] || '').trim();

        if (!studentId) continue;

        const studentResponses = {};

        // Extract responses for q1-q76
        for (let q = 1; q <= 76; q++) {
          const qColIdx = headers.findIndex(h => String(h).toLowerCase() === `q${q}`);

          if (qColIdx !== -1) {
            const response = String(row[qColIdx] || '').trim();

            if (response && response !== 'NAN') {
              // Parse format: "A (C)" -> {answer: "A", status: "correct"}
              const match = response.match(/^([A-D])\s*\(([CW])\)$/i);
              if (match) {
                studentResponses[`q${q}`] = {
                  answer: match[1].toUpperCase(),
                  status: match[2].toUpperCase() === 'C' ? 'correct' : 'wrong'
                };
              }
            } else {
              // Question was skipped
              studentResponses[`q${q}`] = {
                answer: null,
                status: 'skipped'
              };
            }
          }
        }

        responses[studentId] = studentResponses;
      }

      console.log(`   📝 Extracted responses for ${Object.keys(responses).length} students`);
      return responses;
    } catch (error) {
      console.log(`   ⚠️  Error processing Sheet3: ${error.message}`);
      return {};
    }
  }

  /**
   * Calculate advanced analytics from student responses
   */
  calculateAdvancedAnalytics(responses, sections) {
    if (!responses || Object.keys(responses).length === 0) {
      return {
        skipStrategy: 0,
        questionChoiceStrategy: 0,
        recoveryScore: 0,
        sectionPerformance: {}
      };
    }

    // Skip Strategy: % of questions skipped vs attempted wrong
    const totalSkipped = Object.values(responses).filter(r => r.status === 'skipped').length;
    const totalWrong = Object.values(responses).filter(r => r.status === 'wrong').length;
    const totalAttempted = Object.values(responses).length - totalSkipped;
    const skipStrategy = totalAttempted > 0 ? (totalSkipped / (totalSkipped + totalWrong)) * 100 : 0;

    // Question Choice Strategy: Success rate when attempting
    const totalCorrect = Object.values(responses).filter(r => r.status === 'correct').length;
    const questionChoiceStrategy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;

    // Recovery Score: How well they did after wrong answers (streaks analysis)
    let recoveryScore = 0;
    const responseArray = Object.entries(responses).sort(([a], [b]) => {
      const numA = parseInt(a.replace('q', ''));
      const numB = parseInt(b.replace('q', ''));
      return numA - numB;
    });

    let recoveries = 0;
    let opportunities = 0;
    for (let i = 0; i < responseArray.length - 1; i++) {
      if (responseArray[i][1].status === 'wrong') {
        opportunities++;
        if (responseArray[i + 1][1].status === 'correct') {
          recoveries++;
        }
      }
    }
    recoveryScore = opportunities > 0 ? (recoveries / opportunities) * 100 : 0;

    // Section Performance Analytics
    const sectionPerformance = {};
    const sectionRanges = {
      english: { start: 1, end: 16 },
      advEnglish: { start: 17, end: 28 },
      businessstudies: { start: 29, end: 44 },
      accounting: { start: 45, end: 60 },
      economics: { start: 61, end: 76 }
    };

    Object.entries(sectionRanges).forEach(([sectionKey, range]) => {
      const sectionResponses = Object.entries(responses).filter(([qKey]) => {
        const qNum = parseInt(qKey.replace('q', ''));
        return qNum >= range.start && qNum <= range.end;
      });

      const sectionCorrect = sectionResponses.filter(([, r]) => r.status === 'correct').length;
      const sectionWrong = sectionResponses.filter(([, r]) => r.status === 'wrong').length;
      const sectionSkipped = sectionResponses.filter(([, r]) => r.status === 'skipped').length;
      const sectionAttempted = sectionCorrect + sectionWrong;
      const sectionTotal = range.end - range.start + 1;
      const sectionUnattempted = sectionTotal - sectionAttempted;

      if (sectionAttempted > 0 || sections[sectionKey]) {
        sectionPerformance[sectionKey] = {
          accuracy: sectionAttempted > 0 ? (sectionCorrect / sectionAttempted) * 100 : 0,
          attemptRate: (sectionAttempted / sectionTotal) * 100,
          attempted: sectionAttempted,
          unattempted: sectionUnattempted,
          efficiency: sectionAttempted > 0 ? (sectionCorrect / sectionTotal) * 100 : 0
        };
      }
    });

    return {
      skipStrategy: parseFloat(skipStrategy.toFixed(2)),
      questionChoiceStrategy: parseFloat(questionChoiceStrategy.toFixed(2)),
      recoveryScore: parseFloat(recoveryScore.toFixed(2)),
      sectionPerformance
    };
  }

  /**
   * Process a single FBS mock Excel file
   */
  processFBSMock(filename) {
    console.log(`📊 Processing: ${filename}`);

    try {
      const filePath = path.join(this.resultsDir, filename);
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets['Sheet1'];

      if (!worksheet) {
        throw new Error('Sheet1 not found');
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      const headers = jsonData[0];
      const dataRows = jsonData.slice(1).filter(row => row[0]); // Filter empty rows

      // Extract test name (e.g., "DU FBS Mock 1" -> "DU FBS Mock 1")
      const testName = filename.replace('.xlsx', '');

      // Process Sheet2 for top questions
      const topQuestions = this.processSheet2TopQuestions(workbook, testName);

      // Process Sheet3 for individual responses
      const allResponses = this.processSheet3Responses(workbook, testName);

      // Process each student
      const results = {};
      const allScores = [];

      dataRows.forEach((row, index) => {
        try {
          const studentResult = this.processStudent(row, headers, allResponses);
          if (studentResult) {
            results[studentResult.studentId] = studentResult;
            allScores.push(studentResult.totalMarks);
          }
        } catch (error) {
          this.warnings.push(`Row ${index + 2} in ${testName}: ${error.message}`);
        }
      });

      // Calculate class statistics
      const classStats = this.calculateClassStats(Object.values(results), allScores);

      // Calculate percentiles
      Object.values(results).forEach(student => {
        student.percentile = this.calculatePercentile(student.totalMarks, allScores);
      });

      // Store mock test data
      this.fbsMocks[testName] = {
        testName,
        testType: 'fbs-mock',
        totalStudents: Object.keys(results).length,
        results,
        classStats,
        topQuestions,
        metadata: {
          processedAt: new Date().toISOString(),
          sourceFile: filename
        }
      };

      console.log(`   ✅ Processed ${Object.keys(results).length} students`);
      console.log(`   📊 Average: ${classStats.average.toFixed(2)}, Highest: ${classStats.highest}`);
      console.log(`   📈 Extracted top questions and individual responses\n`);

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
      this.errors.push(`${filename}: ${error.message}`);
    }
  }

  /**
   * Process a single student's data
   */
  processStudent(row, headers, allResponses = {}) {
    const getColValue = (name) => {
      const index = headers.findIndex(h =>
        String(h).trim().toLowerCase() === name.toLowerCase() ||
        String(h).trim().toLowerCase().replace(/\s+/g, '') === name.replace(/\s+/g, '').toLowerCase()
      );
      return index !== -1 ? row[index] : null;
    };

    const studentId = String(getColValue('ID') || '').trim();
    const studentName = String(getColValue('Name') || '').trim();

    if (!studentId || !studentName) {
      return null;
    }

    // MCQ Sections
    const sections = {
      english: {
        correct: Number(getColValue('English Correct')) || 0,
        wrong: Number(getColValue('English Wrong')) || 0,
        marks: Number(getColValue('English Marks')) || 0,
        percentage: Number(getColValue('English Percentage')) || 0,
        totalQuestions: 16,
        attempted: true
      },
      advEnglish: {
        correct: Number(getColValue('Adv English Correct')) || 0,
        wrong: Number(getColValue('Adv English Wrong')) || 0,
        marks: Number(getColValue('Adv English Marks')) || 0,
        percentage: Number(getColValue('Adv English Percentage')) || 0,
        totalQuestions: 12,
        attempted: true
      }
    };

    // Optional MCQ sections (Business Studies, Accounting, Economics)
    const optionalMCQ = ['Business Studies', 'Accounting', 'Economics'];
    optionalMCQ.forEach(subject => {
      const correct = Number(getColValue(`${subject} Correct`)) || 0;
      const wrong = Number(getColValue(`${subject} Wrong`)) || 0;
      const marks = Number(getColValue(`${subject} Marks`)) || 0;
      const percentage = Number(getColValue(`${subject} Percentage`)) || 0;

      // Only include if attempted (marks > 0 or correct > 0)
      if (marks > 0 || correct > 0) {
        const key = subject.toLowerCase().replace(/\s+/g, '');
        sections[key] = {
          correct,
          wrong,
          marks,
          percentage,
          totalQuestions: 16,
          attempted: true
        };
      }
    });

    // Written Sections
    const written = {
      essay: {
        marks: Number(getColValue('Essay') || getColValue('Essay ')) || 0,
        outOf: 10,
        attempted: true
      },
      errorDetection: {
        marks: Number(getColValue('Error Detection')) || 0,
        outOf: 10,
        attempted: true
      }
    };

    // Optional Written sections (matching MCQ subjects)
    const optionalWritten = [
      { name: 'Business Studies Written', key: 'businessstudieswritten' },
      { name: 'Accounting Written', key: 'accountingwritten' },
      { name: 'Economics Written', key: 'economicswritten' }
    ];

    optionalWritten.forEach(({ name, key }) => {
      const marks = Number(getColValue(name)) || 0;
      // Only include if attempted (marks > 0)
      if (marks > 0) {
        written[key] = {
          marks,
          outOf: 10,
          attempted: true
        };
      }
    });

    // Totals
    const totalMCQ = Number(getColValue('Total Marks in MCQ')) || 0;
    const mcqRank = Number(getColValue('Rank in MCQ')) || 0;
    const totalMarks = Number(getColValue('Total Marks')) || 0;
    const rank = Number(getColValue('Rank')) || 0;

    // Calculate total written marks
    let totalWritten = 0;
    Object.values(written).forEach(w => {
      if (w.attempted) totalWritten += w.marks;
    });

    // FBS Passing Criteria
    const englishMCQMarks = sections.english.marks;
    const passEnglish = englishMCQMarks >= 5;
    const passMCQ = totalMCQ >= 24;
    const passTotal = totalMarks >= 40;
    const passedAll = passEnglish && passMCQ && passTotal;

    // Calculate analytics for compatibility with results page
    let totalCorrect = 0;
    let totalWrong = 0;
    Object.values(sections).forEach(section => {
      totalCorrect += section.correct || 0;
      totalWrong += section.wrong || 0;
    });
    const totalAttempted = totalCorrect + totalWrong;
    const accuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;

    // Get individual responses and calculate advanced analytics
    const studentResponses = allResponses[studentId] || {};
    const advancedAnalytics = this.calculateAdvancedAnalytics(studentResponses, sections);

    return {
      studentId,
      studentName,
      sections,
      written,
      totalMCQ,
      totalWritten,
      totalMarks,
      rank,
      mcqRank,
      passingCriteria: {
        englishMCQ: {
          required: 5,
          achieved: englishMCQMarks,
          passed: passEnglish
        },
        totalMCQ: {
          required: 24,
          achieved: totalMCQ,
          passed: passMCQ
        },
        total: {
          required: 40,
          achieved: totalMarks,
          passed: passTotal
        }
      },
      passedAll,
      percentile: 0, // Will be calculated later
      analytics: {
        accuracy: parseFloat(accuracy.toFixed(2)),
        totalCorrect,
        totalWrong,
        totalAttempted,
        ...advancedAnalytics
      },
      responses: studentResponses
    };
  }

  /**
   * Calculate class statistics
   */
  calculateClassStats(students, allScores) {
    if (students.length === 0) {
      return {
        average: 0,
        median: 0,
        highest: 0,
        lowest: 0,
        totalStudents: 0
      };
    }

    const sorted = [...allScores].sort((a, b) => b - a);

    return {
      average: allScores.reduce((sum, score) => sum + score, 0) / allScores.length,
      median: sorted[Math.floor(sorted.length / 2)],
      highest: sorted[0],
      lowest: sorted[sorted.length - 1],
      totalStudents: students.length,
      passCount: students.filter(s => s.passedAll).length,
      failCount: students.filter(s => !s.passedAll).length
    };
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(score, allScores) {
    const sorted = [...allScores].sort((a, b) => a - b);
    const belowCount = sorted.filter(s => s < score).length;
    return Math.round((belowCount / sorted.length) * 100);
  }

  /**
   * Save FBS mocks to JSON
   */
  saveFBSMocks() {
    const outputPath = path.join(this.outputDir, 'fbs-mock-tests.json');
    const data = {
      tests: this.fbsMocks,
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalMocks: Object.keys(this.fbsMocks).length,
        generatedBy: 'FBS Mock Processor'
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`✅ Saved to: ${outputPath}`);

    // Also update students.json with FBS students
    this.updateStudentsJson();
  }

  /**
   * Update students.json with FBS student data
   */
  updateStudentsJson() {
    const studentsPath = path.join(this.outputDir, 'students.json');

    // Load existing students.json
    let studentsData = { students: {}, metadata: {} };
    if (fs.existsSync(studentsPath)) {
      studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf-8'));
    }

    // Collect all unique FBS students from all mocks
    const fbsStudents = {};
    Object.values(this.fbsMocks).forEach(mock => {
      Object.values(mock.results).forEach(student => {
        if (!fbsStudents[student.studentId]) {
          fbsStudents[student.studentId] = {
            id: student.studentId,
            name: student.studentName,
            email: '' // Email will be synced from database later
          };
        }
      });
    });

    // Merge FBS students into existing students data
    let addedCount = 0;
    Object.entries(fbsStudents).forEach(([id, student]) => {
      if (!studentsData.students[id]) {
        studentsData.students[id] = student;
        addedCount++;
      }
    });

    // Update metadata
    studentsData.metadata = {
      totalStudents: Object.keys(studentsData.students).length,
      lastUpdated: new Date().toISOString()
    };

    // Save updated students.json
    fs.writeFileSync(studentsPath, JSON.stringify(studentsData, null, 2));

    if (addedCount > 0) {
      console.log(`✅ Added ${addedCount} FBS students to students.json`);
    }
  }

  /**
   * Print processing summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully processed: ${Object.keys(this.fbsMocks).length} mocks`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(w => console.log(`   - ${w}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(e => console.log(`   - ${e}`));
    }

    console.log('\n✨ Done!\n');
  }
}

// Run if called directly
if (require.main === module) {
  const processor = new FBSMockProcessor();
  processor.run()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = FBSMockProcessor;
