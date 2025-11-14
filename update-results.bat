@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  VH Results Update System
echo ========================================
echo.

:: Change to script directory
cd /d "%~dp0"

:: Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Not a git repository!
    echo Please run this script from the VH Website root directory.
    pause
    exit /b 1
)

:: Show Results folder status
echo [1/6] Checking Results folder for changes...
echo ----------------------------------------
echo Detecting changes in Excel files (including cell value changes)...
echo.

git status Results/ --short

:: Check if there are any changes
git diff --quiet Results/
if errorlevel 1 (
    echo.
    echo [CHANGES DETECTED] Excel files have been modified!
    echo Git will track all changes including individual cell modifications.
) else (
    git diff --cached --quiet Results/
    if errorlevel 1 (
        echo.
        echo [STAGED CHANGES] Changes are already staged.
    ) else (
        echo.
        echo [NO CHANGES] No modifications detected in Results folder.
        set /p CONTINUE="Continue processing anyway? (Y/N): "
        if /i not "!CONTINUE!"=="Y" (
            echo.
            echo [CANCELLED] Update cancelled - no changes to process.
            pause
            exit /b 0
        )
    )
)

echo.
:: Ask for confirmation
set /p CONFIRM="Do you want to process the Results folder and push to remote? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo [CANCELLED] Update cancelled by user.
    pause
    exit /b 0
)

echo.
echo [2/6] Processing IBA Excel files...
echo ----------------------------------------

:: Run the process-results script (IBA tests)
node scripts/process-results.js

:: Check if processing was successful
if errorlevel 1 (
    echo.
    echo [ERROR] IBA Processing failed!
    echo Please check the error messages above and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/6] Processing FBS Mock files...
echo ----------------------------------------

:: Run the FBS mock processor
node scripts/process-fbs-mocks.js

:: Check if processing was successful
if errorlevel 1 (
    echo.
    echo [ERROR] FBS Mock Processing failed!
    echo Please check the error messages above and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo [4/7] Syncing student emails from database...
echo ----------------------------------------

:: Load MONGODB_URI from .env.local if it exists
set MONGODB_URI=
if exist .env.local (
    for /f "tokens=2 delims==" %%a in ('findstr /i "MONGODB_URI" .env.local') do set MONGODB_URI=%%a
)

:: Sync student emails from MongoDB to students.json
if defined MONGODB_URI (
    node scripts/sync-student-emails.js
    if errorlevel 1 (
        echo.
        echo [WARNING] Email sync failed, but continuing...
    )
) else (
    echo [WARNING] MONGODB_URI not found in .env.local, skipping email sync...
)

echo.
echo [5/7] Staging all processed files...
echo ----------------------------------------
echo Staging JSON data files...
git add public/data/
echo Staging Results folder (Excel files with changes)...
git add Results/

echo.
echo [6/7] Committing changes...
echo ----------------------------------------

:: Create commit with timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set DATE=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set TIME=%%a:%%b)

git commit -m "Update test results data - %DATE% %TIME%" -m "" -m "🤖 Generated with VH Results Processing System" -m "" -m "- Processed Excel files from Results/ folder" -m "- Generated optimized JSON files for Vercel deployment" -m "- Updated IBA tests, FBS mocks, and student data" -m "- Committed Excel file changes (including cell modifications)"

:: Check if commit was successful (may have nothing to commit)
if errorlevel 1 (
    echo.
    echo [WARNING] No changes to commit or commit failed
    set /p CONTINUE="Continue with push anyway? (Y/N): "
    if /i not "!CONTINUE!"=="Y" (
        echo.
        echo [CANCELLED] Push cancelled
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
echo [SUCCESS] All changes have been:
echo   - IBA Tests: Processed and updated
echo   - FBS Mocks: Processed and updated
echo   - JSON files: Generated in public/data/
echo   - Committed to git
echo   - Pushed to remote repository
echo.
echo The changes should now be live on Vercel!
echo.
echo Files updated:
echo   - public/data/simple-tests.json
echo   - public/data/full-tests.json
echo   - public/data/mock-tests.json
echo   - public/data/fbs-mock-tests.json
echo   - public/data/students.json
echo   - public/data/metadata.json
echo.

pause
