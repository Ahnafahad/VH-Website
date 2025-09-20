@echo off
setlocal enabledelayedexpansion

:: ==========================================
:: VH Website - Test Data Update Script
:: ==========================================
:: This script processes Excel test files and updates the website data
:: Run this whenever test files are added or updated

echo.
echo ==========================================
echo VH Website - Test Update Script
echo ==========================================
echo.

:: Set script directory and project paths
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%"
set "TEST_DATA_DIR=%PROJECT_ROOT%docs\test-data"
set "RESULTS_DIR=%PROJECT_ROOT%Results"
set "PUBLIC_DATA_DIR=%PROJECT_ROOT%public\data"
set "SCRIPTS_DIR=%PROJECT_ROOT%scripts"

:: Check if Node.js is available
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js found

:: Check if test data directory exists
echo [2/6] Checking test data directory...
if not exist "%TEST_DATA_DIR%" (
    echo ❌ ERROR: Test data directory not found: %TEST_DATA_DIR%
    echo Please ensure test files are in the docs/test-data/ folder
    pause
    exit /b 1
)
echo ✅ Test data directory found

:: Create Results directory if it doesn't exist (for processor compatibility)
echo [3/6] Setting up processing directories...
if not exist "%RESULTS_DIR%" (
    mkdir "%RESULTS_DIR%"
    echo ✅ Created Results directory
) else (
    echo ✅ Results directory exists
)

:: Copy test files from docs/test-data to Results for processing
echo [4/6] Copying test files for processing...
copy /Y "%TEST_DATA_DIR%\*.xlsx" "%RESULTS_DIR%\" >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Failed to copy test files
    pause
    exit /b 1
)

:: Count Excel files
set "excel_count=0"
for %%f in ("%RESULTS_DIR%\*.xlsx") do (
    set /a excel_count+=1
)
echo ✅ Copied %excel_count% Excel file(s) for processing

:: Run the Excel processor
echo [5/6] Processing Excel files...
echo Running Excel processor...
cd /d "%PROJECT_ROOT%"
node "%SCRIPTS_DIR%\excel-processor.js"
if errorlevel 1 (
    echo ❌ ERROR: Excel processing failed
    echo Check the console output above for details
    pause
    exit /b 1
)
echo ✅ Excel files processed successfully

:: Run access control generator
echo [6/6] Updating access control...
node "%SCRIPTS_DIR%\generate-access-control.js"
if errorlevel 1 (
    echo ❌ WARNING: Access control update failed
    echo This is not critical, but you may want to check it manually
)
echo ✅ Access control updated

:: Clean up temporary Results directory (optional)
echo.
echo Cleaning up temporary files...
if exist "%RESULTS_DIR%" (
    del /Q "%RESULTS_DIR%\*.xlsx" >nul 2>&1
    rmdir "%RESULTS_DIR%" >nul 2>&1
)

:: Show completion status
echo.
echo ==========================================
echo ✅ Test Update Complete!
echo ==========================================
echo.
echo Updated files:
if exist "%PUBLIC_DATA_DIR%\simple-tests.json" echo ✅ simple-tests.json
if exist "%PUBLIC_DATA_DIR%\full-tests.json" echo ✅ full-tests.json
if exist "%PUBLIC_DATA_DIR%\students.json" echo ✅ students.json
if exist "%PUBLIC_DATA_DIR%\metadata.json" echo ✅ metadata.json
echo.
echo The website data has been updated with the latest test information.
echo You can now test the changes locally or deploy to production.
echo.

:: Ask if user wants to see the results
set /p "show_results=Would you like to see a summary of processed tests? (y/n): "
if /i "%show_results%"=="y" (
    echo.
    echo ==========================================
    echo Test Processing Summary:
    echo ==========================================
    if exist "%PUBLIC_DATA_DIR%\metadata.json" (
        node -e "
        try {
            const metadata = require('./public/data/metadata.json');
            console.log('Last Updated:', metadata.lastUpdated);
            console.log('Total Tests Processed:', metadata.totalTests);
            console.log('Simple Tests:', metadata.simpleTestsCount);
            console.log('Full Tests:', metadata.fullTestsCount);
            console.log('Total Students:', metadata.totalStudents);
        } catch(e) {
            console.log('Could not read metadata file');
        }
        "
    )
)

echo.
pause