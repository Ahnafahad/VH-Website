const fs = require('fs');
const path = require('path');

const ACCOUNTING_DIR = 'FBS Games/Accounting';
const OUTPUT_FILE = 'public/data/accounting-questions.json';

/**
 * Extract short title from topics string for UI display
 */
function getShortTitle(topics) {
  if (!topics) return 'Accounting';
  const parts = topics.split(',').map(t => t.trim());
  if (parts.length <= 1) return parts[0] || 'Accounting';
  return `${parts[0]} & ${parts.length - 1} more`;
}

/**
 * Parse a single markdown file and extract all questions
 */
function parseMarkdownFile(filePath, lectureNumber) {
  console.log(`  📄 Parsing: ${path.basename(filePath)}`);

  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract title and topics from header
  const titleMatch = content.match(/# (.+)/);
  const topicsMatch = content.match(/Topics?:\s*(.+)/i);

  const title = titleMatch ? titleMatch[1].trim() : `Lecture ${lectureNumber}`;
  const topics = topicsMatch ? topicsMatch[1].trim() : '';

  // Find all sections
  const sectionMatches = content.matchAll(/## Section \d+:\s*(.+)/g);
  const sections = Array.from(sectionMatches, m => m[1].trim());

  // Split by question markers
  const questionRegex = /### Question \d+/g;
  const questionBlocks = content.split(questionRegex);
  questionBlocks.shift(); // Remove header section

  const questions = [];
  let currentSection = 'General';

  questionBlocks.forEach((block, index) => {
    try {
      // Try to find which section this question belongs to
      const beforeQuestion = content.substring(0, content.indexOf(`### Question ${index + 1}`));
      const lastSectionMatch = beforeQuestion.match(/## Section \d+:\s*(.+)/g);
      if (lastSectionMatch && lastSectionMatch.length > 0) {
        const lastSection = lastSectionMatch[lastSectionMatch.length - 1];
        const sectionNameMatch = lastSection.match(/## Section \d+:\s*(.+)/);
        if (sectionNameMatch) {
          currentSection = sectionNameMatch[1].trim();
        }
      }

      // Extract question text - handle multiple formats
      let questionText = '';

      // Format 1: **Question:**
      let questionMatch = block.match(/\*\*Question:\*\*\s+(.+?)(?=\s*\*\*Options?:)/s);
      if (questionMatch) {
        questionText = questionMatch[1].trim();
      } else {
        // Format 2: **Question** (without colon)
        questionMatch = block.match(/\*\*Question\*\*\s+(.+?)(?=\s*[-•A-E]\.)/s);
        if (questionMatch) {
          questionText = questionMatch[1].trim();
        }
      }

      if (!questionText) {
        console.log(`    ⚠️  Warning: Could not extract question text for Q${index + 1}`);
        return;
      }

      // Extract options - handle multiple formats
      const options = {};

      // Try format 1: **Options:**
      const optionsMatch = block.match(/\*\*Options?:\*\*\s+(.+?)(?=\s*\*\*Correct Answer)/s);
      let optionsText = '';

      if (optionsMatch) {
        optionsText = optionsMatch[1].trim();
      } else {
        // Try format 2: Options listed directly with - or •
        const optionsMatch2 = block.match(/(?:[-•]\s*[A-E]\.(.+?))+(?=\s*\*\*Correct Answer)/s);
        if (optionsMatch2) {
          optionsText = optionsMatch2[0];
        }
      }

      // Extract each option A-E
      ['A', 'B', 'C', 'D', 'E'].forEach(letter => {
        // Try different formats
        let match = optionsText.match(new RegExp(`${letter}[.)]\\s*(.+?)(?=\\s*[A-E][.)]|$)`, 's'));
        if (!match) {
          match = optionsText.match(new RegExp(`[-•]\\s*${letter}[.)]\\s*(.+?)(?=\\s*[-•]\\s*[A-E][.)]|$)`, 's'));
        }
        if (match) {
          options[letter] = match[1].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
        }
      });

      // Extract correct answer - handle multiple formats
      let correctAnswer = '';

      // Format 1: **Correct Answer:** **X. Full option text**
      let answerMatch = block.match(/\*\*Correct Answer:\*\*\s*\*\*([A-E])\./);
      if (answerMatch) {
        correctAnswer = answerMatch[1];
      } else {
        // Format 2: **Correct Answer:** **X – Full option text**
        answerMatch = block.match(/\*\*Correct Answer:\*\*\s*\*\*([A-E])\s*[–-]/);
        if (answerMatch) {
          correctAnswer = answerMatch[1];
        } else {
          // Format 3: **Correct Answer:** **X**
          answerMatch = block.match(/\*\*Correct Answer:\*\*\s*\*\*([A-E])\*\*/);
          if (answerMatch) {
            correctAnswer = answerMatch[1];
          } else {
            // Format 4: **Correct Answer:** X (without bold)
            answerMatch = block.match(/\*\*Correct Answer:\*\*\s*([A-E])/);
            if (answerMatch) {
              correctAnswer = answerMatch[1];
            }
          }
        }
      }

      if (!correctAnswer) {
        console.log(`    ⚠️  Warning: Could not extract correct answer for Q${index + 1}`);
        return;
      }

      // Extract explanation
      const explanationMatch = block.match(/\*\*Explanation:\*\*\s+(.+?)(?=\n---|\n###|$)/s);
      const explanation = explanationMatch
        ? explanationMatch[1].trim().replace(/\s+/g, ' ')
        : '';

      // Validate question has minimum required data
      if (questionText && correctAnswer && Object.keys(options).length >= 4) {
        questions.push({
          id: `lecture${lectureNumber}_q${index + 1}`,
          lecture: lectureNumber,
          section: currentSection,
          question: questionText,
          options,
          correctAnswer,
          explanation
        });
      } else {
        console.log(`    ⚠️  Skipping incomplete question ${index + 1}`);
        console.log(`       Question: ${!!questionText}, Answer: ${!!correctAnswer}, Options: ${Object.keys(options).length}`);
      }
    } catch (error) {
      console.error(`    ❌ Error parsing question ${index + 1}:`, error.message);
    }
  });

  console.log(`    ✅ Extracted ${questions.length} questions`);

  return {
    lectureNumber,
    title,
    topics,
    shortTitle: getShortTitle(topics),
    sections: sections.length > 0 ? sections : ['General'],
    questionCount: questions.length,
    questions
  };
}

/**
 * Find lecture file by number (handles different naming conventions)
 */
function findLectureFile(lectureNumber) {
  const files = fs.readdirSync(ACCOUNTING_DIR);

  // Try different naming patterns
  const patterns = [
    `lecture_${lectureNumber}_`,
    `lecture${lectureNumber}_`,
    `lecture_${lectureNumber}.md`,
    `lecture${lectureNumber}.md`,
    `_lecture_${lectureNumber}_`,
    `accounting_lecture_${lectureNumber}_`
  ];

  for (const pattern of patterns) {
    const file = files.find(f => f.toLowerCase().includes(pattern.toLowerCase()));
    if (file) {
      return file;
    }
  }

  return null;
}

/**
 * Main processing function
 */
function main() {
  console.log('🚀 Starting Accounting Questions Parser\n');
  console.log(`📂 Source directory: ${ACCOUNTING_DIR}`);
  console.log(`📄 Output file: ${OUTPUT_FILE}\n`);

  // Verify source directory exists
  if (!fs.existsSync(ACCOUNTING_DIR)) {
    console.error(`❌ Error: Directory "${ACCOUNTING_DIR}" not found`);
    process.exit(1);
  }

  const lectures = [];
  let totalQuestionsCount = 0;

  // Process each lecture (1-12)
  for (let i = 1; i <= 12; i++) {
    console.log(`📖 Lecture ${i}:`);

    const filename = findLectureFile(i);

    if (filename) {
      const filePath = path.join(ACCOUNTING_DIR, filename);
      const lectureData = parseMarkdownFile(filePath, i);
      lectures.push(lectureData);
      totalQuestionsCount += lectureData.questionCount;
    } else {
      console.log(`  ⚠️  No file found for Lecture ${i}`);
      // Add placeholder for missing lecture
      lectures.push({
        lectureNumber: i,
        title: `Lecture ${i}`,
        topics: '',
        shortTitle: 'Coming Soon',
        sections: [],
        questionCount: 0,
        questions: []
      });
    }
    console.log('');
  }

  // Create output object
  const output = {
    lectures,
    totalQuestions: totalQuestionsCount,
    lastUpdated: new Date().toISOString(),
    metadata: {
      source: ACCOUNTING_DIR,
      lecturesProcessed: lectures.filter(l => l.questionCount > 0).length,
      totalLectures: 12,
      questionsPerLecture: lectures.map(l => ({
        lecture: l.lectureNumber,
        count: l.questionCount
      }))
    }
  };

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    console.log(`📁 Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write JSON file
  const jsonOutput = JSON.stringify(output, null, 2);
  fs.writeFileSync(OUTPUT_FILE, jsonOutput);

  const fileSizeKB = (jsonOutput.length / 1024).toFixed(2);

  // Summary
  console.log('═'.repeat(60));
  console.log('✅ PARSING COMPLETE\n');
  console.log(`📊 Summary:`);
  console.log(`   Total Questions: ${totalQuestionsCount}`);
  console.log(`   Lectures Processed: ${lectures.filter(l => l.questionCount > 0).length}/12`);
  console.log(`   Output File: ${OUTPUT_FILE}`);
  console.log(`   File Size: ${fileSizeKB} KB\n`);

  console.log(`📈 Questions per Lecture:`);
  lectures.forEach(l => {
    const status = l.questionCount === 0 ? '⚠️  Empty' : '✅';
    console.log(`   ${status} Lecture ${l.lectureNumber}: ${l.questionCount} questions`);
  });

  console.log('\n' + '═'.repeat(60));

  if (totalQuestionsCount === 0) {
    console.error('\n❌ ERROR: No questions were parsed!');
    process.exit(1);
  }

  console.log('\n✨ Ready for use in FBS Accounting Game!');
}

// Run the parser
try {
  main();
} catch (error) {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
}
