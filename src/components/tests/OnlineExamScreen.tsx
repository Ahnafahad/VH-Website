'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import TimerArc from '@/components/tests/TimerArc';
import QuestionView from '@/components/tests/QuestionView';
import QuestionNavigator from '@/components/tests/QuestionNavigator';
import ViolationModal from '@/components/tests/ViolationModal';
import SubmitDialog from '@/components/tests/SubmitDialog';
import type { AttemptPayload, ViolationAction, ViolationResponse } from '@/lib/tests/types';
import type { QState } from '@/components/tests/QuestionNavigator';

interface Props {
  slug: string;
  bucket: string;
  initialPayload: AttemptPayload;
  /** Where the "Back to Tests" button after submit/ban points. Defaults to /tests/{bucket}. */
  exitHref?: string;
  /** Optional label for the exit button. Defaults to "Back to Tests". */
  exitLabel?: string;
}

// Flat list of all questions across sections
function flattenQuestions(payload: AttemptPayload) {
  return payload.sections.flatMap(sec =>
    sec.questions.map(q => ({ ...q, sectionId: sec.id })),
  );
}

function buildGroupMap(payload: AttemptPayload): Map<number, (typeof payload.sections[0]['groups'][0])> {
  const map = new Map<number, typeof payload.sections[0]['groups'][0]>();
  for (const sec of payload.sections) {
    for (const g of sec.groups) {
      map.set(g.id, g);
    }
  }
  return map;
}

type AnswerMap = Record<number, { selectedKey: string | null; flagged: boolean }>;

export default function OnlineExamScreen({ slug, bucket, initialPayload, exitHref, exitLabel }: Props) {
  const router = useRouter();
  const resolvedExitHref = exitHref ?? `/tests/${bucket}`;
  const resolvedExitLabel = exitLabel ?? 'Back to Tests';

  // Build answer state from payload
  const initAnswers = (): AnswerMap => {
    const m: AnswerMap = {};
    for (const a of initialPayload.answers) {
      m[a.questionId] = { selectedKey: a.selectedKey, flagged: a.flagged };
    }
    return m;
  };

  const [answers, setAnswers] = useState<AnswerMap>(initAnswers);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [violationModal, setViolationModal] = useState<{ action: ViolationAction; count: number } | null>(null);
  const [submitDialog, setSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [banned, setBanned] = useState(false);
  const [syncError, setSyncError] = useState(false);

  // Refs so event handlers have latest state without re-registering
  const violationOpenRef = useRef(false);
  const submittedRef = useRef(false);
  const bannedRef = useRef(false);
  const lastViolationRef = useRef(0);

  // Pending answer queue (flush after autosave retry)
  const pendingRef = useRef<Record<number, { selectedKey: string | null; flagged: boolean }>>({});

  const allQuestions = flattenQuestions(initialPayload);
  const groupMap = buildGroupMap(initialPayload);

  // ── Anti-cheat ──────────────────────────────────────────────────────────────
  const reportViolation = useCallback(async () => {
    if (submittedRef.current || bannedRef.current || violationOpenRef.current) return;
    const now = Date.now();
    if (now - lastViolationRef.current < 3000) return; // debounce
    lastViolationRef.current = now;
    violationOpenRef.current = true;

    try {
      const res = await fetch(`/api/tests/${slug}/violation`, { method: 'POST' });
      const data: ViolationResponse = await res.json();
      if (data.action === 'ban') {
        bannedRef.current = true;
        setBanned(true);
        return;
      }
      if (data.action === 'reset') {
        // Wipe local answers & re-fetch payload
        setAnswers({});
        setCurrentIdx(0);
        // Re-fetch to sync server answers (should be empty now)
        try {
          const pr = await fetch(`/api/tests/${slug}/attempt`);
          if (pr.ok) {
            const fresh: AttemptPayload = await pr.json();
            const refreshed: AnswerMap = {};
            for (const a of fresh.answers) {
              refreshed[a.questionId] = { selectedKey: a.selectedKey, flagged: a.flagged };
            }
            setAnswers(refreshed);
          }
        } catch { /* ignore */ }
      }
      setViolationModal({ action: data.action, count: data.tabLeaveCount });
    } catch {
      violationOpenRef.current = false;
    }
  }, [slug]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') reportViolation();
    };
    const onBlur = () => {
      // blur fires after hidden in same event; skip if already fired recently
      reportViolation();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [reportViolation]);

  // ── Autosave ─────────────────────────────────────────────────────────────────
  const saveAnswer = useCallback(async (questionId: number, selectedKey: string | null, flagged: boolean) => {
    // Queue it
    pendingRef.current[questionId] = { selectedKey, flagged };
    let attempts = 0;
    while (attempts < 2) {
      try {
        const res = await fetch(`/api/tests/${slug}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, selectedKey, flagged }),
        });
        if (res.ok) {
          delete pendingRef.current[questionId];
          setSyncError(false);
          return;
        }
      } catch { /* retry */ }
      attempts++;
    }
    // Still failing after retry
    setSyncError(true);
  }, [slug]);

  // ── Answer handlers ───────────────────────────────────────────────────────────
  const handleSelect = useCallback((questionId: number, key: string | null) => {
    setAnswers(prev => {
      const cur = prev[questionId] ?? { selectedKey: null, flagged: false };
      const next = { ...cur, selectedKey: key };
      saveAnswer(questionId, key, cur.flagged);
      return { ...prev, [questionId]: next };
    });
  }, [saveAnswer]);

  const handleFlag = useCallback((questionId: number) => {
    setAnswers(prev => {
      const cur = prev[questionId] ?? { selectedKey: null, flagged: false };
      const next = { ...cur, flagged: !cur.flagged };
      saveAnswer(questionId, cur.selectedKey, !cur.flagged);
      return { ...prev, [questionId]: next };
    });
  }, [saveAnswer]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const doSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tests/${slug}/submit`, { method: 'POST' });
      if (res.ok) {
        submittedRef.current = true;
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({} as { code?: string }));
        if (data.code === 'ALREADY_SUBMITTED') {
          submittedRef.current = true;
          setSubmitted(true);
        } else {
          // keep the exam open so the student can retry
          setSyncError(true);
        }
      }
    } catch {
      setSyncError(true);
    } finally {
      setSubmitting(false);
      setSubmitDialog(false);
    }
  }, [slug]);

  const handleAutoSubmit = useCallback(() => {
    if (!submittedRef.current && !bannedRef.current) doSubmit();
  }, [doSubmit]);

  // ── Navigator state calc ──────────────────────────────────────────────────────
  const getState = useCallback((questionId: number): QState => {
    const a = answers[questionId];
    if (!a) return 'blank';
    if (a.flagged) return 'flagged';
    if (a.selectedKey) return 'answered';
    return 'blank';
  }, [answers]);

  // Stats for submit dialog
  const allQIds = allQuestions.map(q => q.id);
  const answeredCount = allQIds.filter(id => {
    const a = answers[id];
    return a?.selectedKey != null;
  }).length;
  const flaggedCount = allQIds.filter(id => answers[id]?.flagged).length;
  const blankCount = allQIds.length - answeredCount;

  // Current question data
  const currentQ = allQuestions[currentIdx];
  const currentGroup = currentQ?.groupId != null ? (groupMap.get(currentQ.groupId) ?? null) : null;
  const currentAnswer = answers[currentQ?.id ?? -1] ?? { selectedKey: null, flagged: false };

  // ── Terminal screens ──────────────────────────────────────────────────────────
  if (banned) {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-exam-danger mb-6">
            <ShieldAlert className="w-7 h-7 text-exam-danger" strokeWidth={1.5} />
          </div>
          <h1 className="font-heading text-exam-ink text-2xl font-medium mb-2">Access Revoked</h1>
          <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">
            You have been banned from this test due to repeated violations. Contact an admin to appeal.
          </p>
          <button onClick={() => router.push(resolvedExitHref)} className="px-6 py-3 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted text-sm">
            {resolvedExitLabel}
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
          className="max-w-sm"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-exam-gold mb-6"
            style={{ boxShadow: 'var(--color-exam-glow-gold) 0 0 32px 0' }}>
            <span className="text-exam-gold text-2xl">✓</span>
          </div>
          <h1 className="font-heading text-exam-ink text-2xl font-medium mb-2">Answers Locked In</h1>
          <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">
            Results will be available once the test window closes and all answers have been reviewed.
          </p>
          <button
            onClick={() => router.push(resolvedExitHref)}
            className="px-6 py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors"
          >
            {resolvedExitLabel}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-exam-base overflow-hidden">
      {/* Header */}
      <header className="relative flex-shrink-0 flex items-center justify-between gap-4 px-4 sm:px-5 py-3 bg-exam-surface border-b border-exam-border z-10">
        <div
          className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, var(--color-exam-gold) 50%, transparent)', opacity: 0.35 }}
        />
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/bth_compact_square_maroon.png"
            alt=""
            width={28}
            height={28}
            className="rounded-md flex-shrink-0 hidden sm:block"
          />
          <div className="flex flex-col min-w-0">
            <h1 className="font-heading text-exam-ink text-base sm:text-lg font-medium tracking-tight truncate">
              {initialPayload.test.title}
            </h1>
            <span className="text-exam-gold/70 text-[11px] uppercase tracking-[0.15em] font-medium">
              {initialPayload.sections[
                allQuestions.findIndex((_, i) => i === currentIdx) >= 0
                  ? (function() {
                      let sum = 0;
                      for (let si = 0; si < initialPayload.sections.length; si++) {
                        sum += initialPayload.sections[si].questions.length;
                        if (currentIdx < sum) return si;
                      }
                      return 0;
                    })()
                  : 0
              ]?.title ?? ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          {syncError && (
            <span className="text-exam-warning text-xs animate-pulse hidden sm:inline">reconnecting…</span>
          )}
          <TimerArc deadlineMs={initialPayload.attempt.deadline} onExpire={handleAutoSubmit} />
          <motion.button
            onClick={() => setSubmitDialog(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
            className="px-3.5 py-1.5 rounded-lg bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-xs font-medium transition-colors"
          >
            Submit
          </motion.button>
        </div>
      </header>

      {/* Body: question + desktop navigator */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question pane */}
        <main className="flex-1 overflow-hidden">
          {currentQ && (
            <QuestionView
              question={currentQ}
              group={currentGroup}
              selectedKey={currentAnswer.selectedKey}
              flagged={currentAnswer.flagged}
              onSelect={(key) => handleSelect(currentQ.id, key)}
              onFlag={() => handleFlag(currentQ.id)}
              onPrev={currentIdx > 0 ? () => setCurrentIdx(i => i - 1) : null}
              onNext={currentIdx < allQuestions.length - 1 ? () => setCurrentIdx(i => i + 1) : null}
              questionNumber={currentIdx + 1}
              totalQuestions={allQuestions.length}
            />
          )}
        </main>

        {/* Desktop navigator rail (hidden on mobile) */}
        <div className="hidden lg:flex">
          <QuestionNavigator
            sections={initialPayload.sections}
            currentGlobalIdx={currentIdx}
            getState={getState}
            onJump={setCurrentIdx}
            onSubmit={() => setSubmitDialog(true)}
          />
        </div>
      </div>

      {/* Mobile navigator (bottom bar) */}
      <div className="lg:hidden">
        <QuestionNavigator
          sections={initialPayload.sections}
          currentGlobalIdx={currentIdx}
          getState={getState}
          onJump={setCurrentIdx}
          onSubmit={() => setSubmitDialog(true)}
          mobile
        />
      </div>

      {/* Violation modal */}
      <ViolationModal
        action={violationModal?.action ?? null}
        tabLeaveCount={violationModal?.count ?? 0}
        onDismiss={() => {
          setViolationModal(null);
          violationOpenRef.current = false;
        }}
      />

      {/* Submit dialog */}
      <SubmitDialog
        open={submitDialog}
        answered={answeredCount}
        flagged={flaggedCount}
        blank={blankCount}
        total={allQuestions.length}
        onConfirm={doSubmit}
        onCancel={() => setSubmitDialog(false)}
        isLoading={submitting}
      />
    </div>
  );
}
