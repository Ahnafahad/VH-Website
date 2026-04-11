# PRD_claude.md — VH LexiCore Vocabulary App
# AI-Optimised Version of PRD v2.2
# For use with Claude Code — structured for acceptance-criteria-driven development
# April 2026

---

## TECH STACK (reference for all implementation decisions)
- Frontend: React + TypeScript + Tailwind CSS
- PWA: service worker, installable to home screen
- Backend: Node.js / Express (or Next.js full-stack)
- Database: PostgreSQL
- Auth: JWT + email verification
- AI: Google Gemini Flash (server-side only, key never exposed to client)
- Email: transactional email service (e.g. Resend or SendGrid)
- Hosting: self-hosted by product owner

---

## MODULE 1 — USER ROLES & ACCESS

### Acceptance Criteria

**AC-1.1 — Role definitions**
- GIVEN any visitor, WHEN they land on the app without an account, THEN they see only the registration/landing page
- GIVEN a registered learner in Phase 1, WHEN they log in, THEN they have full access to all 800 words and all features
- GIVEN a self-registered learner in Phase 2, WHEN they log in, THEN they can only access Units 1–8; Units 9+ show a lock icon
- GIVEN an Admin-upgraded Phase-2 learner, WHEN the Admin upgrades them, THEN full access is granted immediately without requiring re-login
- GIVEN a suspended user, WHEN they attempt to open the app, THEN their session terminates and they see a suspension screen

**AC-1.2 — Phase cut-off**
- GIVEN the Admin configures a cut-off date in the Admin Panel, WHEN that date passes, THEN self-registration still works but new users are Phase-2 access only
- GIVEN an existing Phase-1 user, WHEN the cut-off date passes, THEN their access is unaffected unless Admin explicitly suspends them

**AC-1.3 — Registration flow**
- GIVEN any visitor, WHEN they register, THEN they must provide: Full Name, Gmail address, WhatsApp number with country code, and accept Terms + Privacy Policy
- GIVEN a submitted registration, THEN a verification email is sent before account activation
- GIVEN a user who has not verified their email, WHEN they try to log in, THEN login is blocked with a "please verify your email" message
- GIVEN a Phase-2 self-registered user after verification, WHEN they first log in, THEN they see a prompt: "Want full access? Fill in this form and VH Beyond the Horizon will reach out."
- GIVEN the full-access request form, THEN it collects: Full Name, WhatsApp number, short message — and the submission appears in the Admin Panel

**AC-1.4 — Suspension**
- GIVEN Admin suspends a user, THEN their active session terminates within 5 seconds
- GIVEN a suspended user attempts login, THEN they see: "Your account has been suspended. Please contact VH Beyond the Horizon."
- GIVEN a suspended user, THEN they are hidden from all leaderboard displays
- GIVEN Admin reactivates a suspended user, THEN access is restored immediately; historical data (points, badges, progress) is fully preserved

---

## MODULE 2 — ONBOARDING

### Acceptance Criteria

**AC-2.1 — First login only**
- GIVEN a user's very first login after email verification, THEN the onboarding flow runs exactly once
- GIVEN any subsequent login, THEN onboarding is skipped entirely and user lands on home screen

**AC-2.2 — Deadline setting**
- GIVEN Step 2 of onboarding, THEN the app suggests a default deadline of 3 months from today, shown as a real date
- GIVEN the user changes the date, THEN the daily word count recalculates in real time: "That means you need to review approximately X words per day"
- GIVEN the user confirms a deadline, THEN it is stored and used for SRS scheduling immediately

**AC-2.3 — Tutorial**
- GIVEN Step 3 of onboarding, THEN 3 swipeable tutorial screens are shown with animated demos
- GIVEN the user taps Skip, THEN they go directly to the home screen with the onboarding marked complete

---

## MODULE 3 — HOME SCREEN

### Acceptance Criteria

**AC-3.1**
- GIVEN any logged-in user opening the app, THEN the home screen shows: streak counter, daily goal progress ring, due words count, points balance, Continue Studying card
- GIVEN a user with streak = 0, THEN the streak area shows "Start your streak today!" instead of a number
- GIVEN the user taps the due words card, THEN they are taken to Practice mode with today's SRS due words pre-selected
- GIVEN the user taps Continue Studying, THEN they resume from their last position, or go to the Study tab if no session exists
- GIVEN a user whose deadline has passed without completing all words, THEN a gentle banner appears: "Your target date has passed. Update your deadline to keep your study plan on track." with an Update Deadline button

---

## MODULE 4 — CONTENT STRUCTURE

### Data Model: Word Card
```
word: string
definition: string
synonyms: string[]
antonyms: string[]
example_sentence: string
part_of_speech: string
unit_id: FK
theme_id: FK
difficulty_base: integer (1–5)
```

### Hierarchy
```
Word Bank (~800 words)
└── Units (~15–20)
    └── Themes (~12–20 words each)
        └── Words
```

### Acceptance Criteria

**AC-4.1**
- GIVEN the Study tab, THEN all units are listed as collapsible rows showing: unit name, theme count, overall completion %
- GIVEN tapping a unit, THEN it expands to show all its themes as cards with: theme name, word count, status (Not Started / Flashcards Done / Quiz Pending / Complete)
- GIVEN a user in Phase 2 without full access, THEN Units 9+ show a lock icon and a "Request Full Access" button

**AC-4.2 — Theme unlocking**
- GIVEN a user completing a theme's Study quiz OR completing a Practice session covering that theme's words, THEN the next theme in that unit unlocks
- GIVEN a user who has not unlocked a theme, WHEN they tap it, THEN it does nothing (no navigation)
- No forced sequential order between units — users can start any unit freely

---

## MODULE 5 — FLASHCARD STUDY MODE

### Acceptance Criteria

**AC-5.1 — Session start**
- GIVEN a user tapping a theme card, IF they have a saved mid-session, THEN they see: "You left off at Card 7 of 15. Resume or Start Over?"
- GIVEN choosing Start Over, THEN session-level self-assessment ratings are discarded; SRS data from prior completed sessions is NOT affected

**AC-5.2 — Card interaction**
- GIVEN the front of a flashcard, THEN it shows: word (large), part of speech (small), "Tap to reveal" hint
- GIVEN the user taps the card, THEN it performs a 3D flip (rotateY, 400ms) revealing: definition, synonyms, antonyms, example sentence
- GIVEN the back face is shown, THEN three self-assessment chips appear: ✅ Got it / 🤔 Unsure / ❌ Missed it
- GIVEN tapping a chip, THEN the rating is recorded, the chip animates, and the next card loads automatically
- GIVEN the back arrow, THEN the user can navigate to the previous card and change their rating

**AC-5.3 — Session exit & resume**
- GIVEN the user closes the app mid-session, THEN progress is auto-saved at the exact card
- GIVEN returning to that theme, THEN resume prompt is shown

**AC-5.4 — Session complete**
- GIVEN the last card is rated, THEN a Session Complete screen shows: Got it / Unsure / Missed it counts, encouragement message, "Start Quiz" CTA
- GIVEN tapping "Do it later", THEN the theme shows "Quiz Pending" status; quiz can be launched from the theme card at any time
- The quiz CTA is always present — there is no way to skip the quiz entirely from the Session Complete screen (only defer it)

---

## MODULE 6 — WORD MASTERY SCORE SYSTEM

### Overview
Every (user × word) pair has a **living mastery score** that starts at 0, has **no ceiling**,
and decays over time without interaction. Lower-scoring words appear more frequently in
quizzes and practice. The score is the single source of truth for both SRS scheduling and
quiz word selection.

### 6.1 Score Contributions (Positive)

| Event | Points Added | Notes |
|---|---|---|
| Correct quiz answer | +10 | Highest weight — active recall under pressure |
| "Got it" flashcard rating | +2 | Self-reported; lower trust than quiz |
| Correct answer after 30+ day SRS gap | +15 bonus | On top of the +10; rewards long-term retention |
| Word exposure (seen as correct answer target) | +0.5 per session, capped +10 lifetime | Tiebreaker only; rewards familiarity |

### 6.2 Score Contributions (Negative)

| Event | Points Removed | Notes |
|---|---|---|
| Wrong quiz answer | −4 | Half the gain of a correct answer |
| Confusion penalty on Word A | −3 | Applied additionally to the correct answer word; total on wrong answer = −7 |
| Confusion penalty on Word B | −2 | Applied to the word the user incorrectly selected |
| "Missed it" flashcard rating | −1 | Self-reported; lighter penalty |
| "Unsure" flashcard rating | 0 | Neutral — no score change |

### 6.3 Confusion Event — Full Logic
GIVEN a quiz question where the correct answer is Word A AND the user selects Word B:
- Word A receives: −4 (wrong answer) + −3 (confusion penalty) = **−7 pts total**
- Word B receives: **−2 pts** + a confusion_pair entry is logged: `{word_a: "magnanimous", word_b: "benevolent", count: +1}`
- The confusion_pair is used to prioritise Word B as a distractor in future questions where Word A is the correct answer
- Both words' appearance frequency increases (lower score = higher draw probability)

### 6.4 Time Decay
- Grace period: **7 days** of no interaction before decay begins
- Decay rate: **−2% of current score per day** after the grace period
- Decay applies per word independently — each word tracks its own `last_interaction_at`
- Minimum score: 0 (score cannot go negative)
- Decay is calculated server-side on a daily cron job

**Example:** Word at 100 pts, untouched for 10 days:
- Days 1–7: no decay
- Day 8: −2 pts (100 × 2%)
- Day 9: −2 pts (98 × 2% ≈ 2)
- Day 10: −2 pts

### 6.5 Mastery Levels (milestones on the score scale)

| Level | Score Range | Display colour | Meaning |
|---|---|---|---|
| 🔴 New | 0 – 20 | Red | Never meaningfully studied (1–2 interactions) |
| 🟠 Learning | 21 – 60 | Orange | Building familiarity; first 3–4 weeks |
| 🟡 Familiar | 61 – 120 | Yellow | Answering correctly, needs reinforcement |
| 🔵 Strong | 121 – 200 | Blue | Reliable recall; some long-gap success |
| 🟢 Mastered | 201+ | Green | Long-term retention confirmed |

Score continues rising past 151 with no ceiling. Level is a milestone label, not a cap.

### 6.6 Appearance Frequency
- Every quiz/practice session ranks eligible words by mastery score (ascending)
- Lower score = higher draw probability using weighted random selection
- A word at 20 pts is approximately 5× more likely to appear than a word at 100 pts
- Mastered words (151+) are never excluded — they just appear rarely
- If all words in selected units are mastered, questions still generate from those words

### 6.7 Per (User × Word) Tracking Record
Updated after every quiz answer and every flashcard self-assessment:
```
mastery_score: float              — the living score (no ceiling, min 0)
mastery_level: enum               — New/Learning/Familiar/Strong/Mastered
last_interaction_at: timestamp    — used for decay calculation
last_seen_at: timestamp           — last appearance as correct answer
total_attempts: integer           — times appeared as correct answer
correct_attempts: integer         — correct answers across all sessions
accuracy_rate: float              — correct_attempts ÷ total_attempts
last_correct_at: timestamp
consecutive_correct: integer      — resets on any wrong answer
consecutive_wrong: integer        — resets on any correct answer
times_as_distractor: integer
confusion_pairs: map              — {word_id: count} of confusion events
srs_interval_days: integer        — current SRS spacing
flashcard_got_it_count: integer
flashcard_unsure_count: integer
flashcard_missed_it_count: integer
source_of_last_answer: enum       — study_quiz | practice_quiz
long_gap_correct: boolean         — answered correctly after 30+ day interval
```

---

## MODULE 7 — SPACED REPETITION ENGINE (SRE)

### Acceptance Criteria

**AC-7.1 — Pool entry**
- GIVEN a theme whose flashcard session the user has completed at least once, THEN all words in that theme enter the user's SRS pool
- GIVEN a word not yet in the SRS pool, THEN it is not scheduled for review

**AC-7.2 — SM-2 interval logic**

| Self-assessment | Interval change | Ease factor change |
|---|---|---|
| Got it | interval × ease_factor (rounded up) | +0.1 |
| Unsure | no change | −0.15 |
| Missed it | reset to 1 day | −0.2 (min 1.3) |

**AC-7.3 — Deadline scheduling**
- GIVEN the user's target deadline and current SRS pool, THEN the SRE calculates a daily review target shown on the home screen
- GIVEN the user ahead of schedule, THEN the daily target decreases
- GIVEN the user behind schedule, THEN the daily target increases
- GIVEN the user updates their deadline in Settings, THEN the schedule recalculates immediately

---

## MODULE 8 — AI QUIZ SYSTEM

### Acceptance Criteria

**AC-8.1 — Entry points**
- Study Quiz: auto-triggers after flashcard session completes; also accessible from theme card if status is "Quiz Pending"
- Practice Quiz: triggered from Practice tab after unit selection
- GIVEN either entry point, THEN a loading screen shows "Generating your quiz..." while the server calls Gemini

**AC-8.2 — Question types by level**

| Level | Unlocks when | Question type |
|---|---|---|
| Beginner | Day 1 | Fill-in-the-blank (5 options A–E) |
| Intermediate | 40% of all themes completed | Analogies |
| Advanced | 70% of all themes completed | Correct Usage (identify correct sentence) |

Once a level unlocks, all unlocked types are mixed. Proportion of harder questions increases with progress.

**AC-8.3 — Word selection: Study Quiz**
- All words in the current theme, equal weight — every word is tested

**AC-8.4 — Word selection: Practice Quiz**
Priority Score (0–100) per word:

| Factor | Weight | Logic |
|---|---|---|
| Days since last seen | 30% | 14+ days → near max. Today → near zero. |
| Accuracy rate | 30% | Low accuracy → high score |
| SRS overdue status | 20% | 3+ days overdue → large boost |
| Mastery score level | 15% | New/Learning → high. Mastered → low but never zero |
| Exposure count | 5% | Fewer exposures → small boost |

**AC-8.5 — Distractor selection (3-of-5 rule)**
- At least 3 of 5 options must genuinely confuse a student who doesn't know the precise meaning
- Tier 1 (target 2–3): semantic neighbours — same thematic cluster, synonyms, same POS + domain, + personalised confusion pairs
- Tier 2 (target 1–2): same unit, different theme
- Tier 3 (max 1): distant word from another unit
- Quality gate: if <3 options are Tier 1/2, replace Tier 3 with next-closest Tier 1/2
- Correct answer position randomised A–E every generation

**AC-8.6 — Personalised distractors**
- GIVEN a user has accumulated 10+ total quiz answers, THEN their confusion_pairs history is blended into Tier 1 distractor selection
- The more often a user confuses Word A with Word B, the higher Word B's distractor priority when Word A is the correct answer

**AC-8.7 — Difficulty progression within session**
- 2 consecutive correct → difficulty nudges up (more nuanced sentences, semantically closer Tier 1 distractors)
- 2 consecutive wrong → difficulty nudges down (more explicit sentences, Tier 3 distractor may return)

**AC-8.8 — No-repeat rules**
- Each word appears as correct answer at most once per session
- No question stem, sentence, or exact option set repeats within a session

**AC-8.9 — AI architecture**
- Model: Google Gemini Flash
- ALL calls server-side — API key never exposed to client
- Server handles all word selection + distractor logic
- Gemini's job: construct sentence/question only
- System prompt includes: correct-answer words with definitions/synonyms/antonyms/example sentences, pre-selected distractors, student level, difficulty setting, instructions to return valid JSON only, never reuse example sentence verbatim, place correct answer at specified random position
- On parse failure: auto-retry up to 2 times
- On all retries failed: show "Quiz unavailable right now. Please try again in a few minutes." — no progress lost

**AC-8.10 — Quiz interaction**
- One question at a time, full screen
- User taps option → it highlights with red glow; other options dim
- Confirm button appears after selection — must tap to proceed (prevents accidental taps)
- No going back after confirm
- Progress indicator shown (e.g., Q3 of 8)
- Min 5 questions, max 10 (scales with theme difficulty)
- No timer

**AC-8.11 — End of quiz**
- Summary screen shows: score, pass/fail (threshold 70%, Admin-configurable), every question with user's answer + correct answer + AI explanation
- CTA: "Continue" (unlocks next theme) + "Review Weak Words" (if any wrong — launches mini flashcard on wrong words only)
- Completion (regardless of score) unlocks next theme
- Passing (≥70%): full bonus points; failing but finishing: partial points

**AC-8.12 — Fail & retry**
- GIVEN score < 70%: summary shows weak words, Review Weak Words button, Retry Quiz button
- Retry generates a fresh quiz with accuracy_rate factor amplified for incorrectly answered words
- No retry limit

---

## MODULE 9 — PRACTICE MODE

### Acceptance Criteria

**AC-9.1**
- GIVEN Practice tab, THEN accessible once user has completed at least one theme's flashcard session
- GIVEN the unit selection screen, THEN user can select one or multiple studied units; Select All toggle available
- GIVEN starting practice, THEN generates AI quiz from all words in selected units using Priority Score system
- No flashcards shown — questions only from the first screen
- Sessions capped at 20 questions; user can start another session to continue
- Every correct answer tracked toward mastery score — identical logic to Study quiz
- Completing a practice session covering a theme's words unlocks the next theme in that unit

---

## MODULE 10 — POINTS SYSTEM

### Point values (all calculated server-side — client cannot manipulate)

| Action | Points |
|---|---|
| Complete a flashcard session | 10 |
| Correct fill-in-the-blank answer | 5 |
| Correct analogy answer | 10 |
| Correct correct-usage answer | 15 |
| Complete theme quiz (pass ≥70%) | +25 bonus |
| Complete theme quiz (fail, but finished) | +10 bonus |
| Complete entire unit | +50 bonus |
| Daily login / streak continuation | 5 |
| Complete SRS review session | 10 |

- Points are never deducted
- Points update in real time after every action
- Current points shown on home screen only (not persistent on every screen)

---

## MODULE 11 — LEADERBOARD & HALL OF FAME

### Acceptance Criteria

**AC-11.1**
- Three tabs: This Week / All-Time / Hall of Fame
- Weekly: points earned since last Sunday midnight; auto-resets every Sunday midnight (server time)
- All-time: cumulative total since account creation; never auto-resets
- Each entry: rank, display name, points — no profile browsing
- Logged-in user's row always highlighted and visible (sticky if off-screen)
- Top 3: gold/silver/bronze glow styling
- Suspended users excluded from all leaderboard displays

**AC-11.2 — Weekly reset**
- GIVEN Sunday midnight, THEN system auto-saves top 3 to Hall of Fame before resetting
- Hall of Fame entry contains: session label (set by Admin), Rank 1/2/3, display name, points, week end date
- Hall of Fame is read-only for all users

---

## MODULE 12 — BADGES & ULTIMATE ACHIEVEMENTS

### AC-12.1 — Display rules
- All 20 badges always visible on Profile tab
- Locked: greyed-out shape + progress bar + progress text (e.g., "47 / 200")
- Earned: full colour + date earned
- Badge earn triggers full-screen celebration (confetti + zoom)

### AC-12.2 — Short-term badges (4)
1. First Step — complete first flashcard session
2. Quiz Starter — complete first theme quiz
3. On a Roll — 3-day streak
4. Perfectionist — 100% on any single quiz

### AC-12.3 — Mid-term badges (10)
5. Week Warrior — 7-day streak
6. Sharp Shooter — 50 correct quiz answers in a row (no wrong answers between)
7. Unit Slayer — complete first full unit
8. Analogy Apprentice — 25 analogy questions correct (cumulative)
9. Halfway There — 400 of 800 words reviewed at least once
10. Streak Keeper — 14-day streak
11. Review Regular — 30 SRS review sessions completed
12. Speed Demon — 5 flashcard sessions each under 3 minutes
13. Leaderboard Climber — reach Top 10 on any weekly leaderboard
14. Vocab Explorer — start flashcards for 8 different units

### AC-12.4 — Long-term badges (6)
15. The 800 Club — all 800 words reviewed at least once
16. Analogy Master — 200 analogy questions correct (cumulative)
17. Unit Conqueror — complete every unit
18. Review Legend — 200 SRS review sessions
19. Completionist — every unit AND every quiz complete
20. Leaderboard Legend — finish Top 3 on any weekly leaderboard

### AC-12.5 — Ultimate Achievements (hidden by default)
All 4 are completely invisible until Admin enables them.
On enable: all 4 become visible simultaneously; progress tracks retroactively.
1. Question Machine — 10,000 correct quiz answers (cumulative)
2. Flawless Run — complete entire unit scoring 100% on every quiz within it
3. Word Sovereign — mastery score ≥151 on all 800 words with at least one long-gap correct recall each
4. Immortal — no missed daily review for 90 consecutive days

---

## MODULE 13 — NOTIFICATIONS

### Push (PWA browser notifications)
| Trigger | Message |
|---|---|
| No study by 6 PM | "Don't break your streak! You have X words due today." |
| SRS overdue > 1 day | "You have X overdue words. Quick review before they pile up!" |
| Badge earned | "🏅 You just earned the [Badge Name] badge!" |
| Streak at risk (2hrs before midnight) | "⚠️ 2 hours left to keep your [N]-day streak alive!" |

- Permission requested during onboarding Step 3
- Toggleable in Profile → Settings

### Email (Gmail transactional)
| Trigger | Content |
|---|---|
| Registration | Verification link |
| Weekly (Sunday) | Words reviewed, points, leaderboard rank, streak |
| Streak lost | "Your [N]-day streak ended. Start a new one today!" |
| Admin announcement | Custom message |

- Weekly summary toggleable in Settings
- Verification and Admin announcement emails cannot be disabled

---

## MODULE 14 — ADMIN PANEL

### AC-14.1 — User management
- Full user list: name, Gmail, WhatsApp, registration date, access phase, status
- Search/filter by name, email, status, phase
- Per-user actions: toggle Active ↔ Suspended, upgrade Phase-2 preview to full, view progress stats
- Access requests list: name, WhatsApp, message, one-click "Grant Full Access" button

### AC-14.2 — Leaderboard controls
- View current weekly + all-time leaderboards
- Manual all-time reset: Admin must enter session label before reset; top 3 auto-saved to Hall of Fame
- Add/edit labels on Hall of Fame entries

### AC-14.3 — Achievement controls
- Toggle Ultimate Achievements: Hidden → Visible (affects all users simultaneously)
- View badge/achievement progress per user

### AC-14.4 — Content management
- Import word bank via CSV/JSON upload
- Add/edit/delete units, themes, individual words
- Reorder units and themes
- Configure quiz pass threshold (default 70%)
- Configure AI model (default: Gemini Flash)

### AC-14.5 — Phase & access controls
- View and update Phase 1 cut-off date
- Live counts: Phase-1 users / Phase-2 preview / Phase-2 full

### AC-14.6 — Announcements
- Send email to all active users (custom subject + body)

---

## MODULE 15 — EDGE CASES

**Streak rules:**
- Increments 1 per calendar day with any study activity
- One activity sufficient — no volume requirement
- Missed day → streak drops to 0 immediately next day
- No grace period, no freeze mechanic
- Tracked in user's local timezone

**All words completed:**
- GIVEN a user has reviewed all 800 words at least once, THEN celebration screen: "You've reviewed every word! Keep reviewing to achieve mastery."
- App continues SRS reviews; home screen shifts focus to mastery progress

---

## NON-FUNCTIONAL REQUIREMENTS

| Requirement | Detail |
|---|---|
| Platform | Mobile-first PWA. Installable on iOS and Android. Works in any modern browser. |
| Offline | Not supported — active internet connection required |
| Language | English only |
| AI API | Google Gemini Flash. Server-side only. |
| Auth | Gmail + password, mandatory email verification, JWT sessions |
| Hosting | Self-hosted by VH Beyond the Horizon |
| Points integrity | All calculations server-side |
| Leaderboard integrity | Server-authoritative — no client-side manipulation |
| Session security | JWT tokens, expire after inactivity |
| Theme | Dark default, Light mode available in Settings |

---

## OPEN QUESTIONS (do not implement until resolved)
1. App name — TBD before launch
2. Admin analytics dashboard — deferred
3. Badge artwork — deferred to design phase
4. Exact notification send times — TBD (configurable vs fixed)
5. Social features — out of scope v1
6. In-app payments — out of scope (offline only)
7. Multiple languages — out of scope v1
