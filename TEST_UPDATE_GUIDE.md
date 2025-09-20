# Test Data Update Guide

## Overview
This guide explains how to update test data in the VH Website system when new Excel files are added or existing ones are modified.

## Quick Start

### For Windows Users

#### Option 1: Batch File (Recommended for beginners)
1. Place your Excel test files in the `docs/test-data/` folder
2. Double-click `update-tests.bat`
3. Follow the on-screen prompts

#### Option 2: PowerShell Script (Recommended for advanced users)
1. Place your Excel test files in the `docs/test-data/` folder
2. Right-click on `update-tests.ps1` → "Run with PowerShell"
3. Or open PowerShell and run: `.\update-tests.ps1`

### Command Line Options (PowerShell only)
```powershell
# Silent mode (no prompts)
.\update-tests.ps1 -Silent

# Skip cleanup (keep temporary files)
.\update-tests.ps1 -SkipCleanup

# Custom test data path
.\update-tests.ps1 -TestDataPath "path/to/test/files"
```

## What the Scripts Do

1. **Check Prerequisites**: Verifies Node.js is installed
2. **Validate Directories**: Ensures test data folder exists
3. **Prepare Processing**: Creates temporary directories
4. **Copy Files**: Moves Excel files to processing location
5. **Process Excel**: Converts Excel files to JSON format
6. **Update Access Control**: Refreshes user permissions
7. **Cleanup**: Removes temporary files

## Updated Files

After running the scripts, these files will be updated:
- `public/data/simple-tests.json` - Simple test data
- `public/data/full-tests.json` - Comprehensive test data
- `public/data/students.json` - Student information
- `public/data/metadata.json` - System metadata

## File Requirements

### Excel File Format
- Files must be in `.xlsx` format
- Follow the established template structure
- Include proper headers and data formatting

### Supported Test Types
- **Simple Tests**: Basic question/answer format
- **Full Tests**: Comprehensive multi-section tests with detailed analytics

## Troubleshooting

### Common Issues

#### "Node.js not found"
- Install Node.js from [nodejs.org](https://nodejs.org/)
- Ensure Node.js is added to your system PATH

#### "Test data directory not found"
- Verify Excel files are in `docs/test-data/` folder
- Check folder permissions

#### "Processing failed"
- Check Excel file format and structure
- Ensure files are not corrupted
- Verify template compliance

#### "Access control update failed"
- This is usually non-critical
- Check `access-control.json` file permissions
- Manually run `node scripts/generate-access-control.js`

### Getting Help
1. Check the console output for detailed error messages
2. Verify file formats match the template
3. Ensure all dependencies are installed
4. Contact system administrator if issues persist

## File Locations

```
VH Website/
├── docs/test-data/          # Place Excel files here
│   ├── *.xlsx              # Your test files
├── public/data/             # Generated JSON files
│   ├── simple-tests.json
│   ├── full-tests.json
│   ├── students.json
│   └── metadata.json
├── scripts/                 # Processing scripts
│   ├── excel-processor.js
│   └── generate-access-control.js
├── update-tests.bat         # Windows batch script
├── update-tests.ps1         # PowerShell script
└── TEST_UPDATE_GUIDE.md     # This guide
```

## Automation

### For Regular Updates
You can automate the process by:
1. Setting up file watchers on the `docs/test-data/` folder
2. Creating scheduled tasks to run the update scripts
3. Integrating with CI/CD pipelines for automatic deployment

### Example Scheduled Task (Windows)
```batch
# Run daily at 2 AM
schtasks /create /tn "VH Website Test Update" /tr "C:\path\to\update-tests.bat" /sc daily /st 02:00
```

## Best Practices

1. **Backup**: Always backup existing data before updates
2. **Validation**: Test files locally before production deployment
3. **Timing**: Update during low-traffic periods
4. **Verification**: Check website functionality after updates
5. **Documentation**: Keep track of changes and versions

## Security Notes

- Excel files may contain sensitive student data
- Ensure proper access controls on the `docs/test-data/` folder
- Generated JSON files are publicly accessible
- Review data before deployment to production

---

**Last Updated**: September 2024
**Version**: 1.0