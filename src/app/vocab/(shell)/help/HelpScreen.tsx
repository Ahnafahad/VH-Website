'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown } from 'lucide-react';

// ─── Section data ─────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    title: 'What is LexiCore?',
    content: `LexiCore is a vocabulary training system built specifically for Bangladesh university admissions — IBA DU, BUP, and DU FBS.

It uses spaced repetition (SRS), adaptive quizzes, and daily streaks to help you master 800 curated words in the most efficient way possible.

Words are organized by themes and units, indexed by first letter, and your progress is tracked at every level.`,
  },
  {
    title: 'Points & Streaks',
    content: `Every action you take earns points:

• Daily login: +5 points
• Flashcard "Got It": +10 points (more for stronger mastery)
• Flashcard "Unsure" or "Missed It": fewer or no points
• Quiz correct answer: +5 / +10 / +15 depending on difficulty
• Streak bonus: extra points for consecutive days

Your streak resets if you miss a day. Keeping your streak alive multiplies your progress over time.`,
  },
  {
    title: 'Mastery Levels',
    content: `Every word has a mastery level that changes based on how you rate yourself:

• New — not yet studied
• Learning — seen once or twice, needs reinforcement
• Familiar — getting comfortable, some gaps
• Strong — consistently recalled with confidence
• Mastered — fully learned, enters long-term review

Words progress through these levels via flashcard ratings and quiz performance. The goal is to move every word to Mastered before your deadline.`,
  },
  {
    title: 'Flashcards & SRS',
    content: `Flashcards use Spaced Repetition (SRS) — a proven technique where words you know appear less often, and words you struggle with appear more frequently.

After flipping a card, rate yourself honestly:

• Got It — you recalled it clearly. The word is scheduled further out.
• Unsure — you had a vague idea. It comes back sooner.
• Missed It — you didn't know it. It comes back very soon.

The SRS engine schedules each word's next review date based on your history. Due words appear on your home screen as "X words due for review."`,
  },
  {
    title: 'Themes & Units',
    content: `LexiCore's 800 words are organized into a hierarchy:

• Words → grouped into Themes (typically ~10–15 words each)
• Themes → grouped into Units (typically ~3–5 themes each)
• Units → form the complete LexiCore library

You study theme by theme. Once you've completed flashcards for a theme, a quiz unlocks. Complete the quiz to mark the theme as done.`,
  },
  {
    title: 'Letters (A–Z)',
    content: `The "By Letter" tab lets you browse and practice words alphabetically.

Each letter card shows how many words start with that letter, and your mastery percentage for those words.

Selecting letters and starting a practice session is useful for targeted review — for example, studying all your "B" words before an exam.`,
  },
  {
    title: 'Quizzes',
    content: `Quizzes test your knowledge with three question types:

• Fill in the blank — complete a sentence using the correct word
• Analogy — "A is to B as C is to ___"
• Correct usage — identify which sentence uses the word correctly

You can configure the quiz length (10 / 15 / 20 questions) and enable Timed Mode with a countdown per question (15s / 30s / 45s / 1min).

Quiz scores and accuracy are reflected in your mastery levels and points.`,
  },
  {
    title: 'Badges & Achievements',
    content: `Badges are earned by hitting milestones in your journey. There are four categories:

• Short-term — early wins and quick streaks (e.g. First Step, On a Roll)
• Mid-term — sustained effort over weeks (e.g. Week Warrior, Unit Slayer)
• Long-term — deep mastery milestones (e.g. The 800 Club, Review Legend)
• Ultimate — rare achievements for exceptional performance (Word Sovereign, Immortal)

Visit your Profile to see all badges, your progress toward each, and the dates you earned them.`,
  },
  {
    title: 'How to unlock all 800 words',
    content: `Your first 100 words are completely free.

To unlock all 800 words:

• If you're a VH student (enrolled in IBA/BUP admission coaching) — it's free. Message us on Facebook or WhatsApp with your enrollment confirmation and we'll unlock your account within 24 hours.

• If you found LexiCore on your own — full access isn't open to the public yet, but you can express your interest from the Home screen and we'll contact you first when it launches.`,
  },
];

// ─── Section accordion ────────────────────────────────────────────────────────

function Section({ title, content, index }: { title: string; content: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 340, damping: 28 }}
      style={{
        borderBottom: '1px solid var(--color-lx-border)',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          width:          '100%',
          padding:        '16px 0',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          textAlign:      'left',
          gap:            12,
        }}
      >
        <h2 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize:   '1.15rem',
          fontWeight: 600,
          fontStyle:  open ? 'italic' : 'normal',
          color:      open ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-secondary)',
          margin:     0,
          lineHeight: 1.3,
          transition: 'color 0.18s, font-style 0.18s',
        }}>
          {title}
        </h2>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{ flexShrink: 0, color: open ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-muted)' }}
        >
          <ChevronDown size={16} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingBottom: '1.25rem' }}>
              {content.split('\n\n').map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize:   '0.82rem',
                    color:      'var(--color-lx-text-secondary)',
                    lineHeight: 1.75,
                    margin:     i > 0 ? '0.75rem 0 0' : 0,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const router = useRouter();

  return (
    <div className="px-5 pt-10 pb-16 md:px-8 md:pt-12 md:max-w-2xl md:mx-auto md:w-full">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => router.back()}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            background:     'none',
            border:         'none',
            cursor:         'pointer',
            fontFamily:     "'Sora', sans-serif",
            fontSize:       '0.7rem',
            fontWeight:     500,
            letterSpacing:  '0.1em',
            textTransform:  'uppercase',
            color:          'var(--color-lx-text-muted)',
            marginBottom:   '1.5rem',
            padding:        0,
          }}
        >
          <ChevronLeft size={14} />
          Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <p style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '0.58rem',
            fontWeight:    600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color:         'var(--color-lx-accent-red)',
            marginBottom:  8,
          }}>
            Help & Guides
          </p>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   'clamp(2rem, 5vw, 2.75rem)',
            fontWeight: 700,
            fontStyle:  'italic',
            color:      'var(--color-lx-text-primary)',
            lineHeight: 1,
            margin:     '0 0 8px',
          }}>
            How LexiCore works
          </h1>
          <p style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '0.78rem',
            color:      'var(--color-lx-text-muted)',
            margin:     0,
            lineHeight: 1.6,
          }}>
            Everything you need to know about flashcards, quizzes, SRS, and badges.
          </p>
        </motion.div>
      </div>

      {/* Divider */}
      <motion.div
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.12, duration: 0.45, ease: [0.25, 0, 0, 1] }}
        style={{ height: 1, background: 'var(--color-lx-border)', marginBottom: '0.5rem' }}
      />

      {/* Accordion */}
      <div>
        {SECTIONS.map((section, i) => (
          <Section key={section.title} {...section} index={i} />
        ))}
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          fontFamily:  "'Cormorant Garamond', Georgia, serif",
          fontSize:    '0.88rem',
          fontStyle:   'italic',
          color:       'var(--color-lx-text-muted)',
          marginTop:   '2.5rem',
          textAlign:   'center',
          lineHeight:  1.6,
        }}
      >
        Still confused? Reach out via Facebook or WhatsApp — we reply fast.
      </motion.p>
    </div>
  );
}
