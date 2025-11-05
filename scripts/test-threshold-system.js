/**
 * Test script for threshold calculation system
 * Run with: node scripts/test-threshold-system.js
 */

const { calculateThresholds, shouldApplyThresholds } = require('./threshold-calculator');

console.log('🧪 Testing Threshold Calculation System\n');

// Test 1: Basic threshold calculation with 10 students
console.log('=== Test 1: 10 Students (need 2 to pass) ===');
const test1Students = [
  {
    studentId: 'A', studentName: 'Student A',
    sections: {
      '1': { percentage: 45 },
      '2': { percentage: 50 },
      '3': { percentage: 48 }
    },
    essayMarks: 45, maxEssayMarks: 100
  },
  {
    studentId: 'B', studentName: 'Student B',
    sections: {
      '1': { percentage: 42 },
      '2': { percentage: 38 },
      '3': { percentage: 46 }
    },
    essayMarks: 42, maxEssayMarks: 100
  },
  {
    studentId: 'C', studentName: 'Student C',
    sections: {
      '1': { percentage: 40 },
      '2': { percentage: 36 },
      '3': { percentage: 44 }
    },
    essayMarks: 41, maxEssayMarks: 100
  },
  {
    studentId: 'D', studentName: 'Student D',
    sections: {
      '1': { percentage: 38 },
      '2': { percentage: 35 },
      '3': { percentage: 40 }
    },
    essayMarks: 38, maxEssayMarks: 100
  },
  {
    studentId: 'E', studentName: 'Student E',
    sections: {
      '1': { percentage: 36 },
      '2': { percentage: 42 },
      '3': { percentage: 38 }
    },
    essayMarks: 36, maxEssayMarks: 100
  },
  {
    studentId: 'F', studentName: 'Student F',
    sections: {
      '1': { percentage: 34 },
      '2': { percentage: 40 },
      '3': { percentage: 36 }
    },
    essayMarks: 34, maxEssayMarks: 100
  },
  {
    studentId: 'G', studentName: 'Student G',
    sections: {
      '1': { percentage: 30 },
      '2': { percentage: 32 },
      '3': { percentage: 35 }
    },
    essayMarks: 30, maxEssayMarks: 100
  },
  {
    studentId: 'H', studentName: 'Student H',
    sections: {
      '1': { percentage: 28 },
      '2': { percentage: 30 },
      '3': { percentage: 32 }
    },
    essayMarks: 28, maxEssayMarks: 100
  },
  {
    studentId: 'I', studentName: 'Student I',
    sections: {
      '1': { percentage: 25 },
      '2': { percentage: 28 },
      '3': { percentage: 30 }
    },
    essayMarks: 25, maxEssayMarks: 100
  },
  {
    studentId: 'J', studentName: 'Student J',
    sections: {
      '1': { percentage: 20 },
      '2': { percentage: 25 },
      '3': { percentage: 28 }
    },
    essayMarks: 20, maxEssayMarks: 100
  }
];

const result1 = calculateThresholds(test1Students, ['1', '2', '3'], true);
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
console.log('\n=== Test 3: 24 Students (need 5 to pass - 20% rule) ===');
const test3Students = [];
for (let i = 1; i <= 24; i++) {
  test3Students.push({
    studentId: `S${i}`,
    studentName: `Student ${i}`,
    sections: {
      '1': { percentage: Math.max(20, 60 - i * 1.5) },
      '2': { percentage: Math.max(15, 58 - i * 1.8) },
      '3': { percentage: Math.max(18, 62 - i * 1.6) }
    },
    essayMarks: Math.max(15, 55 - i * 1.5),
    maxEssayMarks: 100
  });
}

const result3 = calculateThresholds(test3Students, ['1', '2', '3'], true);
console.log('Thresholds:', result3.thresholds);
console.log('Adjusted:', result3.adjusted);
console.log('Pass count:', result3.passData.passCount, '/ 5 required');
console.log(`Passed: ${result3.passData.passCount}, Failed: ${result3.passData.failCount}`);

// Test 4: All students passing at 40% (no adjustment needed)
console.log('\n=== Test 4: All Pass at 40% (No Adjustment Needed) ===');
const test4Students = [];
for (let i = 1; i <= 10; i++) {
  test4Students.push({
    studentId: `H${i}`,
    studentName: `High Scorer ${i}`,
    sections: {
      '1': { percentage: 80 - i },
      '2': { percentage: 82 - i },
      '3': { percentage: 85 - i }
    },
    essayMarks: 78 - i,
    maxEssayMarks: 100
  });
}

const result4 = calculateThresholds(test4Students, ['1', '2', '3'], true);
console.log('Thresholds:', result4.thresholds);
console.log('Adjusted:', result4.adjusted);
console.log('Pass count:', result4.passData.passCount, '/ 2 required');
console.log('All thresholds should be 40%:', result4.adjusted ? '❌ FAIL' : '✅ PASS');

console.log('\n✅ All tests completed!');
