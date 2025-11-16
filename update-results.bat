@echo off
setlocal enabledelayedexpansion

:: Ensure we don't close on error
if not defined IN_SUBPROCESS (cmd /k set IN_SUBPROCESS=1 ^& %0 %* & exit)

echo ========================================
echo  VH Results Update System
echo ========================================
echo  Processes all test types automatically:
echo  - IBA Tests (Simple and Full)
echo  - FBS Mocks
echo  - Any new additions or modifications
echo ========================================
echo.

:: Change to script directory
cd /d "%~dp0"

:: Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Not a git repository!
    echo Please run this script from the VH Website root directory.
    echo.
    pause
    exit /b 1
)

:: Check if Results folder exists
if not exist "Results" (
    echo [ERROR] Results folder not found!
    echo Please ensure you're running this from the project root.
    echo.
    pause
    exit /b 1
)

:: Show Results folder status
echo [1/7] Analyzing Results folder for changes...
echo ----------------------------------------
echo.

:: Count Excel files in Results directory
set EXCEL_COUNT=0
for /r "Results" %%F in (*.xlsx) do (
    set /a EXCEL_COUNT+=1
)

echo Total Excel files in Results folder: %EXCEL_COUNT%
echo.

:: Show git status
echo Changes detected by Git:
echo ------------------------
git status Results/ --short
echo.

:: Simple change detection
set HAS_CHANGES=0

:: Check for any changes
git diff --quiet Results/
if errorlevel 1 set HAS_CHANGES=1

git diff --cached --quiet Results/
if errorlevel 1 set HAS_CHANGES=1

git ls-files --others --exclude-standard Results/ | findstr ".xlsx" >nul 2>&1
if not errorlevel 1 set HAS_CHANGES=1

if %HAS_CHANGES%==0 (
    echo [NO CHANGES] No modifications detected in Results folder.
    echo.
    set /p CONTINUE="Continue processing anyway? (Y/N): "
    if /i not "!CONTINUE!"=="Y" (
        echo.
        echo [CANCELLED] Update cancelled - no changes to process.
        echo.
        pause
        exit /b 0
    )
) else (
    echo [CHANGES DETECTED] Excel files have been added or modified!
    echo.
)

:: Ask for confirmation
set /p CONFIRM="Process all changes and push to remote? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo [CANCELLED] Update cancelled by user.
    echo.
    pause
    exit /b 0
)

echo.
echo [2/7] Processing IBA Test files...
echo ----------------------------------------

:: Run the process-results script (IBA tests)
node scripts/process-results.js

:: Check if processing was successful
if errorlevel 1 (
    echo.
    echo [ERROR] IBA Processing failed!
    echo.
    set /p CONTINUE="Continue anyway? (Y/N): "
    if /i not "!CONTINUE!"=="Y" (
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [3/7] Processing FBS Mock files...
echo ----------------------------------------

:: Run the FBS mock processor
node scripts/process-fbs-mocks.js

:: Check if processing was successful
if errorlevel 1 (
    echo.
    echo [ERROR] FBS Mock Processing failed!
    echo.
    set /p CONTINUE="Continue anyway? (Y/N): "
    if /i not "!CONTINUE!"=="Y" (
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [4/7] Syncing student emails from database...
echo ----------------------------------------

:: Load MONGODB_URI from .env.local if it exists
set MONGODB_URI=
if exist .env.local (
    for /f "usebackq tokens=2 delims==" %%a in (`findstr /i "MONGODB_URI" .env.local 2^>nul`) do set MONGODB_URI=%%a
)

:: Sync student emails from MongoDB to students.json
if defined MONGODB_URI (
    node scripts/sync-student-emails.js
    if errorlevel 1 (
        echo [WARNING] Email sync failed, but continuing...
    )
) else (
    echo [WARNING] MONGODB_URI not found in .env.local, skipping email sync...
)

echo.
echo [5/7] Staging all processed files...
echo ----------------------------------------
git add public/data/
git add Results/
echo Staged all changes.

echo.
echo [6/7] Committing changes...
echo ----------------------------------------

:: Create commit with timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a:%%b)

git commit -m "Update test results data - %mydate% %mytime%" -m "" -m "Generated with VH Results Processing System" -m "" -m "Processing completed:" -m "- Processed IBA tests (Simple and Full)" -m "- Processed FBS mock tests" -m "- Generated optimized JSON files for Vercel deployment" -m "- Updated students database" -m "- Synced student emails from MongoDB"

:: Check if commit was successful
if errorlevel 1 (
    echo.
    echo [WARNING] No changes to commit or commit failed
    echo.
    set /p CONTINUE="Continue with push anyway? (Y/N): "
    if /i not "!CONTINUE!"=="Y" (
        echo [CANCELLED] Push cancelled
        echo.
        pause
        exit /b 0
    )
)

echo.
echo [7/7] Pushing to remote repository...
echo ----------------------------------------
git push

:: Check if push was successful
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed!
    echo Please check the error messages above.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Update Complete!
echo ========================================
echo.
echo [SUCCESS] All changes have been processed and deployed:
echo.
echo Test Processing:
echo   - IBA Simple Tests: Processed and updated
echo   - IBA Full Tests: Processed and updated
echo   - IBA Mock Tests: Processed and updated
echo   - FBS Mock Tests: Processed and updated
echo.
echo Data Generation:
echo   - JSON files: Generated in public/data/
echo   - Student database: Updated with merged IDs
echo   - Emails: Synced from MongoDB
echo   - Analytics: Calculated
echo.
echo Git Operations:
echo   - Excel files: Committed
echo   - JSON data: Committed
echo   - Changes: Pushed to remote repository
echo.
echo [DEPLOYMENT] Changes should now be live on Vercel!
echo.
echo.

pause
