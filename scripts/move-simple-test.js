const fs = require('fs');
const path = require('path');

// Read the data files
const fullTestsPath = path.join(__dirname, '../public/data/full-tests.json');
const simpleTestsPath = path.join(__dirname, '../public/data/simple-tests.json');

const fullTestsData = JSON.parse(fs.readFileSync(fullTestsPath, 'utf8'));
const simpleTestsData = JSON.parse(fs.readFileSync(simpleTestsPath, 'utf8'));

// Find and move "IBA\Simple Test Data"
const testToMove = 'IBA\\Simple Test Data';

if (fullTestsData.tests[testToMove]) {
  console.log(`Found test: ${testToMove}`);
  console.log('Moving to simple-tests.json...');

  // Copy to simple tests
  simpleTestsData.tests[testToMove] = fullTestsData.tests[testToMove];

  // Remove from full tests
  delete fullTestsData.tests[testToMove];

  // Write back to files
  fs.writeFileSync(fullTestsPath, JSON.stringify(fullTestsData, null, 2));
  fs.writeFileSync(simpleTestsPath, JSON.stringify(simpleTestsData, null, 2));

  console.log('✓ Successfully moved test to simple-tests.json');
  console.log(`Full tests now has ${Object.keys(fullTestsData.tests).length} tests`);
  console.log(`Simple tests now has ${Object.keys(simpleTestsData.tests).length} tests`);
} else {
  console.log('Test not found in full-tests.json');
}
