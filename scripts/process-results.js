#!/usr/bin/env node

// Main Results Processing Script
// Processes Excel files and generates JSON for Vercel deployment

const ExcelProcessor = require('./excel-processor');
const FBSMockProcessor = require('./process-fbs-mocks');
const BUPMockProcessor = require('./process-bup-mocks');

async function main() {
  console.log('🎯 VH Results Processing System');
  console.log('===============================\n');

  const processor = new ExcelProcessor();
  const fbsProcessor = new FBSMockProcessor();
  const bupProcessor = new BUPMockProcessor();

  try {
    // Process main Excel files
    const result = await processor.run();

    // Process FBS Mock tests
    console.log('\n📚 Processing DU FBS Mock Tests...\n');
    const fbsResult = await fbsProcessor.run();

    // Process BUP Mock tests
    console.log('\n📚 Processing BUP Mock Tests...\n');
    const bupResult = await bupProcessor.run();

    const allSuccess = result.success && fbsResult.success && bupResult.success;

    if (allSuccess) {
      console.log('\n🎉 Processing completed successfully!');
      console.log('📁 JSON files are ready for deployment in public/data/');

      // Optional: Auto-commit to Git
      if (process.argv.includes('--commit')) {
        console.log('\n📤 Auto-committing to Git...');
        await autoCommit();
      }

      process.exit(0);
    } else {
      console.log('\n❌ Processing completed with errors');
      console.log('Check the error messages above for details');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Fatal error during processing:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Auto-commit processed data to Git
 */
async function autoCommit() {
  const { execSync } = require('child_process');

  try {
    // Add the data files
    execSync('git add public/data/', { stdio: 'inherit' });

    // Commit with timestamp (date and time)
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19); // Format: YYYY-MM-DD HH:MM:SS
    const commitMessage = `Update test results data - ${timestamp}

🤖 Generated with VH Results Processing System

- Processed Excel files from Results/ folder
- Generated optimized JSON files for Vercel deployment
- Updated students, simple tests, and full tests data
- Calculated thresholds and updated ranks`;

    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });

    console.log('✅ Changes committed to Git');

    // Optional: Push to remote
    if (process.argv.includes('--push')) {
      console.log('📤 Pushing to remote repository...');
      execSync('git push', { stdio: 'inherit' });
      console.log('✅ Changes pushed to remote');
    }

  } catch (error) {
    console.log('⚠️  Git operations failed:', error.message);
    console.log('Please commit manually if needed');
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
VH Results Processing System

Usage:
  node scripts/process-results.js [options]

Options:
  --commit    Automatically commit generated files to Git
  --push      Push commits to remote repository (requires --commit)
  --help, -h  Show this help message

Examples:
  node scripts/process-results.js
  node scripts/process-results.js --commit
  node scripts/process-results.js --commit --push
`);
  process.exit(0);
}

// Run the main function
main();