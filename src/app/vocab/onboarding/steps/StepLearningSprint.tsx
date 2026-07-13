'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, RotateCcw, Volume2 } from 'lucide-react';
import { trackRetention, RETENTION_EVENTS } from '@/lib/vocab/retention-events';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';

interface StarterWord { id: number; word: string; pos: string; definition: string; exampleSentence: string; }

export default function StepLearningSprint({ onRecall }: {
  onRecall: (payload: { starterWordIds: number[]; recalledWordId: number; selectedWordId: number }) => Promise<boolean>;
}) {
  const [words, setWords] = useState<StarterWord[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reduceMotion = useReducedMotion();
  const fb = useVocabFeedback();

  useEffect(() => {
    fetch('/api/vocab/onboarding/starter-word')
      .then(async response => {
        if (!response.ok) throw new Error('Unable to prepare your first words.');
        const data = await response.json() as { words?: StarterWord[] };
        if (data.words?.length !== 3) throw new Error('Your starter set is not ready yet.');
        setWords(data.words);
      })
      .catch(() => setError('We could not prepare your first words. Check your connection and try again.'))
      .finally(() => setLoading(false));
  }, []);

  const target = words[1];
  const shuffled = useMemo(() => target ? [words[1], words[0], words[2]] : [], [target, words]);

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    fb.play('flip');
    trackRetention(RETENTION_EVENTS.starterWordRevealed, { position: index + 1 });
  }

  function nextWord() {
    trackRetention(RETENTION_EVENTS.starterWordRated, { position: index + 1, rating: 'seen' });
    if (index === 2) setTesting(true);
    else { setIndex(value => value + 1); setRevealed(false); }
  }

  async function answer(wordId: number) {
    if (!target || selected !== null) return;
    setSelected(wordId);
    setWrong(false);
    trackRetention(RETENTION_EVENTS.firstRecallAttempted, { selectedWordId: wordId, recalledWordId: target.id });
    const correct = await onRecall({ starterWordIds: words.map(word => word.id), recalledWordId: target.id, selectedWordId: wordId });
    if (correct) {
      setSuccess(true);
      fb.play('complete');
      trackRetention(RETENTION_EVENTS.activationAchieved, { starterWordId: target.id });
      return;
    }
    fb.play('missed');
    setWrong(true);
    window.setTimeout(() => setSelected(null), 700);
  }

  if (loading) return <div className="lx-onboarding-panel" aria-busy="true"><div className="lx-sprint-skeleton" /><p className="lx-loading-copy">Preparing three useful words…</p></div>;
  if (error) return <div className="lx-onboarding-panel lx-onboarding-error" role="alert"><RotateCcw size={26} /><h1>Let’s reconnect first</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></div>;
  if (!words.length) return null;

  if (success && target) return (
    <section className="lx-onboarding-panel lx-activation-success" aria-live="polite">
      <div className="lx-activation-check" aria-hidden><Check size={28} /></div>
      <div className="lx-onboarding-heading">
        <p>First recall complete</p>
        <h1>You remembered {target.word}.</h1>
        <span>That tested recall—not a tap—is your first real piece of progress. Your next session is ready.</span>
      </div>
    </section>
  );

  if (testing && target) return (
    <section className="lx-onboarding-panel" aria-labelledby="recall-title">
      <div className="lx-onboarding-heading">
        <p>One quick recall check</p>
        <h1 id="recall-title">Which word means this?</h1>
        <span>This is where learning becomes measurable.</span>
      </div>
      <blockquote className="lx-recall-definition">{target.definition}</blockquote>
      <div className="lx-recall-options" role="group" aria-label="Choose the matching word">
        {shuffled.map(word => {
          const isSelected = selected === word.id;
          const isCorrect = isSelected && word.id === target.id;
          return <motion.button key={word.id} whileTap={{ scale: 0.985 }} disabled={selected !== null} onClick={() => answer(word.id)}
            className={`lx-recall-option ${isCorrect ? 'is-correct' : ''} ${isSelected && wrong ? 'is-wrong' : ''}`}>
            <span>{word.word}</span>{isCorrect && <Check size={18} aria-hidden />}
          </motion.button>;
        })}
      </div>
      <p className="lx-recall-feedback" aria-live="polite">{wrong ? 'Not quite. Look at the definition once more and try again.' : 'Choose from the three words you just learned.'}</p>
    </section>
  );

  const word = words[index];
  return (
    <section className="lx-onboarding-panel" aria-labelledby="sprint-title">
      <div className="lx-onboarding-heading">
        <p>Word {index + 1} of 3</p>
        <h1 id="sprint-title">Learn a tiny set, then prove what stayed.</h1>
        <span>No points yet—just a useful first win.</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.button key={`${word.id}-${revealed}`} type="button" onClick={reveal} className="lx-starter-card"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
          {!revealed ? <><small>{word.pos}</small><strong>{word.word}</strong><span>Tap to reveal</span></> : <><small>{word.word}</small><strong>{word.definition}</strong><em>{word.exampleSentence}</em></>}
        </motion.button>
      </AnimatePresence>
      <button type="button" className="lx-pronounce-button" onClick={() => speechSynthesis.speak(new SpeechSynthesisUtterance(word.word))} aria-label={`Hear ${word.word} pronounced`}>
        <Volume2 size={18} aria-hidden /> Hear the word
      </button>
      <button type="button" className="lx-onboarding-primary" disabled={!revealed} onClick={nextWord}>{index === 2 ? 'Test my recall' : 'Next word'}</button>
    </section>
  );
}
