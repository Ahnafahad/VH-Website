const data = require('../public/data/mock-tests.json');
const test = data.tests['IBA Mock\\Mock 1'];
const results = Object.values(test.results).filter(r => !r.isAbsent);

console.log('Mock 1 Analysis (12 active students):\n');
console.log('Section Thresholds:', test.classStats.sectionThresholds);
console.log('\nSection-by-section breakdown:');

const sections = ['1', '2', '3'];
sections.forEach(secId => {
  const threshold = test.classStats.sectionThresholds[secId];
  const passCount = results.filter(r => r.sections[secId].marks >= threshold).length;
  console.log(`Section ${secId}: Threshold = ${threshold} marks, ${passCount} students passed this section`);
});

console.log('\nOverall pass: Student must pass ALL sections');
console.log('Students who passed ALL sections:', test.classStats.passedStudents);
console.log('Students who failed at least one section:', test.classStats.failedStudents);

console.log('\nTop 5 students by total marks:');
results.sort((a, b) => b.totalMarks - a.totalMarks).slice(0, 5).forEach(r => {
  const sec1Pass = r.sections['1'].passed ? '✓' : '✗';
  const sec2Pass = r.sections['2'].passed ? '✓' : '✗';
  const sec3Pass = r.sections['3'].passed ? '✓' : '✗';
  console.log(`Total: ${r.totalMarks.toFixed(1)} | Sec1: ${r.sections['1'].marks.toFixed(1)} ${sec1Pass} | Sec2: ${r.sections['2'].marks.toFixed(1)} ${sec2Pass} | Sec3: ${r.sections['3'].marks.toFixed(1)} ${sec3Pass} | Overall: ${r.passedAll ? 'PASS' : 'FAIL'}`);
});
