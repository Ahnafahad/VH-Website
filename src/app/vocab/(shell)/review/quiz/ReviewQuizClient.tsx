'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import QuizConfigSheet, { type QuizConfig } from '@/components/vocab/QuizConfigSheet';
import QuizScreen from '@/app/vocab/(shell)/study/[themeId]/quiz/QuizScreen';

export default function ReviewQuizClient({ wordIds }: { wordIds: number[] }) {
  const router = useRouter();
  const [config, setConfig] = useState<QuizConfig | null>(null);

  return (
    <>
      <AnimatePresence>
        {!config && (
          <QuizConfigSheet
            onStart={setConfig}
            onCancel={() => router.back()}
          />
        )}
      </AnimatePresence>

      {config && (
        <QuizScreen
          letterWordIds={wordIds}
          sessionType="letter"
          quizConfig={config}
        />
      )}
    </>
  );
}
