#!/usr/bin/env node

/**
 * BUP Mock Test Processor
 * Processes BUP Mock Excel files and generates JSON for results display
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class BUPMockProcessor {
  constructor() {
    this.resultsDir = path.join(process.cwd(), 'Results', 'BUP Mock');
    this.outputDir = path.join(process.cwd(), 'public', 'data');
    this.bupMocks = {};
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Main processing function
   */
  async run() {
    console.log('🎓 BUP Mock Test Processor');
    console.log('==============================\n');

    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      // Check if BUP Mock directory exists
      if (!fs.existsSync(this.resultsDir)) {
        console.log('⚠️  BUP Mock directory not found. Skipping BUP Mock processing.');
        return { success: true };
      }

      // Get all Excel files in BUP Mock folder
      const files = fs.readdirSync(this.resultsDir)
        .filter(file => file.endsWith('.xlsx') && file.includes('Mock'));

      console.log(`📁 Found ${files.length} BUP mock files\n`);

      // Process each mock file
      for (const file of files) {
        await this.processBUPMock(file);
      }

      // Save to JSON
      this.saveBUPMocks();

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

      // Section mappings for BUP (3 sections)
      const sections = [
        { name: 'Section1', prefix: '1', totalQuestions: 25 },
        { name: 'Section2', prefix: '2', totalQuestions: 40 },
        { name: 'Section3', prefix: '3', totalQuestions: 10 }
      ];

      sections.forEach(section => {
        const sectionData = {
          mostCorrect: [],
          mostWrong: [],
          mostSkipped: []
        };

        // Find columns for this section
        const correctColPrefix = `${section.prefix} Top Ten Questions right`;
        const wrongColPrefix = `${section.prefix} Top Ten Questions Wrong`;
        const skippedColPrefix = `${section.prefix} Top Ten Questions Skipped`;

        // Extract top 10 for each category
        for (let i = 1; i < data.length && i <= 10; i++) {
          const row = data[i];

          // Most Correct
          const correctIdx = data[0].findIndex(h => String(h).includes(correctColPrefix));
          let correctCountIdx = -1;
          if (correctIdx !== -1) {
            for (let j = correctIdx + 1; j < Math.min(correctIdx + 4, data[0].length); j++) {
              if (String(data[0][j]).toLowerCase().includes('right') ||
                  String(data[0][j]).toLowerCase().includes('count')) {
                correctCountIdx = j;
                break;
              }
            }
          }
          if (correctIdx !== -1 && row[correctIdx]) {
            const match = String(row[correctIdx]).match(/Section\d+-Q(\d+)/);
            if (match) {
              const qNum = parseInt(match[1]);
              sectionData.mostCorrect.push({
                questionNumber: qNum,
                count: correctCountIdx !== -1 ? (row[correctCountIdx] || 0) : 0
              });
            }
          }

          // Most Wrong
          const wrongIdx = data[0].findIndex(h => String(h).includes(wrongColPrefix));
          let wrongCountIdx = -1;
          if (wrongIdx !== -1) {
            for (let j = wrongIdx + 1; j < Math.min(wrongIdx + 4, data[0].length); j++) {
              if (String(data[0][j]).toLowerCase().includes('wrong') ||
                  String(data[0][j]).toLowerCase().includes('count')) {
                wrongCountIdx = j;
                break;
              }
            }
          }
          if (wrongIdx !== -1 && row[wrongIdx]) {
            const match = String(row[wrongIdx]).match(/Section\d+-Q(\d+)/);
            if (match) {
              const qNum = parseInt(match[1]);
              sectionData.mostWrong.push({
                questionNumber: qNum,
                count: wrongCountIdx !== -1 ? (row[wrongCountIdx] || 0) : 0
              });
            }
          }

          // Most Skipped
          const skippedIdx = data[0].findIndex(h => String(h).includes(skippedColPrefix));
          let skippedCountIdx = -1;
          if (skippedIdx !== -1) {
            for (let j = skippedIdx + 1; j < Math.min(skippedIdx + 4, data[0].length); j++) {
              if (String(data[0][j]).toLowerCase().includes('skip') ||
                  String(data[0][j]).toLowerCase().includes('count')) {
                skippedCountIdx = j;
                break;
              }
            }
          }
          if (skippedIdx !== -1 && row[skippedIdx]) {
            const match = String(row[skippedIdx]).match(/Section\d+-Q(\d+)/);
            if (match) {
              const qNum = parseInt(match[1]);
              sectionData.mostSkipped.push({
                questionNumber: qNum,
                count: skippedCountIdx !== -1 ? (row[skippedCountIdx] || 0) : 0
              });
            }
          }
        }

        topQuestions[section.name.toLowerCase()] = sectionData;
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

        // Extract responses for all sections
        headers.forEach((header, idx) => {
          const match = String(header).match(/Section(\d+)-Q(\d+)/);
          if (match) {
            const sectionNum = match[1];
            const qNum = match[2];
            const qKey = `section${sectionNum}_q${qNum}`;
            const response = String(row[idx] || '').trim();

            if (response && response !== 'NAN') {
              // Parse format: "A (C)" -> {answer: "A", status: "correct"}
              const answerMatch = response.match(/^([A-D])\s*\(([CW])\)$/i);
              if (answerMatch) {
                studentResponses[qKey] = {
                  answer: answerMatch[1].toUpperCase(),
                  status: answerMatch[2].toUpperCase() === 'C' ? 'correct' : 'wrong'
                };
              }
            } else {
              // Question was skipped
              studentResponses[qKey] = {
                answer: null,
                status: 'skipped'
              };
            }
          }
        });

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
      const numA = parseInt(a.match(/\d+$/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+$/)?.[0] || '0');
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
    const sectionKeys = ['section1', 'section2', 'section3'];

    sectionKeys.forEach(sectionKey => {
      const sectionResponses = Object.entries(responses).filter(([qKey]) =>
        qKey.startsWith(sectionKey)
      );

      const sectionCorrect = sectionResponses.filter(([, r]) => r.status === 'correct').length;
      const sectionWrong = sectionResponses.filter(([, r]) => r.status === 'wrong').length;
      const sectionSkipped = sectionResponses.filter(([, r]) => r.status === 'skipped').length;
      const sectionAttempted = sectionCorrect + sectionWrong;
      const sectionTotal = sectionKey === 'section1' ? 25 : sectionKey === 'section2' ? 40 : 10;
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
   * Process a single BUP mock Excel file
   */
  processBUPMock(filename) {
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
      const dataRows = jsonData.slice(1).filter(row => row[0] && row[1]); // Filter empty rows

      // Extract test name from filename
      const testName = filename.replace('.xlsx', '').replace(/_/g, ' ');

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

      // Calculate ranks based on totalMarks (highest score = rank 1)
      const sortedByTotal = Object.values(results).sort((a, b) => b.totalMarks - a.totalMarks);
      sortedByTotal.forEach((student, index) => {
        student.rank = index + 1;
      });

      // Calculate MCQ ranks based on totalMCQ
      const sortedByMCQ = Object.values(results).sort((a, b) => b.totalMCQ - a.totalMCQ);
      sortedByMCQ.forEach((student, index) => {
        student.mcqRank = index + 1;
      });

      // Calculate percentiles
      Object.values(results).forEach(student => {
        student.percentile = this.calculatePercentile(student.totalMarks, allScores);
      });

      // Store mock test data
      this.bupMocks[testName] = {
        testName,
        testType: 'bup-mock',
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

    // MCQ Sections (3 sections)
    // Calculate marks from correct answers (assuming 1 mark per correct answer)
    const section1Correct = Number(getColValue('1 Correct')) || 0;
    const section1Wrong = Number(getColValue('1 Wrong')) || 0;
    const section1Marks = Number(getColValue('1 Marks')) || section1Correct; // 1 mark per correct

    const section2Correct = Number(getColValue('2 Correct')) || 0;
    const section2Wrong = Number(getColValue('2 Wrong')) || 0;
    const section2Marks = Number(getColValue('2 Marks')) || section2Correct; // 1 mark per correct

    const section3Correct = Number(getColValue('3 Correct')) || 0;
    const section3Wrong = Number(getColValue('3 Wrong')) || 0;
    const section3Marks = Number(getColValue('3 Marks')) || section3Correct; // 1 mark per correct

    const sections = {
      section1: {
        correct: section1Correct,
        wrong: section1Wrong,
        marks: section1Marks,
        percentage: Number(getColValue('1 Percentage')) || (section1Marks / 25 * 100),
        totalQuestions: 25,
        attempted: true
      },
      section2: {
        correct: section2Correct,
        wrong: section2Wrong,
        marks: section2Marks,
        percentage: Number(getColValue('2 Percentage')) || (section2Marks / 40 * 100),
        totalQuestions: 40,
        attempted: true
      },
      section3: {
        correct: section3Correct,
        wrong: section3Wrong,
        marks: section3Marks,
        percentage: Number(getColValue('3 Percentage')) || (section3Marks / 10 * 100),
        totalQuestions: 10,
        attempted: true
      }
    };

    // Written Sections (4 essays)
    const written = {
      essay1: {
        marks: Number(getColValue('Essay 1')) || 0,
        outOf: 10,
        attempted: true
      },
      essay2: {
        marks: Number(getColValue('Essay 2')) || 0,
        outOf: 10,
        attempted: true
      },
      essay3: {
        marks: Number(getColValue('Essay 3')) || 0,
        outOf: 10,
        attempted: true
      },
      essay4: {
        marks: Number(getColValue('Essay 4')) || 0,
        outOf: 10,
        attempted: true
      }
    };

    // Totals - Calculate from section data since Excel columns may be empty
    // Calculate totalMCQ from section marks
    let calculatedTotalMCQ = 0;
    Object.values(sections).forEach(section => {
      calculatedTotalMCQ += section.marks || 0;
    });

    const totalMCQ = Number(getColValue('Total Marks in MCQ')) || calculatedTotalMCQ;

    // Calculate total written marks
    let totalWritten = 0;
    Object.values(written).forEach(w => {
      if (w.attempted) totalWritten += w.marks;
    });

    // Calculate total marks from MCQ + Written
    const calculatedTotalMarks = totalMCQ + totalWritten;
    const totalMarks = Number(getColValue('Total Marks')) || calculatedTotalMarks;

    // Ranks will be calculated after all students are processed
    const mcqRank = 0; // Will be calculated later
    const rank = 0; // Will be calculated later

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
      totalStudents: students.length
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
   * Save BUP mocks to JSON
   */
  saveBUPMocks() {
    const outputPath = path.join(this.outputDir, 'bup-mock-tests.json');
    const data = {
      tests: this.bupMocks,
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalMocks: Object.keys(this.bupMocks).length,
        generatedBy: 'BUP Mock Processor'
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`✅ Saved to: ${outputPath}`);

    // Also update students.json with BUP students
    this.updateStudentsJson();
  }

  /**
   * Update students.json with BUP student data
   */
  updateStudentsJson() {
    const studentsPath = path.join(this.outputDir, 'students.json');

    // Load existing students.json
    let studentsData = { students: {}, metadata: {} };
    if (fs.existsSync(studentsPath)) {
      studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf-8'));
    }

    // Collect all unique BUP students from all mocks
    const bupStudents = {};
    Object.values(this.bupMocks).forEach(mock => {
      Object.values(mock.results).forEach(student => {
        if (!bupStudents[student.studentId]) {
          bupStudents[student.studentId] = {
            id: student.studentId,
            name: student.studentName,
            email: '' // Email will be synced from database later
          };
        }
      });
    });

    // Merge BUP students into existing students data
    let addedCount = 0;
    Object.entries(bupStudents).forEach(([id, student]) => {
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
      console.log(`✅ Added ${addedCount} BUP students to students.json`);
    }
  }

  /**
   * Print processing summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully processed: ${Object.keys(this.bupMocks).length} mocks`);
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
  const processor = new BUPMockProcessor();
  processor.run()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = BUPMockProcessor;
