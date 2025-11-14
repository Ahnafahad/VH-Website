const fs = require('fs');

const mock = JSON.parse(fs.readFileSync('public/data/mock-tests.json', 'utf8'));
const students = JSON.parse(fs.readFileSync('public/data/students.json', 'utf8'));

console.log('\n=== ZUHAYR TEST RESULTS CHECK ===\n');

// Find Zuhayr in students
const zuhayr = Object.values(students.students).find(s =>
  s.email && s.email.toLowerCase().includes('zuhayr')
);

console.log('1. Zuhayr in students.json:');
console.log('   ID:', zuhayr.id);
console.log('   Name:', zuhayr.name);
console.log('   Email:', zuhayr.email);

// Check each mock test
console.log('\n2. Zuhayr\'s results in each mock:');
Object.entries(mock.tests).forEach(([testName, test]) => {
  const result = test.results[zuhayr.id];
  if (result) {
    console.log(`   ✅ ${testName}: ${result.totalMarks} marks, Rank #${result.rank}`);
  } else {
    console.log(`   ❌ ${testName}: No results found`);
  }
});

console.log('\n✨ Done!\n');
