'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';

type Props = {
  userName: string;
};

type Character = {
  id: number;
  name: string;
  gender: string;
  source: string;
  origin: string | null;
  taken: boolean;
};

type Phase = 'list' | 'confirm' | 'custom' | 'done';

// Overlay pages where an unclosable modal would block something more urgent
// (an in-progress quiz/test, auth, admin, or the API itself) — same reasoning
// as OnboardingModal's blacklist.
const BLOCKED_PREFIXES = ['/admin', '/auth', '/api', '/vocab'];

const POLL_MS = 6000;

export default function AvatarPickerModal({ userName }: Props) {
  const pathname = usePathname();
  const blocked = BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [phase, setPhase] = useState<Phase>('list');
  const [selected, setSelected] = useState<Character | null>(null);
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCharacters = useCallback(async () => {
    try {
      const res = await fetch('/api/avatars/characters');
      if (!res.ok) return;
      const json = await res.json();
      setCharacters(json.characters ?? []);
    } catch {
      // Silent — polling retries on the next tick; the initial load shows
      // its own error state via `loading` never resolving to data.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (blocked) return;
    void fetchCharacters();
  }, [blocked, fetchCharacters]);

  // Poll while the list is showing, so taken characters grey out live.
  useEffect(() => {
    if (blocked || phase !== 'list') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(fetchCharacters, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [blocked, phase, fetchCharacters]);

  useEffect(() => {
    if (blocked || phase === 'done') return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [blocked, phase]);

  if (blocked || dismissed) return null;

  function pick(c: Character) {
    if (c.taken) return;
    setError(null);
    setSelected(c);
    setPhase('confirm');
  }

  async function confirmPick() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/avatars/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: selected.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.code === 'AVATAR_TAKEN') {
          setError(`${selected.name} was just taken — pick another.`);
          setPhase('list');
          void fetchCharacters();
          return;
        }
        if (json?.code === 'AVATAR_ALREADY_HAS') {
          setDoneMessage('You already have a character.');
          setPhase('done');
          return;
        }
        throw new Error(json?.error || 'Something went wrong');
      }
      setDoneMessage(`${selected.name} is yours now.`);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customText.trim()) {
      setError('Enter a character name');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/avatars/custom-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: customText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Something went wrong');
      setDoneMessage('Sent for review — we’ll let you know.');
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const firstName = (userName || '').split(' ')[0] || 'friend';
  const visible = characters.filter((c) => c.gender === gender);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
        style={{
          backgroundColor: 'rgba(26, 5, 7, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 320, damping: 28 }}
          className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-[#FAF5EF] text-[#1A0507] shadow-[0_40px_120px_-30px_rgba(90,11,15,0.55)]"
        >
          <div className="relative max-h-[85vh] overflow-y-auto px-8 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
            <div className="mb-5 flex items-center gap-3 font-sans text-[10px] uppercase tracking-[0.3em] text-[#A86E58]">
              <span className="h-px w-6 bg-[#A86E58]" />
              Pick your character
            </div>

            {phase === 'list' && (
              <>
                <h2 className="font-heading text-[clamp(1.5rem,4vw,2rem)] font-light leading-[1.1] tracking-[-0.015em]">
                  Choose your avatar, <em className="font-extralight text-[#760F13]">{firstName}</em>.
                </h2>
                <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-[#1A0507]/65">
                  This choice is <strong>permanent and cannot be changed</strong> once made. Pick carefully.
                </p>

                <div className="mt-6 flex gap-2">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className="rounded-full px-4 py-1.5 font-sans text-xs uppercase tracking-[0.15em] transition-colors"
                      style={{
                        background: gender === g ? '#1A0507' : 'transparent',
                        color: gender === g ? '#FAF5EF' : '#1A0507',
                        border: '1px solid #1A0507',
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                {error && <p className="mt-3 font-sans text-xs text-[#760F13]">{error}</p>}

                {loading ? (
                  <p className="mt-6 font-sans text-sm text-[#1A0507]/50">Loading characters…</p>
                ) : (
                  <div className="mt-5 grid max-h-[40vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                    {visible.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={c.taken}
                        onClick={() => pick(c)}
                        className="rounded-lg border p-3 text-left transition-opacity"
                        style={{
                          borderColor: '#A86E58',
                          opacity: c.taken ? 0.35 : 1,
                          cursor: c.taken ? 'not-allowed' : 'pointer',
                          background: 'rgba(255,255,255,0.5)',
                        }}
                      >
                        <p className="font-sans text-sm font-medium">{c.name}</p>
                        <p className="font-sans text-[11px] text-[#1A0507]/50">
                          {c.origin ?? c.source}
                          {c.taken ? ' · taken' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPhase('custom');
                  }}
                  className="mt-6 font-sans text-xs uppercase tracking-[0.2em] text-[#1A0507]/50 underline-offset-4 hover:text-[#1A0507] hover:underline"
                >
                  None of these? Suggest your own
                </button>
              </>
            )}

            {phase === 'confirm' && selected && (
              <>
                <h2 className="font-heading text-[clamp(1.5rem,4vw,2rem)] font-light leading-[1.1] tracking-[-0.015em]">
                  Lock in <em className="font-extralight text-[#760F13]">{selected.name}</em>?
                </h2>
                <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-[#1A0507]/65">
                  This is <strong>permanent</strong> — once confirmed, you cannot change your character later.
                </p>
                {error && <p className="mt-3 font-sans text-xs text-[#760F13]">{error}</p>}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={confirmPick}
                    disabled={submitting}
                    className="rounded-full bg-[#1A0507] px-6 py-2.5 font-sans text-sm text-[#FAF5EF] transition-colors hover:bg-[#760F13] disabled:opacity-50"
                  >
                    {submitting ? 'Locking in…' : 'Yes, this one'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setPhase('list');
                    }}
                    disabled={submitting}
                    className="font-sans text-sm text-[#1A0507]/50 hover:text-[#1A0507]"
                  >
                    Back
                  </button>
                </div>
              </>
            )}

            {phase === 'custom' && (
              <form onSubmit={submitCustom}>
                <h2 className="font-heading text-[clamp(1.5rem,4vw,2rem)] font-light leading-[1.1] tracking-[-0.015em]">
                  Suggest your own
                </h2>
                <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-[#1A0507]/65">
                  Not guaranteed — granted on review and availability.
                </p>
                <input
                  type="text"
                  autoFocus
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Character name"
                  maxLength={200}
                  className="mt-5 w-full border-b border-[#1A0507]/25 bg-transparent pb-2 font-sans text-lg text-[#1A0507] placeholder:text-[#1A0507]/30 focus:border-[#760F13] focus:outline-none"
                />
                {error && <p className="mt-2 font-sans text-xs text-[#760F13]">{error}</p>}
                <div className="mt-6 flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full bg-[#1A0507] px-6 py-2.5 font-sans text-sm text-[#FAF5EF] transition-colors hover:bg-[#760F13] disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send for review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setPhase('list');
                    }}
                    disabled={submitting}
                    className="font-sans text-sm text-[#1A0507]/50 hover:text-[#1A0507]"
                  >
                    Back to the list
                  </button>
                </div>
              </form>
            )}

            {phase === 'done' && (
              <>
                <h2 className="font-heading text-[clamp(1.5rem,4vw,2rem)] font-light leading-[1.1] tracking-[-0.015em]">
                  {doneMessage}
                </h2>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="mt-6 rounded-full bg-[#1A0507] px-6 py-2.5 font-sans text-sm text-[#FAF5EF] transition-colors hover:bg-[#760F13]"
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
