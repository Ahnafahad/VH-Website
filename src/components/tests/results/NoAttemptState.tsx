'use client';

export default function NoAttemptState() {
  return (
    <div className="rounded-xl border border-[var(--color-exam-border)] bg-[var(--color-exam-surface)] px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 w-8 h-8 rounded-full border border-[var(--color-exam-warning)]/40 bg-[var(--color-exam-warning)]/10 flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-exam-warning)" strokeWidth="2">
            <path d="M12 9v5M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div>
          <p className="text-[var(--color-exam-ink)] font-medium text-sm mb-1">No submitted attempt</p>
          <p className="text-[var(--color-exam-ink-muted)] text-sm leading-relaxed">
            You didn&apos;t sit this test, but you can still review the answer key and
            class statistics below.
          </p>
        </div>
      </div>
    </div>
  );
}
