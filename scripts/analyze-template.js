const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'Results', 'template.xlsx');
console.log('📊 DETAILED TEMPLATE.XLSX ANALYSIS');
console.log('==================================');

const workbook = XLSX.readFile(filePath);
console.log(`📋 Sheets: ${workbook.SheetNames.join(', ')}`);

workbook.SheetNames.forEach((sheetName, index) => {
  console.log(`\n${'-'.repeat(50)}`);
  console.log(`📋 SHEET ${index + 1}: "${sheetName}"`);
  console.log(`${'-'.repeat(50)}`);

  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData.length === 0) {
    console.log('❌ Empty sheet');
    return;
  }

  const headers = jsonData[0] || [];
  const dataRows = jsonData.slice(1);

  console.log(`📏 Dimensions: ${dataRows.length} rows × ${headers.length} columns`);
  console.log(`\n📋 ALL HEADERS:`);
  headers.forEach((header, index) => {
    const headerStr = String(header || '').trim();
    console.log(`   ${String(index + 1).padStart(2, ' ')}. "${headerStr}"`);
  });

  console.log(`\n📊 SAMPLE DATA (First 3 rows):`);
  dataRows.slice(0, 3).forEach((row, rowIndex) => {
    console.log(`   Row ${rowIndex + 1}:`);
    headers.forEach((header, colIndex) => {
      const value = row[colIndex];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        console.log(`     ${String(header || '').trim()}: "${value}"`);
      }
    });
    console.log('');
  });

  if (sheetName === 'Sheet1') {
    console.log(`\n🎯 TEMPLATE STRUCTURE ANALYSIS:`);

    // Identify sections
    const sectionColumns = headers.filter(h => {
      const headerStr = String(h || '');
      return headerStr.match(/\d+\s+(Correct|Wrong|Marks|Percentage)/i);
    });

    const sections = [...new Set(sectionColumns.map(h => {
      const match = String(h).match(/(\d+)\s+/);
      return match ? match[1] : null;
    }).filter(Boolean))];

    console.log(`   • Sections Found: ${sections.length} (${sections.join(', ')})`);
    console.log(`   • Section Columns: ${sectionColumns.length}`);

    // Essay columns
    const essayColumns = headers.filter(h => String(h || '').includes('Essay'));
    console.log(`   • Essay Columns: ${essayColumns.length} (${essayColumns.join(', ')})`);

    // Other key columns
    const keyColumns = ['ID', 'Name', 'Total Marks', 'Rank', 'Total Question'];
    keyColumns.forEach(key => {
      const found = headers.find(h => String(h || '').includes(key));
      console.log(`   • ${key}: ${found ? `"${found}"` : 'NOT FOUND'}`);
    });
  }
});

console.log('\n✅ Template analysis complete!');