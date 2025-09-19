const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function analyzeExcelFile(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 DETAILED ANALYSIS: ${filename}`);
  console.log(`${'='.repeat(60)}`);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }

  try {
    const workbook = XLSX.readFile(filePath);
    console.log(`📋 Total Sheets: ${workbook.SheetNames.length}`);
    console.log(`📄 Sheet Names: ${workbook.SheetNames.join(', ')}`);

    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      console.log(`\n${'-'.repeat(50)}`);
      console.log(`📋 SHEET ${sheetIndex + 1}: "${sheetName}"`);
      console.log(`${'-'.repeat(50)}`);

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) {
        console.log(`❌ Empty sheet`);
        return;
      }

      const headers = jsonData[0] || [];
      const dataRows = jsonData.slice(1);

      console.log(`📏 Dimensions: ${dataRows.length} rows × ${headers.length} columns`);
      console.log(`📋 Headers:`);
      headers.forEach((header, index) => {
        const headerStr = String(header || '').trim();
        console.log(`   ${String(index + 1).padStart(2, ' ')}. "${headerStr}" ${headerStr === '' ? '(EMPTY)' : ''}`);
      });

      // Analyze data patterns
      console.log(`\n📊 Data Analysis:`);

      // Sample data from different positions
      if (dataRows.length > 0) {
        console.log(`   First Data Row: ${dataRows[0].slice(0, 5).map(v => `"${v || ''}"`).join(' | ')}${headers.length > 5 ? '...' : ''}`);

        if (dataRows.length > 1) {
          console.log(`   Second Data Row: ${dataRows[1].slice(0, 5).map(v => `"${v || ''}"`).join(' | ')}${headers.length > 5 ? '...' : ''}`);
        }

        if (dataRows.length > 2) {
          const midIndex = Math.floor(dataRows.length / 2);
          console.log(`   Mid Data Row (${midIndex + 1}): ${dataRows[midIndex].slice(0, 5).map(v => `"${v || ''}"`).join(' | ')}${headers.length > 5 ? '...' : ''}`);
        }

        if (dataRows.length > 3) {
          const lastIndex = dataRows.length - 1;
          console.log(`   Last Data Row: ${dataRows[lastIndex].slice(0, 5).map(v => `"${v || ''}"`).join(' | ')}${headers.length > 5 ? '...' : ''}`);
        }
      }

      // Analyze column data types and patterns
      console.log(`\n🔍 Column Analysis:`);
      headers.forEach((header, colIndex) => {
        const headerStr = String(header || '').trim();
        if (headerStr === '') return;

        const columnData = dataRows.map(row => row[colIndex]).filter(val => val !== undefined && val !== null && val !== '');
        const uniqueValues = [...new Set(columnData)];
        const hasNumbers = columnData.some(val => !isNaN(val) && val !== '');
        const hasStrings = columnData.some(val => isNaN(val) && val !== '');

        console.log(`   "${headerStr}":`);
        console.log(`     • Data Count: ${columnData.length}/${dataRows.length} (${Math.round(columnData.length/dataRows.length*100)}% filled)`);
        console.log(`     • Data Type: ${hasNumbers && hasStrings ? 'Mixed' : hasNumbers ? 'Numeric' : 'Text'}`);
        console.log(`     • Unique Values: ${uniqueValues.length}`);

        if (uniqueValues.length <= 10 && uniqueValues.length > 0) {
          console.log(`     • Sample Values: ${uniqueValues.slice(0, 5).map(v => `"${v}"`).join(', ')}${uniqueValues.length > 5 ? '...' : ''}`);
        } else if (uniqueValues.length > 0) {
          console.log(`     • Sample Values: ${columnData.slice(0, 3).map(v => `"${v}"`).join(', ')}...`);
        }
      });

      // Special analysis for specific sheet types
      if (sheetName.toLowerCase().includes('student')) {
        console.log(`\n👥 STUDENT DATA ANALYSIS:`);
        analyzeStudentSheet(dataRows, headers);
      } else if (sheetName.toLowerCase().includes('sheet2') || sheetName.toLowerCase().includes('analytics')) {
        console.log(`\n📈 ANALYTICS SHEET ANALYSIS:`);
        analyzeAnalyticsSheet(dataRows, headers);
      } else if (sheetName.toLowerCase().includes('sheet3') || headers.some(h => String(h).includes('Section'))) {
        console.log(`\n🎯 RESPONSE SHEET ANALYSIS:`);
        analyzeResponseSheet(dataRows, headers);
      } else {
        console.log(`\n📝 TEST RESULTS ANALYSIS:`);
        analyzeTestSheet(dataRows, headers, sheetName);
      }
    });

  } catch (error) {
    console.log(`❌ Error analyzing file: ${error.message}`);
  }
}

function analyzeStudentSheet(dataRows, headers) {
  const studentCount = dataRows.filter(row => row[0] && String(row[0]).trim() !== '').length;
  console.log(`   • Total Students: ${studentCount}`);

  if (headers.length >= 3) {
    const sampleEmails = dataRows.slice(0, 3).map(row => row[2]).filter(email => email);
    console.log(`   • Email Pattern: ${sampleEmails[0] ? sampleEmails[0] : 'No emails found'}`);
  }
}

function analyzeAnalyticsSheet(dataRows, headers) {
  console.log(`   • Analytics Type: Question performance tracking`);
  console.log(`   • Sections: Analyzing question patterns...`);

  // Look for section patterns
  const sectionColumns = headers.filter(h => String(h).toLowerCase().includes('section') || /\d+/.test(String(h)));
  console.log(`   • Section Columns Found: ${sectionColumns.length}`);

  if (sectionColumns.length > 0) {
    console.log(`   • Sample Section Headers: ${sectionColumns.slice(0, 3).map(h => `"${h}"`).join(', ')}`);
  }
}

function analyzeResponseSheet(dataRows, headers) {
  const responsePattern = /Section\d+-Q\d+/i;
  const responseColumns = headers.filter(h => responsePattern.test(String(h)));

  console.log(`   • Response Columns: ${responseColumns.length}`);
  console.log(`   • Students with Responses: ${dataRows.filter(row => row[0] && String(row[0]).trim() !== '').length}`);

  if (responseColumns.length > 0) {
    console.log(`   • Question Range: ${responseColumns[0]} to ${responseColumns[responseColumns.length - 1]}`);

    // Analyze response patterns
    const sampleResponses = dataRows.slice(0, 3).map(row =>
      responseColumns.slice(0, 5).map(col => {
        const colIndex = headers.indexOf(col);
        return row[colIndex];
      }).filter(resp => resp && String(resp).trim() !== '')
    );

    if (sampleResponses.length > 0 && sampleResponses[0].length > 0) {
      console.log(`   • Response Format Examples: ${sampleResponses[0].slice(0, 3).map(r => `"${r}"`).join(', ')}`);
    }
  }
}

function analyzeTestSheet(dataRows, headers, sheetName) {
  console.log(`   • Test Name: ${sheetName}`);

  // Identify key columns
  const keyColumns = {
    studentId: findColumn(headers, ['Student ID', 'student_id', 'ID', 'Roll']),
    studentName: findColumn(headers, ['Student Name', 'student_name', 'Name']),
    correct: findColumn(headers, ['Correct', 's1_correct', '1 Correct']),
    wrong: findColumn(headers, ['Wrong', 's1_wrong', '1 Wrong']),
    score: findColumn(headers, ['Score', 'Total Marks', 'total_score', 'Overall']),
    rank: findColumn(headers, ['Rank', 'rank']),
  };

  console.log(`   • Key Columns Found:`);
  Object.entries(keyColumns).forEach(([key, index]) => {
    if (index !== -1) {
      console.log(`     • ${key}: Column ${index + 1} ("${headers[index]}")`);
    } else {
      console.log(`     • ${key}: NOT FOUND`);
    }
  });

  // Analyze score patterns
  if (keyColumns.score !== -1) {
    const scores = dataRows.map(row => row[keyColumns.score]).filter(s => !isNaN(s) && s !== '' && s !== null);
    if (scores.length > 0) {
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      console.log(`   • Score Range: ${minScore} to ${maxScore} (avg: ${avgScore.toFixed(2)})`);
    }
  }

  // Check for sections
  const sectionColumns = headers.filter(h => {
    const headerStr = String(h || '');
    return headerStr.includes('s1_') || headerStr.includes('s2_') ||
           headerStr.match(/\d+\s+(Correct|Wrong|Marks)/i);
  });

  if (sectionColumns.length > 0) {
    console.log(`   • Multi-Section Test: ${sectionColumns.length} section-related columns`);
    console.log(`   • Section Columns: ${sectionColumns.slice(0, 5).map(h => `"${h}"`).join(', ')}${sectionColumns.length > 5 ? '...' : ''}`);
  }

  // Check for essays
  const essayColumns = headers.filter(h => String(h || '').toLowerCase().includes('essay'));
  if (essayColumns.length > 0) {
    console.log(`   • Essays: ${essayColumns.length} essay columns found`);
    console.log(`   • Essay Columns: ${essayColumns.map(h => `"${h}"`).join(', ')}`);
  }
}

function findColumn(headers, patterns) {
  return headers.findIndex(header => {
    const headerStr = String(header || '').toLowerCase().trim();
    return patterns.some(pattern => {
      const patternStr = pattern.toLowerCase().trim();
      return headerStr === patternStr || headerStr.includes(patternStr) || patternStr.includes(headerStr);
    });
  });
}

// Analyze all three Excel files
const resultsDir = path.join(process.cwd(), 'Results');
const files = [
  'Simple Test Data.xlsx',
  'Mathematics CT 2.xlsx',
  'template.xlsx'
];

console.log('🔬 COMPREHENSIVE EXCEL FILES ANALYSIS');
console.log('=====================================');
console.log(`📁 Results Directory: ${resultsDir}`);
console.log(`📊 Files to Analyze: ${files.length}`);

files.forEach(filename => {
  const filePath = path.join(resultsDir, filename);
  analyzeExcelFile(filePath);
});

console.log(`\n${'='.repeat(60)}`);
console.log('✅ COMPREHENSIVE ANALYSIS COMPLETE');
console.log(`${'='.repeat(60)}`);