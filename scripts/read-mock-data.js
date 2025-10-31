const XLSX = require('xlsx');

const wb = XLSX.readFile('Sample Mock/OMR_Results IBA Mock 4.xlsx');
const ws = wb.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ''});

console.log('Headers:', data[0]);
console.log('\nThird student (row index 3 - Audrika Maisha Hosain):');
const student = data[3];
console.log(JSON.stringify(student, null, 2));

console.log('\n\nAll students with section scores:');
for (let i = 1; i < data.length && i <= 10; i++) {
  const row = data[i];
  if (row[0]) {
    console.log(`\nStudent ${i}:`);
    console.log(`  ID: ${row[0]}, Name: ${row[1]}`);
    console.log(`  Section 1: Correct=${row[2]}, Wrong=${row[3]}`);
    console.log(`  Section 2: Correct=${row[6]}, Wrong=${row[7]}`);
    console.log(`  Section 3: Correct=${row[10]}, Wrong=${row[11]}`);
  }
}
