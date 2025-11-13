const data = require('./public/data/mock-tests.json');
const students = Object.values(data.tests['Mock 1'].results);

const topByS1 = students.filter(s => s.sections['1'].marks >= 5.5);
const topByS2 = students.filter(s => s.sections['2'].marks >= 1);
const topByS3 = students.filter(s => s.sections['3'].marks >= 0.25);
const passedAll = students.filter(s => s.passedAll);

console.log('=== THRESHOLD ANALYSIS ===\n');
console.log('Target pass rate: 35% of 24 students = 9 students\n');

console.log('Students meeting Section 1 threshold (>= 5.5):', topByS1.length);
console.log('Students meeting Section 2 threshold (>= 1.0):', topByS2.length);
console.log('Students meeting Section 3 threshold (>= 0.25):', topByS3.length);
console.log('Students passing ALL sections:', passedAll.length);

console.log('\n=== Students who pass S1 threshold but fail overall ===');
students
  .filter(s => s.sections['1'].marks >= 5.5 && !s.passedAll)
  .forEach(s => {
    const failedSections = [];
    if (!s.sections['1'].passed) failedSections.push('S1');
    if (!s.sections['2'].passed) failedSections.push('S2');
    if (!s.sections['3'].passed) failedSections.push('S3');
    console.log(`  ${s.studentId} (${s.studentName}): S1=${s.sections['1'].marks}, S2=${s.sections['2'].marks}, S3=${s.sections['3'].marks}`);
    console.log(`    Failed: ${failedSections.join(', ')}`);
  });

console.log('\n=== Students who passed ALL sections ===');
passedAll.forEach((s, i) => {
  console.log(`${i+1}. ${s.studentId} (${s.studentName}): S1=${s.sections['1'].marks}, S2=${s.sections['2'].marks}, S3=${s.sections['3'].marks}`);
});
