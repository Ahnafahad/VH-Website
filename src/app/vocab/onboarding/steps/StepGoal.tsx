'use client';

import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, MessageCircle, Sparkles } from 'lucide-react';
import { LexiArtwork } from '@/components/vocab/LexiAsset';

export type LearningGoal = 'admission' | 'conversation' | 'academic' | 'general';

const goals = [
  { id: 'admission', label: 'Admission tests', detail: 'Build precise recall for competitive exams.', icon: GraduationCap },
  { id: 'conversation', label: 'Conversation', detail: 'Use stronger words naturally when speaking.', icon: MessageCircle },
  { id: 'academic', label: 'Academic English', detail: 'Read and write with greater confidence.', icon: BookOpen },
  { id: 'general', label: 'General growth', detail: 'Build a broad vocabulary at a steady pace.', icon: Sparkles },
] as const;

export default function StepGoal({ onNext }: { onNext: (goal: LearningGoal) => void }) {
  return (
    <section className="lx-onboarding-panel" aria-labelledby="goal-title">
      <div className="lx-onboarding-heading">
        <p>Make it yours</p>
        <h1 id="goal-title">What should your vocabulary help you do?</h1>
        <span>One answer is enough. You can change it later.</span>
      </div>
      <LexiArtwork path="onboarding/learning-goal.webp" width={104} height={104} style={{ margin: '0 auto' }} />
      <div className="lx-goal-list">
        {goals.map(({ id, label, detail, icon: Icon }) => (
          <motion.button key={id} type="button" whileTap={{ scale: 0.985 }} onClick={() => onNext(id)} className="lx-goal-option">
            <span className="lx-goal-icon" aria-hidden><Icon size={20} /></span>
            <span><strong>{label}</strong><small>{detail}</small></span>
            <span className="lx-goal-arrow" aria-hidden>→</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
