console.log('Starting Excel Processor...\n');

const ExcelProcessor = require('./scripts/excel-processor');

try {
  const processor = new ExcelProcessor();
  console.log('Processor initialized\n');

  processor.run().then(result => {
    console.log('\n✅ Processing complete!');
    console.log('Success:', result.success);
    console.log('Processed:', result.processed, 'files');
  }).catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  });
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
}
