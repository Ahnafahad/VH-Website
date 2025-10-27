# IBA Mock Test 4 - Sample Results Page

## Overview
This folder contains the source data and generated sample results for **IBA Mock Test 4**, showcasing the VH Website results system with a rank 3 student's performance.

## 🎯 Purpose
- Demonstrate the complete results page functionality
- Provide a realistic sample for stakeholders and testing
- Hidden from main navigation (accessible only via direct URL)

## 📁 Files

### Source Files
- **OMR_Results IBA Mock 4.xlsx** - Original test data (reference)
- **sample-results-page.html** - Static HTML mockup (reference design)

### Generated Data
All test data is stored in `/public/data/`:
- `full-tests.json` - Contains "IBA Mock Test 4" test entry
- `students.json` - Contains Mahmud Rahman's student profile
- `metadata.json` - Updated with new test count

## 👤 Sample Student Profile

**Name:** Mahmud Rahman
**ID:** 166388
**Email:** mahmud.rahman.sample@example.com
**Rank:** 3 out of 20 students (85th percentile)

### Performance Summary
- **Total Score:** 35/70 correct (50% overall)
- **Total Marks:** 32.0 (after negative marking)
- **Accuracy:** 74.47% (when attempted)

### Section Breakdown

| Section | Correct | Wrong | Skipped | Total | Accuracy | Attempt Rate |
|---------|---------|-------|---------|-------|----------|--------------|
| **English** | 13 | 7 | 10 | 30 | 65.0% | 66.7% |
| **Mathematics** | 14 | 4 | 7 | 25 | 77.8% | 72.0% |
| **Analytical** | 8 | 1 | 6 | 15 | 88.9% | 60.0% |

## 🔗 Access URLs

### Hidden Demo Page
```
https://yourdomain.com/mocksample
```
This page automatically redirects to the full test results page.

### Direct Test Results Page
```
https://yourdomain.com/results/test/IBA%20Mock%20Test%204
```
This is the actual dynamic route that displays all test analytics.

### Important Notes
- **No navigation links** - Page is intentionally hidden from menus and headers
- **Public but unlisted** - Can be accessed directly via URL
- **Demonstrates full functionality** - Shows all charts, analytics, and comparisons
- **Realistic data** - Generated with 20 students, proper ranking, and class statistics

## 📊 Class Statistics

- **Total Students:** 20
- **Class Average:** 23.27 marks
- **Top 5 Average:** 31.4 marks
- **Pass Rate:** Based on threshold calculations
- **Percentile Range:** Students distributed realistically

## 🎨 Features Demonstrated

The sample page showcases:

### Performance Overview
- ✅ Overall rank and percentile
- ✅ Total correct answers
- ✅ Accuracy percentage
- ✅ Section-wise breakdown

### Analytics & Charts
- ✅ Percentile distribution chart
- ✅ Progress trend over test series
- ✅ Performance comparison with class
- ✅ Top 5 leaderboard

### Advanced Features
- ✅ Question difficulty analysis (Top questions right/wrong/skipped)
- ✅ Personal performance vs class top questions
- ✅ Skip strategy and recovery scores
- ✅ Section-wise analytics

### Interactive Elements
- ✅ Responsive design
- ✅ Hover effects and animations
- ✅ Mobile-friendly charts
- ✅ Clean, professional UI

## 🛠️ Technical Implementation

### Data Generation
Generated using `generate_mock_data.py` which creates:
- 20 realistic student results
- Proper rank distribution
- Section-wise performance data
- Individual question responses (format: "A (C)", "B (W)", "NAN")
- Top questions analysis
- Class statistics

### Integration
- Uses existing dynamic route: `/results/test/[testName]/page.tsx`
- No code modifications needed for core functionality
- Data-driven approach - just added JSON entries
- Follows established TypeScript interfaces

### Route Structure
```
/mocksample (hidden redirect page)
    ↓
/results/test/IBA%20Mock%20Test%204 (dynamic route)
    ↓
Fetches data from /public/data/full-tests.json
```

## 📝 Usage Scenarios

### For Demonstrations
Share the `/mocksample` URL with:
- Potential clients
- Stakeholders
- Investors
- Educational partners

### For Testing
Use to verify:
- Mobile responsiveness
- Chart rendering
- Analytics calculations
- UI/UX flow

### For Development
Reference for:
- Data structure patterns
- Result page features
- Test data format
- Student profile setup

## 🔒 Privacy Note

All data in this sample is **fictional** and for **demonstration purposes only**:
- Student ID 166388 is not a real student
- Email address is a sample placeholder
- Test results are algorithmically generated
- No real student information is used

## 🚀 Next Steps

To create additional sample tests:
1. Modify `generate_mock_data.py` with new test data
2. Run: `python generate_mock_data.py`
3. Create new redirect page in `/src/app/[sample-name]/`
4. Access via new URL

## 📞 Support

For questions about the sample page implementation:
- Check `/src/app/results/test/[testName]/page.tsx` for page logic
- Review `/src/types/results.ts` for data structure
- See git commit: `ee61cf1` for complete changeset

---

**Generated:** January 2025
**Test Name:** IBA Mock Test 4
**System:** VH Website Results Platform
**Framework:** Next.js 14 with TypeScript
