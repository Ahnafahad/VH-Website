# Graph Report - src  (2026-04-26)

## Corpus Check
- 309 files · ~254,828 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 797 nodes · 791 edges · 32 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 112 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Vocab API & Data Services|Vocab API & Data Services]]
- [[_COMMUNITY_Admin Routes & SRS Logic|Admin Routes & SRS Logic]]
- [[_COMMUNITY_Auth & Access Control|Auth & Access Control]]
- [[_COMMUNITY_Mock Tests & Results|Mock Tests & Results]]
- [[_COMMUNITY_FBS Accounting & Math Games|FBS Accounting & Math Games]]
- [[_COMMUNITY_Admin Vocab Management|Admin Vocab Management]]
- [[_COMMUNITY_Math Adaptive Engine|Math Adaptive Engine]]
- [[_COMMUNITY_AI Quiz Generator|AI Quiz Generator]]
- [[_COMMUNITY_Vocab Profile Screen|Vocab Profile Screen]]
- [[_COMMUNITY_Admin Users Client|Admin Users Client]]
- [[_COMMUNITY_SRS Priority Scoring|SRS Priority Scoring]]
- [[_COMMUNITY_Admin Leaderboard UI|Admin Leaderboard UI]]
- [[_COMMUNITY_Vocab Study & Review|Vocab Study & Review]]
- [[_COMMUNITY_Leaderboard Admin Page|Leaderboard Admin Page]]
- [[_COMMUNITY_Vocab Quiz Game|Vocab Quiz Game]]
- [[_COMMUNITY_Vocab Onboarding|Vocab Onboarding]]
- [[_COMMUNITY_Workbook Shell & Progress|Workbook Shell & Progress]]
- [[_COMMUNITY_Markdown & Rich Text|Markdown & Rich Text]]
- [[_COMMUNITY_Audio Unlock|Audio Unlock]]
- [[_COMMUNITY_Word Mastery Scoring|Word Mastery Scoring]]
- [[_COMMUNITY_Registration Flow|Registration Flow]]
- [[_COMMUNITY_Daily Message Generator|Daily Message Generator]]
- [[_COMMUNITY_Distractor Selection|Distractor Selection]]
- [[_COMMUNITY_Workbook Chapter Nav|Workbook Chapter Nav]]
- [[_COMMUNITY_VH Brand Identity|VH Brand Identity]]
- [[_COMMUNITY_Vocab Leaderboard Page|Vocab Leaderboard Page]]
- [[_COMMUNITY_Char Counter UI|Char Counter UI]]
- [[_COMMUNITY_Particle Background|Particle Background]]
- [[_COMMUNITY_Badge Component|Badge Component]]
- [[_COMMUNITY_Quiz Prefetch Cache|Quiz Prefetch Cache]]
- [[_COMMUNITY_Blur Fade Animation|Blur Fade Animation]]
- [[_COMMUNITY_Push Notifications|Push Notifications]]

## God Nodes (most connected - your core abstractions)
1. `POST()` - 63 edges
2. `GET()` - 62 edges
3. `requireAdmin()` - 20 edges
4. `PATCH()` - 20 edges
5. `DELETE()` - 13 edges
6. `computePriorityScore()` - 9 edges
7. `getCachedUser()` - 8 edges
8. `fetchData()` - 7 edges
9. `validateAuth()` - 7 edges
10. `safeApiHandler()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `computeAccessFromProducts()`  [INFERRED]
  D:\VH Website\vh-website\src\app\api\workbook\progress\route.ts → D:\VH Website\vh-website\src\lib\db-access-control.ts
- `getUserById()` --calls--> `GET()`  [INFERRED]
  D:\VH Website\vh-website\src\lib\db-access-control.ts → D:\VH Website\vh-website\src\app\api\workbook\progress\route.ts
- `toggleProduct()` --calls--> `DELETE()`  [INFERRED]
  D:\VH Website\vh-website\src\components\admin\UsersClient.tsx → D:\VH Website\vh-website\src\app\api\admin\words\[id]\route.ts
- `POST()` --calls--> `Home()`  [INFERRED]
  D:\VH Website\vh-website\src\app\api\workbook\progress\route.ts → D:\VH Website\vh-website\src\app\page.tsx
- `fetchHallOfFame()` --calls--> `GET()`  [INFERRED]
  D:\VH Website\vh-website\src\app\admin\leaderboard\page.tsx → D:\VH Website\vh-website\src\app\api\workbook\progress\route.ts

## Communities

### Community 0 - "Vocab API & Data Services"
Cohesion: 0.04
Nodes (23): checkBadges(), getCachedBadges(), ensureDailyLoginAwarded(), _getHomeData(), getLetterIndex(), getLetterWords(), OnboardingGate(), AdminUsersPage() (+15 more)

### Community 1 - "Admin Routes & SRS Logic"
Cohesion: 0.05
Nodes (14): canAccessTheme(), canAccessWord(), filterAccessibleWordIds(), getUserPhase(), maxIntervalForDeadline(), sendAdminAnnouncement(), sendFreeSignupNotification(), sendRegistrationNotification() (+6 more)

### Community 2 - "Auth & Access Control"
Cohesion: 0.06
Nodes (24): ApiException, createErrorResponse(), safeApiHandler(), validateAuth(), clearAccessControlCache(), computeAccessFromProducts(), fetchUserWithProducts(), getCachedUser() (+16 more)

### Community 3 - "Mock Tests & Results"
Cohesion: 0.08
Nodes (12): calculateClassStats(), calculateUserStats(), fetchData(), generateStudentSummaries(), getChartUserEmail(), grantAccess(), handleStudentSelection(), loadData() (+4 more)

### Community 4 - "FBS Accounting & Math Games"
Cohesion: 0.08
Nodes (14): calculateDynamicScore(), calculateLectureCoverageBonus(), calculateSimpleScore(), fetchLeaderboard(), generateQuestionResults(), getAccountingQuestions(), getQuestionsByLectures(), shuffleArray() (+6 more)

### Community 5 - "Admin Vocab Management"
Cohesion: 0.08
Nodes (8): closeModal(), handleCutoffSave(), handleFileInput(), handleSaveWord(), handleThresholdSave(), handleUltimateToggle(), onDrop(), showToast()

### Community 6 - "Math Adaptive Engine"
Cohesion: 0.12
Nodes (17): bucketDifficulty(), applyAttempt(), chooseNextQuestion(), clamp(), expectedWin(), genByTier(), generateQuestion(), pickNextOperation() (+9 more)

### Community 7 - "AI Quiz Generator"
Cohesion: 0.22
Nodes (8): buildPrompt(), callDeepSeek(), callGemini(), generateQuizQuestions(), parseAIResponse(), pickQuestionTypes(), resolveStudentLevel(), buildSession()

### Community 8 - "Vocab Profile Screen"
Cohesion: 0.2
Nodes (4): cancelEdit(), daysUntil(), saveDeadline(), saveEdit()

### Community 9 - "Admin Users Client"
Cohesion: 0.21
Nodes (5): handleSaveProducts(), handleSaveRole(), handleSuspendToggle(), showToast(), toggleProduct()

### Community 10 - "SRS Priority Scoring"
Cohesion: 0.35
Nodes (9): clamp01(), computePriorityScore(), daysSince(), factorAccuracy(), factorDaysSinceLastSeen(), factorExposure(), factorMasteryLevel(), factorSrsOverdue() (+1 more)

### Community 12 - "Admin Leaderboard UI"
Cohesion: 0.25
Nodes (2): avatarBg(), UserAvatar()

### Community 14 - "Vocab Study & Review"
Cohesion: 0.25
Nodes (4): ReviewStudyPage(), StudyPage(), getReviewData(), getReviewWords()

### Community 16 - "Leaderboard Admin Page"
Cohesion: 0.6
Nodes (5): AdminLeaderboardPage(), fetchAllTimeLeaderboard(), fetchHallOfFame(), fetchWeeklyLeaderboard(), toIso()

### Community 17 - "Vocab Quiz Game"
Cohesion: 0.4
Nodes (2): cleanResponse(), generateQuestions()

### Community 18 - "Vocab Onboarding"
Cohesion: 0.33
Nodes (2): finish(), defaultDeadline()

### Community 19 - "Workbook Shell & Progress"
Cohesion: 0.4
Nodes (3): handleAnchorChange(), handleComplete(), updateProgress()

### Community 22 - "Markdown & Rich Text"
Cohesion: 0.47
Nodes (4): renderMath(), segmentContent(), parseMarkdown(), RichText()

### Community 23 - "Audio Unlock"
Cohesion: 0.47
Nodes (3): beep(), getCtx(), unlockAudio()

### Community 24 - "Word Mastery Scoring"
Cohesion: 0.53
Nodes (4): exposureDelta(), flashcardDelta(), masteryLevel(), quizDelta()

### Community 25 - "Registration Flow"
Cohesion: 0.4
Nodes (1): handleSubmit()

### Community 28 - "Daily Message Generator"
Cohesion: 0.7
Nodes (4): generateFromTemplate(), generateWithDeepSeek(), getDailyMessage(), getUserStats()

### Community 29 - "Distractor Selection"
Cohesion: 0.6
Nodes (4): classifyTier(), selectDistractors(), shuffle(), synonymOverlap()

### Community 30 - "Workbook Chapter Nav"
Cohesion: 0.5
Nodes (2): getAdjacentChapters(), getAllChapters()

### Community 31 - "VH Brand Identity"
Cohesion: 0.7
Nodes (5): VH Brand Identity, Education Platform, Graduation Cap Symbol, Red, Black, Gold Color Palette, VH App Icon

### Community 34 - "Vocab Leaderboard Page"
Cohesion: 0.5
Nodes (2): getLeaderboardData(), LeaderboardPage()

### Community 36 - "Char Counter UI"
Cohesion: 0.67
Nodes (2): CharCounter(), counterColor()

### Community 39 - "Particle Background"
Cohesion: 0.83
Nodes (3): hexToRgb(), MousePosition(), Particles()

### Community 42 - "Badge Component"
Cohesion: 0.5
Nodes (2): Badge(), cn()

### Community 44 - "Quiz Prefetch Cache"
Cohesion: 0.83
Nodes (3): buildKey(), consumePrefetch(), prefetchQuiz()

### Community 56 - "Blur Fade Animation"
Cohesion: 1.0
Nodes (2): BlurFade(), getFilter()

### Community 65 - "Push Notifications"
Cohesion: 1.0
Nodes (2): sendPushToAllSubscribed(), sendPushToUser()

## Knowledge Gaps
- **Thin community `Admin Leaderboard UI`** (9 nodes): `LeaderboardClient.tsx`, `avatarBg()`, `fn()`, `formatDate()`, `formatPts()`, `getInitials()`, `handleConfirm()`, `handleNext()`, `UserAvatar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vocab Quiz Game`** (6 nodes): `page.tsx`, `cleanResponse()`, `fetchLeaderboard()`, `generateQuestions()`, `handleAnswerSelect()`, `resetQuiz()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vocab Onboarding`** (6 nodes): `OnboardingFlow.tsx`, `StepDeadline.tsx`, `finish()`, `defaultDeadline()`, `formatDate()`, `wordsPerDay()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Registration Flow`** (5 nodes): `page.tsx`, `page.tsx`, `handleSubmit()`, `toggleFull()`, `toggleMock()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Workbook Chapter Nav`** (5 nodes): `getAdjacentChapters()`, `getAllChapters()`, `getChapterMeta()`, `loadChapter()`, `chapters.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vocab Leaderboard Page`** (4 nodes): `page.tsx`, `getLeaderboardData()`, `leaderboard-data.ts`, `LeaderboardPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Char Counter UI`** (4 nodes): `CharCounter()`, `counterColor()`, `onKey()`, `AnnouncementsClient.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Badge Component`** (4 nodes): `Badge()`, `badge.tsx`, `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Blur Fade Animation`** (3 nodes): `BlurFade()`, `getFilter()`, `blur-fade.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Push Notifications`** (3 nodes): `push-notify.ts`, `sendPushToAllSubscribed()`, `sendPushToUser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Vocab API & Data Services` to `Admin Routes & SRS Logic`, `Auth & Access Control`, `FBS Accounting & Math Games`, `Math Adaptive Engine`, `AI Quiz Generator`, `Leaderboard Admin Page`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `POST()` connect `Admin Routes & SRS Logic` to `Vocab API & Data Services`, `Auth & Access Control`, `FBS Accounting & Math Games`, `AI Quiz Generator`, `Word Mastery Scoring`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `weakestOperation()` connect `Math Adaptive Engine` to `Vocab API & Data Services`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 26 inferred relationships involving `POST()` (e.g. with `Home()` and `validateAuth()`) actually correct?**
  _`POST()` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 23 inferred relationships involving `GET()` (e.g. with `fetchHallOfFame()` and `fetchInitialUsers()`) actually correct?**
  _`GET()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `PATCH()` (e.g. with `safeApiHandler()` and `validateAuth()`) actually correct?**
  _`PATCH()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `DELETE()` (e.g. with `safeApiHandler()` and `validateAuth()`) actually correct?**
  _`DELETE()` has 8 INFERRED edges - model-reasoned connections that need verification._