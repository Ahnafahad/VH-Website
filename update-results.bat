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
echo [1/5] Checking Results folder status...
git status Results/ --short
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
echo [2/5] Processing Excel files...
echo ----------------------------------------

:: Run the process-results script with commit and push flags
node scripts/process-results.js --commit --push

:: Check if processing was successful
if errorlevel 1 (
    echo.
    echo [ERROR] Processing failed!
    echo Please check the error messages above and try again.
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
echo   - Processed (Excel to JSON)
echo   - Committed to git
echo   - Pushed to remote repository
echo.
echo The changes should now be live on Vercel!
echo.

pause
