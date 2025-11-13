const { calculateThresholds } = require('./scripts/threshold-calculator');
const mockData = require('./public/data/mock-tests.json');

const mock1Results = Object.values(mockData.tests['Mock 1'].results);
const sectionIds = ['1', '2', '3'];
const hasEssay = true;

console.log('\n=== Testing New Threshold Calculator ===\n');
console.log('Input: ', mock1Results.length, 'students');

const result = calculateThresholds(mock1Results, sectionIds, hasEssay, 'Mock 1');

console.log('\n=== Results ===');
console.log('Thresholds calculated:');
Object.entries(result.thresholds).forEach(([section, threshold]) => {
  console.log(`  ${section}: ${threshold.toFixed(2)} marks`);
});
console.log(`\nPassed: ${result.passData.passCount}, Failed: ${result.passData.failCount}`);
