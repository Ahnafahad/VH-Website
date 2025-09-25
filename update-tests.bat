@echo off
setlocal enabledelayedexpansion

:: ==========================================
:: VH Website - Test Data Update Script
:: ==========================================
:: This script processes Excel test files and updates the website data
:: Run this whenever test files are added or updated

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Create log file with timestamp
for /f "tokens=1-4 delims=/. " %%i in ('date /t') do set "date_str=%%l-%%j-%%k"
for /f "tokens=1-2 delims=: " %%i in ('time /t') do set "time_str=%%i-%%j"
set "LOG_FILE=logs\update-tests-%date_str%-%time_str%.log"

:: Function to log messages (both to console and file)
call :log_init

echo.
echo ==========================================
echo VH Website - Test Update Script
echo ==========================================
call :log "INFO: Script started at %date% %time%"
call :log "INFO: Log file: %LOG_FILE%"
echo.

:: Set script directory and project paths
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR:~0,-1%"
set "TEST_DATA_DIR=%PROJECT_ROOT%docs\test-data"
set "RESULTS_DIR=%PROJECT_ROOT%Results"
set "PUBLIC_DATA_DIR=%PROJECT_ROOT%public\data"
set "SCRIPTS_DIR=%PROJECT_ROOT%scripts"

call :log "INFO: Project paths initialized"
call :log "INFO: PROJECT_ROOT=%PROJECT_ROOT%"
call :log "INFO: RESULTS_DIR=%RESULTS_DIR%"
call :log "INFO: PUBLIC_DATA_DIR=%PUBLIC_DATA_DIR%"

:: Check if Node.js is available
echo [1/6] Checking Node.js installation...
call :log "INFO: Checking Node.js installation..."
node --version >nul 2>&1
if errorlevel 1 (
    call :log "ERROR: Node.js is not installed or not in PATH"
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODE_VERSION=%%v"
call :log "INFO: Node.js found - version %NODE_VERSION%"
echo ✅ Node.js found

:: Check if Results directory exists with Excel files
echo [2/6] Checking Results directory...
call :log "INFO: Checking Results directory: %RESULTS_DIR%"
if not exist "%RESULTS_DIR%" (
    call :log "ERROR: Results directory not found: %RESULTS_DIR%"
    echo ❌ ERROR: Results directory not found: %RESULTS_DIR%
    echo Please ensure Excel files are in the Results/ folder
    pause
    exit /b 1
)
call :log "INFO: Results directory found"

:: Count Excel files in Results and log them
set "excel_count=0"
call :log "INFO: Scanning for Excel files in Results directory..."
for %%f in ("%RESULTS_DIR%\*.xlsx") do (
    set /a excel_count+=1
    call :log "INFO: Found Excel file: %%~nxf (Size: %%~zf bytes)"
)
call :log "INFO: Total Excel files found: %excel_count%"
if %excel_count%==0 (
    call :log "ERROR: No Excel files found in Results directory"
    echo ❌ ERROR: No Excel files found in Results directory
    echo Please ensure Excel files are in the Results/ folder
    pause
    exit /b 1
)
echo ✅ Found %excel_count% Excel file(s) ready for processing

:: Run the Excel processor
echo [3/6] Processing Excel files...
echo Running Excel processor...
call :log "INFO: Starting Excel processing..."
call :log "INFO: Changing to project root: %PROJECT_ROOT%"
cd /d "%PROJECT_ROOT%"
if not "%CD%"=="%PROJECT_ROOT%" (
    call :log "ERROR: Failed to change to project root directory"
    echo ❌ ERROR: Failed to change to project root directory
    pause
    exit /b 1
)

call :log "INFO: Executing: node %SCRIPTS_DIR%\process-results.js"
call :log "INFO: Excel processor started at %time%"
node "%SCRIPTS_DIR%\process-results.js"
set "EXCEL_RESULT=%ERRORLEVEL%"
call :log "INFO: Excel processor finished at %time% with exit code: %EXCEL_RESULT%"
if %EXCEL_RESULT% neq 0 (
    call :log "ERROR: Excel processing failed with exit code: %EXCEL_RESULT%"
    echo ❌ ERROR: Excel processing failed
    echo Check the console output above for details
    pause
    exit /b 1
)
call :log "INFO: Excel files processed successfully"
echo ✅ Excel files processed successfully

:: Run access control generator
echo [4/6] Updating access control...
call :log "INFO: Starting access control update..."
call :log "INFO: Executing: node %SCRIPTS_DIR%\generate-access-control.js"
node "%SCRIPTS_DIR%\generate-access-control.js"
set "ACCESS_RESULT=%ERRORLEVEL%"
call :log "INFO: Access control generator finished with exit code: %ACCESS_RESULT%"
if %ACCESS_RESULT% neq 0 (
    call :log "WARNING: Access control update failed with exit code: %ACCESS_RESULT%"
    echo ❌ WARNING: Access control update failed
    echo This is not critical, but you may want to check it manually
) else (
    call :log "INFO: Access control updated successfully"
)
echo ✅ Access control updated

:: Git operations - Add updated files
echo [5/6] Adding updated files to git...
call :log "INFO: Starting git operations..."

:: Check git status before adding files
call :log "INFO: Checking git status before staging..."
git status --porcelain > "%TEMP%\git_status_before.txt"
if exist "%TEMP%\git_status_before.txt" (
    call :log "INFO: Git status before staging:"
    for /f "tokens=*" %%i in (%TEMP%\git_status_before.txt%) do call :log "      %%i"
)

call :log "INFO: Adding public/data/*.json files to git..."
git add public/data/*.json
set "GIT_ADD_RESULT=%ERRORLEVEL%"
call :log "INFO: Git add completed with exit code: %GIT_ADD_RESULT%"

if %GIT_ADD_RESULT% neq 0 (
    call :log "WARNING: Git add failed with exit code: %GIT_ADD_RESULT%"
    echo ❌ WARNING: Git add failed
    echo You may need to commit and push manually
) else (
    call :log "INFO: Files added to git staging area"
    echo ✅ Files added to git staging
)

:: Check what's staged after adding
call :log "INFO: Checking git status after staging..."
git status --porcelain > "%TEMP%\git_status_after.txt"
if exist "%TEMP%\git_status_after.txt" (
    call :log "INFO: Git status after staging:"
    for /f "tokens=*" %%i in (%TEMP%\git_status_after.txt%) do call :log "      %%i"
)

:: Git operations - Commit and push
echo [6/6] Committing and pushing to GitHub...
call :log "INFO: Starting commit and push operations..."

:: Show git status to user
git status
call :log "INFO: Current git status shown to user"

:: Check if there are staged changes
git diff --cached --quiet
set "STAGED_CHANGES=%ERRORLEVEL%"
call :log "INFO: Staged changes check result: %STAGED_CHANGES% (0=no changes, 1=has changes)"

if %STAGED_CHANGES%==0 (
    call :log "INFO: No staged changes detected - checking for unstaged changes"
    git diff --quiet
    set "UNSTAGED_CHANGES=%ERRORLEVEL%"
    call :log "INFO: Unstaged changes check result: %UNSTAGED_CHANGES%"

    if %UNSTAGED_CHANGES%==0 (
        call :log "INFO: No changes to commit - skipping commit/push"
        echo ℹ️ No changes detected - nothing to commit
        goto :skip_commit
    )
)

set /p "commit_message=Enter commit message (or press Enter for default): "
if "%commit_message%"=="" (
    set "commit_message=Update test data with latest Excel files"
)
call :log "INFO: Commit message set to: %commit_message%"

call :log "INFO: Attempting to commit changes..."
git commit -m "%commit_message%"
set "COMMIT_RESULT=%ERRORLEVEL%"
call :log "INFO: Git commit finished with exit code: %COMMIT_RESULT%"

if %COMMIT_RESULT% neq 0 (
    call :log "WARNING: Git commit failed with exit code: %COMMIT_RESULT%"
    echo ❌ WARNING: Git commit failed - possibly no changes to commit
) else (
    call :log "INFO: Changes committed successfully"
    echo ✅ Changes committed successfully

    echo Pushing to GitHub...
    call :log "INFO: Attempting to push to GitHub..."
    git push
    set "PUSH_RESULT=%ERRORLEVEL%"
    call :log "INFO: Git push finished with exit code: %PUSH_RESULT%"

    if %PUSH_RESULT% neq 0 (
        call :log "WARNING: Git push failed with exit code: %PUSH_RESULT%"
        echo ❌ WARNING: Git push failed
        echo You may need to push manually or check your git configuration
    ) else (
        call :log "INFO: Changes pushed to GitHub successfully"
        echo ✅ Changes pushed to GitHub successfully
    )
)

:skip_commit

:: Show completion status
echo.
echo ==========================================
echo ✅ Test Update Complete!
echo ==========================================
call :log "INFO: Script completed successfully at %date% %time%"
call :log "INFO: Checking generated files..."

echo.
echo Updated files:
if exist "%PUBLIC_DATA_DIR%\simple-tests.json" (
    for %%f in ("%PUBLIC_DATA_DIR%\simple-tests.json") do (
        echo ✅ simple-tests.json (%%~zf bytes)
        call :log "INFO: Generated simple-tests.json (%%~zf bytes, modified: %%~tf)"
    )
) else (
    echo ❌ simple-tests.json - NOT FOUND
    call :log "WARNING: simple-tests.json was not generated"
)

if exist "%PUBLIC_DATA_DIR%\full-tests.json" (
    for %%f in ("%PUBLIC_DATA_DIR%\full-tests.json") do (
        echo ✅ full-tests.json (%%~zf bytes)
        call :log "INFO: Generated full-tests.json (%%~zf bytes, modified: %%~tf)"
    )
) else (
    echo ❌ full-tests.json - NOT FOUND
    call :log "WARNING: full-tests.json was not generated"
)

if exist "%PUBLIC_DATA_DIR%\students.json" (
    for %%f in ("%PUBLIC_DATA_DIR%\students.json") do (
        echo ✅ students.json (%%~zf bytes)
        call :log "INFO: Generated students.json (%%~zf bytes, modified: %%~tf)"
    )
) else (
    echo ❌ students.json - NOT FOUND
    call :log "WARNING: students.json was not generated"
)

if exist "%PUBLIC_DATA_DIR%\metadata.json" (
    for %%f in ("%PUBLIC_DATA_DIR%\metadata.json") do (
        echo ✅ metadata.json (%%~zf bytes)
        call :log "INFO: Generated metadata.json (%%~zf bytes, modified: %%~tf)"
    )
) else (
    echo ❌ metadata.json - NOT FOUND
    call :log "WARNING: metadata.json was not generated"
)

echo.
echo The website data has been updated with the latest test information.
echo You can now test the changes locally or deploy to production.
call :log "INFO: Log file saved at: %LOG_FILE%"
echo 📝 Detailed log saved at: %LOG_FILE%
echo.

:: Ask if user wants to see the results
set /p "show_results=Would you like to see a summary of processed tests? (y/n): "
if /i "%show_results%"=="y" (
    call :log "INFO: User requested test processing summary"
    echo.
    echo ==========================================
    echo Test Processing Summary:
    echo ==========================================
    if exist "%PUBLIC_DATA_DIR%\metadata.json" (
        call :log "INFO: Reading metadata.json for summary"
        node -e "
        try {
            const metadata = require('./public/data/metadata.json');
            console.log('Last Updated:', metadata.lastUpdated);
            console.log('Total Tests Processed:', metadata.totalTests);
            console.log('Simple Tests:', metadata.simpleTestsCount);
            console.log('Full Tests:', metadata.fullTestsCount);
            console.log('Total Students:', metadata.totalStudents);
        } catch(e) {
            console.log('Could not read metadata file:', e.message);
        }
        "
    ) else (
        call :log "WARNING: metadata.json not found for summary"
        echo Could not find metadata.json file
    )
) else (
    call :log "INFO: User declined test processing summary"
)

call :log "INFO: Script execution completed. Total runtime: [Calculated in log review]"
echo.
echo 📝 For troubleshooting, check the detailed log at: %LOG_FILE%
pause

:: Log cleanup function would go here, but keeping logs for now
goto :eof

:: ==========================================
:: LOGGING FUNCTIONS
:: ==========================================

:log_init
:: Initialize logging
echo. > "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"
echo VH Website Test Update Script Log >> "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"
echo Script started: %date% %time% >> "%LOG_FILE%"
echo Script path: %~f0 >> "%LOG_FILE%"
echo Working directory: %CD% >> "%LOG_FILE%"
echo User: %USERNAME% >> "%LOG_FILE%"
echo Computer: %COMPUTERNAME% >> "%LOG_FILE%"
echo ============================================= >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"
goto :eof

:log
:: Log a message with timestamp
:: Usage: call :log "MESSAGE"
set "msg=%~1"
echo [%date% %time%] %msg% >> "%LOG_FILE%"
goto :eof