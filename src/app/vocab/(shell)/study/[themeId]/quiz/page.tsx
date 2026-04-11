'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import QuizConfigSheet, { type QuizConfig } from '@/components/vocab/QuizConfigSheet';
import QuizScreen from './QuizScreen';

export default function QuizPage() {
  const params = useParams<{ themeId: string }>();
  const router = useRouter();
  const themeId = parseInt(params.themeId, 10);

  const [config, setConfig] = useState<QuizConfig | null>(null);

  if (isNaN(themeId)) {
    router.replace('/vocab/study');
    return null;
  }

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
          themeId={themeId}
          sessionType="study"
          quizConfig={config}
        />
      )}
    </>
  );
}
