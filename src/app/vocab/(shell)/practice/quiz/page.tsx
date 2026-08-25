'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import QuizConfigSheet, { type QuizConfig } from '@/components/vocab/QuizConfigSheet';
import QuizScreen from '@/app/vocab/(shell)/study/[themeId]/quiz/QuizScreen';
import { prefetchQuiz } from '@/lib/vocab/quiz-prefetch';

export default function PracticeQuizPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<QuizConfig | null>(null);

  const themes   = searchParams.get('themes') ?? '';
  const themeIds = themes.split(',').map(Number).filter(n => !isNaN(n) && n > 0);

  const wordIdsParam = searchParams.get('wordIds') ?? '';
  const letterWordIds = wordIdsParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0);

  const isLetterMode   = letterWordIds.length > 0;
  const isExamMode     = searchParams.get('mode') === 'exam';
  // Today's Briefing cards (Repeat Offenders, The Deadline File) pass explicit
  // wordIds too, but must NOT go through 'letter' mode — that type filters
  // every distractor to one starting letter, which is wrong for a cross-theme
  // curated list. `mode=briefing` picks the unscoped session type instead.
  const isBriefingMode = searchParams.get('mode') === 'briefing';

  // Fire prefetch immediately — user is reading the config sheet (3–30s dead time).
  // Must be before the early return to satisfy rules of hooks. Briefing sessions
  // aren't prefetched — a small, deliberate scope trim, not a correctness issue.
  useEffect(() => {
    if (isExamMode || isBriefingMode) return;
    if (!isLetterMode && themeIds.length === 0) return;
    let questionCount = 10;
    try {
      const stored = localStorage.getItem('lx-quiz-config');
      if (stored) questionCount = JSON.parse(stored).questionCount ?? 10;
    } catch { /* ignore */ }

    if (isLetterMode) {
      prefetchQuiz({ type: 'letter', wordIds: letterWordIds, questionCount });
    } else {
      prefetchQuiz({ type: 'practice', themeIds, questionCount });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isExamMode && !isLetterMode && themeIds.length === 0) {
    router.replace('/vocab/practice');
    return null;
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {!config && (
          <QuizConfigSheet
            onStart={setConfig}
            onCancel={() => router.back()}
          />
        )}
      </AnimatePresence>

      {config && (
        isExamMode ? (
          <QuizScreen
            sessionType="exam"
            quizConfig={config}
          />
        ) : isBriefingMode ? (
          <QuizScreen
            letterWordIds={letterWordIds}
            sessionType="briefing"
            quizConfig={config}
          />
        ) : isLetterMode ? (
          <QuizScreen
            letterWordIds={letterWordIds}
            sessionType="letter"
            quizConfig={config}
          />
        ) : (
          <QuizScreen
            themeIds={themeIds}
            sessionType="practice"
            quizConfig={config}
          />
        )
      )}
    </>
  );
}
