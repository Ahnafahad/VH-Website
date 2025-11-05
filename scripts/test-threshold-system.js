/**
 * Test script for threshold calculation system
 * Run with: node scripts/test-threshold-system.js
 */

const { calculateThresholds, shouldApplyThresholds } = require('./threshold-calculator');

console.log('🧪 Testing Threshold Calculation System\n');

// Test 1: Basic threshold calculation with 10 students
// Assuming section totals: Section 1 = 50 marks, Section 2 = 40 marks, Section 3 = 45 marks
console.log('=== Test 1: 10 Students (need 2 to pass) ===');
const test1Students = [
  {
    studentId: 'A', studentName: 'Student A',
    sections: {
      '1': { marks: 22.5, percentage: 45 },  // 45% of 50 = 22.5
      '2': { marks: 20, percentage: 50 },    // 50% of 40 = 20
      '3': { marks: 21.6, percentage: 48 }   // 48% of 45 = 21.6
    },
    essayMarks: 45, maxEssayMarks: 100
  },
  {
    studentId: 'B', studentName: 'Student B',
    sections: {
      '1': { marks: 21, percentage: 42 },
      '2': { marks: 15.2, percentage: 38 },
      '3': { marks: 20.7, percentage: 46 }
    },
    essayMarks: 42, maxEssayMarks: 100
  },
  {
    studentId: 'C', studentName: 'Student C',
    sections: {
      '1': { marks: 20, percentage: 40 },
      '2': { marks: 14.4, percentage: 36 },
      '3': { marks: 19.8, percentage: 44 }
    },
    essayMarks: 41, maxEssayMarks: 100
  },
  {
    studentId: 'D', studentName: 'Student D',
    sections: {
      '1': { marks: 19, percentage: 38 },
      '2': { marks: 14, percentage: 35 },
      '3': { marks: 18, percentage: 40 }
    },
    essayMarks: 38, maxEssayMarks: 100
  },
  {
    studentId: 'E', studentName: 'Student E',
    sections: {
      '1': { marks: 18, percentage: 36 },
      '2': { marks: 16.8, percentage: 42 },
      '3': { marks: 17.1, percentage: 38 }
    },
    essayMarks: 36, maxEssayMarks: 100
  },
  {
    studentId: 'F', studentName: 'Student F',
    sections: {
      '1': { marks: 17, percentage: 34 },
      '2': { marks: 16, percentage: 40 },
      '3': { marks: 16.2, percentage: 36 }
    },
    essayMarks: 34, maxEssayMarks: 100
  },
  {
    studentId: 'G', studentName: 'Student G',
    sections: {
      '1': { marks: 15, percentage: 30 },
      '2': { marks: 12.8, percentage: 32 },
      '3': { marks: 15.75, percentage: 35 }
    },
    essayMarks: 30, maxEssayMarks: 100
  },
  {
    studentId: 'H', studentName: 'Student H',
    sections: {
      '1': { marks: 14, percentage: 28 },
      '2': { marks: 12, percentage: 30 },
      '3': { marks: 14.4, percentage: 32 }
    },
    essayMarks: 28, maxEssayMarks: 100
  },
  {
    studentId: 'I', studentName: 'Student I',
    sections: {
      '1': { marks: 12.5, percentage: 25 },
      '2': { marks: 11.2, percentage: 28 },
      '3': { marks: 13.5, percentage: 30 }
    },
    essayMarks: 25, maxEssayMarks: 100
  },
  {
    studentId: 'J', studentName: 'Student J',
    sections: {
      '1': { marks: 10, percentage: 20 },
      '2': { marks: 10, percentage: 25 },
      '3': { marks: 12.6, percentage: 28 }
    },
    essayMarks: 20, maxEssayMarks: 100
  }
];

const result1 = calculateThresholds(test1Students, ['1', '2', '3'], true, 'Test 1');
console.log('Thresholds:', result1.thresholds);
console.log('Adjusted:', result1.adjusted);
console.log('Pass count:', result1.passData.passCount, '/ 2 required');
console.log('Passed students:');
result1.passData.students.filter(s => s.passedAll).forEach(s => {
  console.log(`  - ${s.studentName} (Rank ${s.rank})`);
});
console.log('Failed students:');
result1.passData.students.filter(s => !s.passedAll).forEach(s => {
  console.log(`  - ${s.studentName} (Rank ${s.rank}, failed: ${s.failedSections.join(', ')})`);
});

// Test 2: Test name matching
console.log('\n=== Test 2: Test Name Matching ===');
const testNames = [
  'English Test 1',
  'Mathematics CT 2',
  'Analytical Reasoning Quiz',
  'DU FBS Admission Test',
  'General Knowledge Quiz'
];

testNames.forEach(name => {
  const shouldApply = shouldApplyThresholds(name);
  console.log(`"${name}": ${shouldApply ? '✅ Apply thresholds' : '❌ No thresholds'}`);
});

// Test 3: 24 students (need 5 to pass)
// Assuming section totals: Section 1 = 50 marks, Section 2 = 40 marks, Section 3 = 45 marks
console.log('\n=== Test 3: 24 Students (need 5 to pass - 20% rule) ===');
const test3Students = [];
for (let i = 1; i <= 24; i++) {
  const s1Pct = Math.max(20, 60 - i * 1.5);
  const s2Pct = Math.max(15, 58 - i * 1.8);
  const s3Pct = Math.max(18, 62 - i * 1.6);

  test3Students.push({
    studentId: `S${i}`,
    studentName: `Student ${i}`,
    sections: {
      '1': { marks: (s1Pct / 100) * 50, percentage: s1Pct },  // Convert % to marks
      '2': { marks: (s2Pct / 100) * 40, percentage: s2Pct },
      '3': { marks: (s3Pct / 100) * 45, percentage: s3Pct }
    },
    essayMarks: Math.max(15, 55 - i * 1.5),
    maxEssayMarks: 100
  });
}

const result3 = calculateThresholds(test3Students, ['1', '2', '3'], true, 'Test 3');
console.log('Thresholds:', result3.thresholds);
console.log('Adjusted:', result3.adjusted);
console.log('Pass count:', result3.passData.passCount, '/ 5 required');
console.log(`Passed: ${result3.passData.passCount}, Failed: ${result3.passData.failCount}`);

// Test 4: All students passing at 40% (no adjustment needed)
// Assuming section totals: Section 1 = 50 marks, Section 2 = 40 marks, Section 3 = 45 marks
console.log('\n=== Test 4: All Pass at 40% (No Adjustment Needed) ===');
const test4Students = [];
for (let i = 1; i <= 10; i++) {
  const s1Pct = 80 - i;
  const s2Pct = 82 - i;
  const s3Pct = 85 - i;

  test4Students.push({
    studentId: `H${i}`,
    studentName: `High Scorer ${i}`,
    sections: {
      '1': { marks: (s1Pct / 100) * 50, percentage: s1Pct },
      '2': { marks: (s2Pct / 100) * 40, percentage: s2Pct },
      '3': { marks: (s3Pct / 100) * 45, percentage: s3Pct }
    },
    essayMarks: 78 - i,
    maxEssayMarks: 100
  });
}

const result4 = calculateThresholds(test4Students, ['1', '2', '3'], true, 'Test 4');
console.log('Thresholds:', result4.thresholds);
console.log('Adjusted:', result4.adjusted);
console.log('Pass count:', result4.passData.passCount, '/ 2 required');
// Check if thresholds are at 40% in marks (Section 1: 20 marks, Section 2: 16 marks, Section 3: 18 marks)
// Use Math.abs for floating point comparison
const threshold40Check =
  Math.abs(result4.thresholds['1'] - 20) < 0.01 &&
  Math.abs(result4.thresholds['2'] - 16) < 0.01 &&
  Math.abs(result4.thresholds['3'] - 18) < 0.01;
console.log('All thresholds should be 40% (20, 16, 18 marks):', threshold40Check ? '✅ PASS' : '❌ FAIL');

console.log('\n✅ All tests completed!');
