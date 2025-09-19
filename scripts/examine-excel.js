const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function examineExcelFile(filePath) {
  console.log(`\n=== EXAMINING: ${path.basename(filePath)} ===`);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }

  try {
    const workbook = XLSX.readFile(filePath);
    console.log(`✅ File loaded successfully`);
    console.log(`📊 Sheet Names: ${workbook.SheetNames.join(', ')}`);

    workbook.SheetNames.forEach((sheetName, index) => {
      console.log(`\n--- Sheet ${index + 1}: "${sheetName}" ---`);
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        console.log(`📋 Columns: ${jsonData[0].join(' | ')}`);
        console.log(`📏 Total Rows: ${jsonData.length}`);
        console.log(`📝 Sample Data (first 3 rows):`);

        // Show first 3 rows
        jsonData.slice(0, Math.min(3, jsonData.length)).forEach((row, i) => {
          console.log(`   Row ${i + 1}: ${row.join(' | ')}`);
        });
      } else {
        console.log(`❌ Sheet is empty`);
      }
    });

  } catch (error) {
    console.log(`❌ Error reading file: ${error.message}`);
  }
}

// Examine all three Excel files
const resultsDir = path.join(process.cwd(), 'Results');
const files = [
  'Simple Test Data.xlsx',
  'Mathematics CT 2.xlsx',
  'template.xlsx'
];

console.log('🔍 EXCEL FILES EXAMINATION REPORT');
console.log('================================');

files.forEach(filename => {
  const filePath = path.join(resultsDir, filename);
  examineExcelFile(filePath);
});

console.log('\n✅ Examination complete!');