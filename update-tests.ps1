# ==========================================
# VH Website - Test Data Update Script (PowerShell)
# ==========================================
# This script processes Excel test files and updates the website data
# Run this whenever test files are added or updated

param(
    [switch]$Silent,
    [switch]$SkipCleanup,
    [string]$TestDataPath = "docs/test-data"
)

# Set execution policy for current process
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "VH Website - Test Update Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Set paths
$ProjectRoot = $PSScriptRoot
$TestDataDir = Join-Path $ProjectRoot $TestDataPath
$ResultsDir = Join-Path $ProjectRoot "Results"
$PublicDataDir = Join-Path $ProjectRoot "public/data"
$ScriptsDir = Join-Path $ProjectRoot "scripts"

# Function to display status
function Write-Status {
    param([string]$Message, [string]$Status = "INFO")

    $color = switch ($Status) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        default { "White" }
    }

    $symbol = switch ($Status) {
        "SUCCESS" { "✅" }
        "ERROR" { "❌" }
        "WARNING" { "⚠️" }
        default { "ℹ️" }
    }

    Write-Host "$symbol $Message" -ForegroundColor $color
}

try {
    # Check Node.js installation
    Write-Host "[1/6] Checking Node.js installation..." -ForegroundColor Yellow
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Status "Node.js is not installed or not in PATH" "ERROR"
        Write-Status "Please install Node.js from https://nodejs.org/" "ERROR"
        exit 1
    }
    Write-Status "Node.js found: $nodeVersion" "SUCCESS"

    # Check test data directory
    Write-Host "[2/6] Checking test data directory..." -ForegroundColor Yellow
    if (-not (Test-Path $TestDataDir)) {
        Write-Status "Test data directory not found: $TestDataDir" "ERROR"
        Write-Status "Please ensure test files are in the $TestDataPath folder" "ERROR"
        exit 1
    }
    Write-Status "Test data directory found" "SUCCESS"

    # Create Results directory if needed
    Write-Host "[3/6] Setting up processing directories..." -ForegroundColor Yellow
    if (-not (Test-Path $ResultsDir)) {
        New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null
        Write-Status "Created Results directory" "SUCCESS"
    } else {
        Write-Status "Results directory exists" "SUCCESS"
    }

    # Copy test files
    Write-Host "[4/6] Copying test files for processing..." -ForegroundColor Yellow
    $excelFiles = Get-ChildItem -Path $TestDataDir -Filter "*.xlsx"
    if ($excelFiles.Count -eq 0) {
        Write-Status "No Excel files found in $TestDataDir" "WARNING"
    } else {
        foreach ($file in $excelFiles) {
            Copy-Item $file.FullName -Destination $ResultsDir -Force
        }
        Write-Status "Copied $($excelFiles.Count) Excel file(s) for processing" "SUCCESS"
    }

    # Process Excel files
    Write-Host "[5/6] Processing Excel files..." -ForegroundColor Yellow
    Write-Host "Running Excel processor..." -ForegroundColor Gray

    Push-Location $ProjectRoot
    $processResult = & node "$ScriptsDir/excel-processor.js" 2>&1
    $processExitCode = $LASTEXITCODE
    Pop-Location

    if ($processExitCode -ne 0) {
        Write-Status "Excel processing failed" "ERROR"
        Write-Host $processResult -ForegroundColor Red
        exit 1
    }
    Write-Status "Excel files processed successfully" "SUCCESS"

    # Update access control
    Write-Host "[6/8] Updating access control..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    $accessResult = & node "$ScriptsDir/generate-access-control.js" 2>&1
    $accessExitCode = $LASTEXITCODE
    Pop-Location

    if ($accessExitCode -ne 0) {
        Write-Status "Access control update failed (non-critical)" "WARNING"
    } else {
        Write-Status "Access control updated" "SUCCESS"
    }

    # Git operations - Add updated files
    Write-Host "[7/8] Adding updated files to git..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    $gitAddResult = & git add "public/data/*.json" 2>&1
    $gitAddExitCode = $LASTEXITCODE
    Pop-Location

    if ($gitAddExitCode -ne 0) {
        Write-Status "Git add failed - you may need to commit manually" "WARNING"
    } else {
        Write-Status "Files added to git staging" "SUCCESS"
    }

    # Git operations - Commit and push
    Write-Host "[8/8] Committing and pushing to GitHub..." -ForegroundColor Yellow
    Push-Location $ProjectRoot

    # Show git status
    & git status

    # Get commit message
    if (-not $Silent) {
        $commitMessage = Read-Host "Enter commit message (or press Enter for default)"
        if ([string]::IsNullOrWhiteSpace($commitMessage)) {
            $commitMessage = "Update test data with latest Excel files"
        }
    } else {
        $commitMessage = "Update test data with latest Excel files"
    }

    # Commit changes
    $gitCommitResult = & git commit -m $commitMessage 2>&1
    $gitCommitExitCode = $LASTEXITCODE

    if ($gitCommitExitCode -ne 0) {
        Write-Status "Git commit failed - possibly no changes to commit" "WARNING"
    } else {
        Write-Status "Changes committed successfully" "SUCCESS"

        # Push to GitHub
        Write-Host "Pushing to GitHub..." -ForegroundColor Gray
        $gitPushResult = & git push 2>&1
        $gitPushExitCode = $LASTEXITCODE

        if ($gitPushExitCode -ne 0) {
            Write-Status "Git push failed - you may need to push manually" "WARNING"
        } else {
            Write-Status "Changes pushed to GitHub successfully" "SUCCESS"
        }
    }

    Pop-Location

    # Cleanup
    if (-not $SkipCleanup) {
        Write-Host ""
        Write-Host "Cleaning up temporary files..." -ForegroundColor Gray
        if (Test-Path $ResultsDir) {
            Get-ChildItem -Path $ResultsDir -Filter "*.xlsx" | Remove-Item -Force -ErrorAction SilentlyContinue
            if ((Get-ChildItem -Path $ResultsDir).Count -eq 0) {
                Remove-Item -Path $ResultsDir -Force -ErrorAction SilentlyContinue
            }
        }
    }

    # Show completion status
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✅ Test Update Complete!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""

    Write-Host "Updated files:" -ForegroundColor White
    $dataFiles = @("simple-tests.json", "full-tests.json", "students.json", "metadata.json")
    foreach ($file in $dataFiles) {
        $filePath = Join-Path $PublicDataDir $file
        if (Test-Path $filePath) {
            Write-Status $file "SUCCESS"
        }
    }

    # Show summary if not silent
    if (-not $Silent) {
        Write-Host ""
        Write-Host "The website data has been updated with the latest test information." -ForegroundColor Cyan
        Write-Host "You can now test the changes locally or deploy to production." -ForegroundColor Cyan

        # Show metadata summary
        $metadataPath = Join-Path $PublicDataDir "metadata.json"
        if (Test-Path $metadataPath) {
            try {
                $metadata = Get-Content $metadataPath | ConvertFrom-Json
                Write-Host ""
                Write-Host "==========================================" -ForegroundColor Blue
                Write-Host "Test Processing Summary:" -ForegroundColor Blue
                Write-Host "==========================================" -ForegroundColor Blue
                Write-Host "Last Updated: $($metadata.lastUpdated)" -ForegroundColor White
                Write-Host "Total Tests Processed: $($metadata.totalTests)" -ForegroundColor White
                Write-Host "Simple Tests: $($metadata.simpleTestsCount)" -ForegroundColor White
                Write-Host "Full Tests: $($metadata.fullTestsCount)" -ForegroundColor White
                Write-Host "Total Students: $($metadata.totalStudents)" -ForegroundColor White
            } catch {
                Write-Status "Could not read metadata summary" "WARNING"
            }
        }
    }

} catch {
    Write-Status "An unexpected error occurred: $($_.Exception.Message)" "ERROR"
    exit 1
} finally {
    if (-not $Silent) {
        Write-Host ""
        Read-Host "Press Enter to continue"
    }
}