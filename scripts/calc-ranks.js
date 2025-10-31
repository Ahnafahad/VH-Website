const XLSX = require('xlsx');

const wb = XLSX.readFile('Sample Mock/OMR_Results IBA Mock 4.xlsx');
const ws1 = wb.Sheets['Sheet1'];
const ws3 = wb.Sheets['Sheet3'];

const data = XLSX.utils.sheet_to_json(ws1, {header: 1, defval: ''});
const responses = XLSX.utils.sheet_to_json(ws3, {header: 1, defval: ''});

// Calculate scores for all students
const students = [];
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  if (row[0] && (row[2] || row[6] || row[10])) {
    const s1Correct = row[2] || 0;
    const s2Correct = row[6] || 0;
    const s3Correct = row[10] || 0;
    const totalCorrect = Number(s1Correct) + Number(s2Correct) + Number(s3Correct);

    students.push({
      id: row[0],
      name: row[1],
      section1: {correct: s1Correct, wrong: row[3]},
      section2: {correct: s2Correct, wrong: row[7]},
      section3: {correct: s3Correct, wrong: row[10] || row[11]}, // Fixed: should be row[10]
      totalCorrect: totalCorrect
    });
  }
}

// Sort by total correct (descending)
students.sort((a, b) => b.totalCorrect - a.totalCorrect);

// Assign ranks
students.forEach((student, index) => {
  student.rank = index + 1;
});

console.log('Top 10 Students (with ranks):');
students.slice(0, 10).forEach(s => {
  console.log(`Rank ${s.rank}: ${s.name} (ID: ${s.id}) - Total Correct: ${s.totalCorrect}`);
  console.log(`  Section 1: ${s.section1.correct} correct, ${s.section1.wrong} wrong`);
  console.log(`  Section 2: ${s.section2.correct} correct, ${s.section2.wrong} wrong`);
  console.log(`  Section 3: ${s.section3.correct} correct, ${s.section3.wrong} wrong`);
});

console.log('\n\n=== RANK 3 STUDENT FULL DATA ===');
const rank3 = students[2]; // Index 2 = Rank 3
console.log(JSON.stringify(rank3, null, 2));

// Get detailed responses for rank 3 student
console.log('\n\n=== DETAILED RESPONSES FOR RANK 3 ===');
const responseRow = responses.find(r => r[0] == rank3.id);
if (responseRow) {
  console.log('Question responses:');
  for (let i = 1; i < Math.min(responseRow.length, 20); i++) {
    if (responseRow[i]) {
      console.log(`  Q${i}: ${responseRow[i]}`);
    }
  }
}
