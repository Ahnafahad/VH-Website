const fs = require('fs');

const mock = JSON.parse(fs.readFileSync('public/data/mock-tests.json', 'utf8'));

console.log('\n=== IBA MOCK TESTS STRUCTURE CHECK ===\n');

console.log('Available tests:', Object.keys(mock.tests));

const testNames = Object.keys(mock.tests);
const mock1 = mock.tests[testNames[0]];

console.log('\n1. Mock 1 Basic Info:');
console.log('   Test Name:', mock1.testName);
console.log('   Test Type:', mock1.testType);
console.log('   Sections:', mock1.sections);
console.log('   Total Students:', Object.keys(mock1.results).length);

console.log('\n2. Class Stats:');
console.log('   Pass Count:', mock1.classStats?.passedStudents);
console.log('   Fail Count:', mock1.classStats?.failedStudents);
console.log('   Section Thresholds:', JSON.stringify(mock1.classStats?.sectionThresholds));
console.log('   Thresholds Adjusted:', mock1.classStats?.thresholdsAdjusted);

console.log('\n3. First Student Sample:');
const firstStudent = Object.values(mock1.results)[0];
console.log('   Student ID:', firstStudent.studentId);
console.log('   Student Name:', firstStudent.studentName);
console.log('   Total Marks:', firstStudent.totalMarks);
console.log('   Essay Marks:', firstStudent.essayMarks);
console.log('   MCQ Marks:', firstStudent.mcqMarks);
console.log('   Rank:', firstStudent.rank);
console.log('   Rank Status:', firstStudent.rankStatus);
console.log('   Passed All:', firstStudent.passedAll);
console.log('   Failed Sections:', firstStudent.failedSections);

console.log('\n4. Section Details (Section 1):');
if (firstStudent.sections && firstStudent.sections['1']) {
  console.log('   Correct:', firstStudent.sections['1'].correct);
  console.log('   Wrong:', firstStudent.sections['1'].wrong);
  console.log('   Marks:', firstStudent.sections['1'].marks);
  console.log('   Threshold:', firstStudent.sections['1'].threshold);
  console.log('   Passed:', firstStudent.sections['1'].passed);
} else {
  console.log('   ❌ No sections data');
}

console.log('\n5. Essays:');
if (firstStudent.essays) {
  console.log('   Essays found:', Object.keys(firstStudent.essays));
  Object.entries(firstStudent.essays).forEach(([key, essay]) => {
    console.log(`   ${key}:`, essay);
  });
} else {
  console.log('   ❌ No essays data');
}

console.log('\n✨ Done!\n');
