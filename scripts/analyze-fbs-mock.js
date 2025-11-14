const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'Results', 'DU FBS Mocks', 'DU FBS Mock 1.xlsx');
console.log('📊 ANALYZING DU FBS MOCK 1');
console.log('==========================\n');

const workbook = XLSX.readFile(filePath);
console.log(`📋 Sheets: ${workbook.SheetNames.join(', ')}\n`);

const worksheet = workbook.Sheets['Sheet1'];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

const headers = jsonData[0];
const dataRows = jsonData.slice(1).filter(row => row[0]); // Filter out empty rows

console.log(`📏 Total columns: ${headers.length}`);
console.log(`📏 Total students: ${dataRows.length}\n`);

console.log('📋 ALL COLUMN HEADERS:');
console.log('======================');
headers.forEach((header, index) => {
  console.log(`${String(index).padStart(3, ' ')}. "${header}"`);
});

console.log('\n📊 SAMPLE STUDENT DATA (First student):');
console.log('========================================');
const sampleRow = dataRows[0];
headers.forEach((header, index) => {
  const value = sampleRow[index];
  if (value !== '' && value !== undefined && value !== null) {
    console.log(`  ${header}: ${value}`);
  }
});

console.log('\n🎯 SECTION ANALYSIS:');
console.log('====================');

// MCQ Sections
const mcqSections = [
  'English',
  'Adv English',
  'Business Studies',
  'Accounting',
  'Economics'
];

console.log('\n📝 MCQ Sections:');
mcqSections.forEach(section => {
  const correctCol = headers.findIndex(h => h === `${section} Correct`);
  const wrongCol = headers.findIndex(h => h === `${section} Wrong` || h === `${section}  Wrong`);
  const marksCol = headers.findIndex(h => h === `${section} Marks` || h === `${section}  Marks`);
  const pctCol = headers.findIndex(h => h === `${section} Percentage` || h === `${section}  Percentage`);

  console.log(`\n  ${section}:`);
  console.log(`    Correct: Col ${correctCol} "${headers[correctCol]}"`);
  console.log(`    Wrong: Col ${wrongCol} "${headers[wrongCol]}"`);
  console.log(`    Marks: Col ${marksCol} "${headers[marksCol]}"`);
  console.log(`    Percentage: Col ${pctCol} "${headers[pctCol]}"`);
  console.log(`    Sample: C=${sampleRow[correctCol]}, W=${sampleRow[wrongCol]}, M=${sampleRow[marksCol]}`);
});

// Written Sections
console.log('\n✍️  Written Sections:');
const writtenSections = [
  'Essay',
  'Error Detection',
  'Business Studies Written',
  'Accounting Written',
  'Economics Written'
];

writtenSections.forEach(section => {
  const col = headers.findIndex(h => h.includes(section) || h.trim() === section);
  if (col !== -1) {
    console.log(`  ${section}: Col ${col} "${headers[col]}" = ${sampleRow[col]}`);
  }
});

// Total columns
console.log('\n📊 Total & Rank Columns:');
const totalMCQCol = headers.findIndex(h => h === 'Total Marks in MCQ');
const totalMarksCol = headers.findIndex(h => h === 'Total Marks');
const rankMCQCol = headers.findIndex(h => h === 'Rank in MCQ');
const rankCol = headers.findIndex(h => h === 'Rank');

console.log(`  Total Marks in MCQ: Col ${totalMCQCol} = ${sampleRow[totalMCQCol]}`);
console.log(`  Rank in MCQ: Col ${rankMCQCol} = ${sampleRow[rankMCQCol]}`);
console.log(`  Total Marks: Col ${totalMarksCol} = ${sampleRow[totalMarksCol]}`);
console.log(`  Rank: Col ${rankCol} = ${sampleRow[rankCol]}`);

console.log('\n✅ Analysis complete!');
