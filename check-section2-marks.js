const data = require('./public/data/mock-tests.json');

const results = Object.values(data.tests['Mock 1'].results);
const section2Marks = results
  .map(r => r.sections?.['2']?.marks || 0)
  .sort((a, b) => b - a);

console.log('\n=== Section 2 Marks (sorted descending) ===');
section2Marks.forEach((m, i) => {
  console.log(`  #${i+1}: ${m} marks`);
});

const targetCount = Math.ceil(24 * 0.35);
console.log('\n=== Threshold Calculation ===');
console.log('Total students: 24');
console.log('Target: Top 35% =', targetCount, 'students');
console.log('9th student (index 8) mark:', section2Marks[8], 'marks');
console.log('Rounded down to 0.25:', Math.floor(section2Marks[8] / 0.25) * 0.25, 'marks');
console.log('\nExpected threshold:', Math.floor(section2Marks[8] / 0.25) * 0.25, 'marks');
console.log('Actual threshold in JSON:', data.tests['Mock 1'].classStats.sectionThresholds['2'], 'marks');
