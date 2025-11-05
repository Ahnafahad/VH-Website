# VH Website Threshold System Documentation

## Overview

The Threshold System is an advanced pass/fail mechanism that ensures fair evaluation of test results by dynamically adjusting section thresholds based on class performance. It guarantees that at least 20% of students pass each test while maintaining academic standards.

## Key Features

### 1. **40% Initial Threshold**
- All sections start with a **40% threshold** (maximum)
- Thresholds can **only be lowered**, never raised
- Ensures minimum academic standards

### 2. **20% Minimum Pass Rate**
- At least **20% of students must pass** each test (rounded up)
- For 24 students: minimum 5 must pass
- For 10 students: minimum 2 must pass

### 3. **Essay Threshold (Fixed)**
- Essay sections **always remain at 40%** (never adjusted)
- Ensures writing quality standards are maintained
- Cannot be compromised for pass rate

### 4. **Section-Based Evaluation**
- Students must **pass ALL sections** to pass overall
- Each section evaluated independently with its own threshold
- One failed section = overall failure

### 5. **Intelligent Ranking**
- **Passed students** ranked first (green)
- **Failed students** ranked after (red)
- Failed students cannot outrank passed students

### 6. **Threshold Rounding**
- All calculated thresholds rounded to **nearest 0.25**
- Example: 37.8% → 37.75%, 28.89% → 28.75%

## How It Works

### Algorithm Flow

```
1. Start with all sections at 40% threshold
   ├─ Calculate how many students pass all sections
   └─ Check if ≥20% pass

2. If <20% pass:
   ├─ Identify top 20% students by total score
   ├─ Find minimum score for each section among these students
   ├─ Set thresholds to these minimum scores (≤40%)
   └─ Round thresholds down to nearest 0.25

3. Recalculate pass/fail status with new thresholds

4. Assign rankings:
   ├─ Passed students: Rank 1, 2, 3... (green)
   └─ Failed students: Rank 6, 7, 8... (red)
```

### Example Scenarios

#### Scenario 1: No Adjustment Needed
```
Test: English Test 2
Students: 24 (need 5 to pass)
Initial thresholds: 40% for all sections

Results at 40%:
- 9 students pass all sections ✅

Outcome: No adjustment needed
Final thresholds: 40% (all sections)
```

#### Scenario 2: Adjustment Required
```
Test: Mathematics CT 2
Students: 24 (need 5 to pass)
Initial thresholds: 40%

Results at 40%:
- Only 2 students pass ❌

Adjustment:
- Identify top 5 students
- Student #5 scored 28.89% in Section 1
- Lower Section 1 threshold to 28.89%
- Round down: 28.75%

Final thresholds:
- Section 1: 28.75% (adjusted)
```

#### Scenario 3: Essay Constraint
```
Test: English Test 1
Students: 23 (need 5 to pass)

Initial Results:
- Section 1: Many students above 40%
- Essay: All students scored 0% ❌

Adjustment Attempt:
- Lower Section 1 to 26%
- Essay stays at 40% (fixed)

Final Result:
- 0 students pass (all fail essay)
- Essay threshold cannot be lowered
```

## Applicable Tests

The threshold system applies to tests starting with:
- **English*** (English Test 1, English Quiz 3, etc.)
- **Mathematics*** (Mathematics CT 1, Maths Diagnostic, etc.)
- **Analytical*** (Analytical Reasoning, etc.)

**Not applicable to:**
- DU FBS Admission Test
- General Knowledge Quiz
- Other custom tests

## Data Structure

### Test Results with Thresholds

```typescript
interface TestResult {
  rank: number;
  rankStatus: 'passed' | 'failed'; // Color coding
  passedAll: boolean;              // Overall pass/fail
  failedSections: string[];        // List of failed sections

  sections: {
    [sectionId: string]: {
      percentage: number;
      threshold: number;           // Section-specific threshold
      passed: boolean;
    };
  };

  essayThreshold?: number;         // Always 40%
  essayPassed?: boolean;
}
```

### Class Statistics

```typescript
interface ClassStats {
  sectionThresholds: {
    [sectionId: string]: number;
  };
  essayThreshold?: number;          // Always 40%
  thresholdsAdjusted: boolean;      // Were thresholds lowered?
  passedStudents: number;           // Count of passed students
  failedStudents: number;           // Count of failed students
}
```

## UI Components

### 1. ThresholdResultCard
Displays comprehensive pass/fail status:

**For Passed Students (Green):**
- ✅ PASSED banner with green background
- Green-bordered rank card showing "Qualified"
- Section-by-section breakdown with green checkmarks
- Progress bars showing performance vs threshold

**For Failed Students (Red):**
- ❌ FAILED banner with red background
- Red-bordered rank card showing "Not Qualified"
- Failed sections highlighted in red with X marks
- Warning message about passing requirements

### 2. Rank Display
Color-coded ranking system:
- **Green**: Passed students (Qualified)
- **Red**: Failed students (Not Qualified)
- **Neutral**: Tests without threshold logic

### 3. Section Breakdown
Each section shows:
- Score vs Threshold comparison
- Pass/Fail indicator
- Visual progress bar
- Color-coded status (green/red)

## Processing Output

When running `node scripts/process-results.js`:

```
🎯 Applying threshold logic to Mathematics CT 2
📊 Calculating thresholds for 24 students (need 5 to pass)
⚙️ Only 2 students pass at 40% - adjusting thresholds...
  Section 1: Adjusted to 28.89% (min score: 28.89%)
✅ Final thresholds: {"1":28.75} - 5 students pass
    ✅ Thresholds: {"1":28.75} | 5 passed, 19 failed
```

## Academic Benefits

### 1. **Fairness**
- Ensures consistent pass rates across tests
- Prevents entire classes from failing due to difficult exams
- Maintains academic rigor through minimum standards

### 2. **Transparency**
- Students see exact thresholds for each section
- Clear pass/fail indicators
- Understand why they passed or failed

### 3. **Motivation**
- Passed students receive recognition (green, qualified)
- Failed students know exactly what to improve
- Section-specific feedback guides study efforts

### 4. **Quality Control**
- Essay standards never compromised (fixed 40%)
- Minimum 40% baseline for all sections
- Only adjusts when necessary

## Best Practices

### For Test Creators
1. Design tests with 40% as target passing score
2. Ensure essay questions are fair and achievable
3. Balance section difficulty across the test
4. Review threshold adjustments to improve future tests

### For Students
1. Focus on passing ALL sections (not just total score)
2. Pay special attention to essay preparation (40% fixed)
3. Understand that rankings prioritize pass status
4. Use section breakdown to identify weak areas

### For Administrators
1. Monitor threshold adjustments across tests
2. Investigate tests requiring significant adjustments
3. Use pass/fail data to improve curriculum
4. Review essay performance separately

## Technical Implementation

### Files Modified
- `scripts/threshold-calculator.js` - Core algorithm
- `scripts/excel-processor.js` - Integration logic
- `src/types/results.ts` - Type definitions
- `src/components/ThresholdResultCard.tsx` - UI component
- `src/app/results/test/[testName]/page.tsx` - Results display

### Testing
Run comprehensive tests:
```bash
node scripts/test-threshold-system.js
```

### Processing
Generate results with thresholds:
```bash
node scripts/process-results.js
```

## Troubleshooting

### Issue: No thresholds showing
**Solution:** Verify test name starts with "English", "Mathematics", or "Analytical"

### Issue: All students failing
**Check:** Essay scores - if all students score <40% in essays, none can pass

### Issue: Threshold seems wrong
**Verify:**
1. At least 20% pass overall?
2. Thresholds rounded to 0.25?
3. Essay threshold at 40%?

## Future Enhancements

1. **Configurable pass rate** (currently fixed at 20%)
2. **Admin threshold override** capability
3. **Historical threshold tracking** and analytics
4. **Threshold prediction** based on past tests
5. **Custom threshold rules** per test type

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Status:** ✅ Fully Implemented and Tested
