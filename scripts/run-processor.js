// Runner script for Excel Processor
const ExcelProcessor = require('./excel-processor');

async function runProcessor() {
  try {
    const processor = new ExcelProcessor();

    // Process all Excel files
    const result = await processor.run();

    if (result.success) {
      console.log('\n✅ Processing completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Processing completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

runProcessor();
