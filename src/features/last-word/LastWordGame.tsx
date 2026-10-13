'use client';

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMachine } from '@xstate/react';
import { useDrag } from '@use-gesture/react';
import { useSpring } from '@react-spring/three';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { Howl } from 'howler';
import { ArrowLeft, ArrowRight, Lightbulb, Lock, Pause, Settings2 } from 'lucide-react';
import { assetUrl, loadAvailableAssets, type AssetUrls } from './assets/runtime';
import type { LastWordSet } from './content/schema';
import { updateMastery, verdictLabel } from './core/learning';
import { emptyMastery, type MasterySnapshot } from './core/types';
import { currentRound, currentStep, lastWordMachine } from './game/machine';
import { dueEdges, type Mode } from './game/session';
import { useLastWordSettings } from './game/store';
import { BrowserLastWordPersistence, HttpLastWordPersistence, type LastWordPersistence } from './persistence';
import { createFeedback, type Cue, type Feedback } from './presentation/audio';
import { CardScreen, ClueText, Home, Icon, MasteryMap, Recap, RoundFeedback } from './presentation/screens';
import { detectTier, timing, type PresentationTier } from './presentation/tokens';
import './last-word.css';

const Chamber = dynamic(() => import('./presentation/SemanticChamber'), { ssr: false });
const Backdrop = dynamic(() => import('./presentation/SemanticChamber').then(m => m.ChamberBackdrop), { ssr: false });
class ChamberBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const ROLE_LABEL: Record<string, string> = {
  tutorial: 'LEARN THE FEEL', diagnostic: 'PROVE WHAT YOU KNOW', probe: 'ONE HARDER READ', review: 'REVIEW · FRESH CONTEXT',
  warmup: 'WARM-UP', remedial: 'A FRESH LOOK', practice: 'FOLLOW THE MEANING', shift: 'FOLLOW THE MEANING', transfer: 'NEW TERRITORY',
};

/** Loads the content bank (a cached static file) and adds any staff preview set before the game starts. */
const NO_PREVIEW: LastWordSet[] = [];
export default function LastWordGame({ preview = NO_PREVIEW }: { preview?: LastWordSet[] }) {
  const [sets, setSets] = useState<LastWordSet[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch('/api/last-word/content')
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((bank: LastWordSet[]) => setSets([...preview, ...bank.filter(set => !preview.some(p => p.set_id === set.set_id))]))
      .catch(() => setFailed(true));
  }, [preview]);
  if (!sets) {
    return (
      <main className="lw-game" data-tier="lite" data-phase="loading">
        <section className="lw-summary" role="status">
          <p>{failed ? 'The chamber could not load. Check your connection and refresh.' : 'Opening the chamber…'}</p>
        </section>
      </main>
    );
  }
  return <Game sets={sets} />;
}

function Game({ sets }: { sets: LastWordSet[] }) {
  const [state, send] = useMachine(lastWordMachine, { input: { sets } });
  const { status: authStatus } = useSession();
  const settings = useLastWordSettings();
  const systemReduced = useReducedMotion();
  const [assets, setAssets] = useState<AssetUrls>(new Map());
  const [capability, setCapability] = useState<PresentationTier>('lite');
  const [webglFailed, setWebglFailed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [baseline, setBaseline] = useState<MasterySnapshot>(emptyMastery);
  const [saved, setSaved] = useState<MasterySnapshot | null>(null);
  const [storage, setStorage] = useState('Loading progress…');
  const [ready, setReady] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [now, setNow] = useState(0);
  const repository = useRef<LastWordPersistence | null>(null);
  const feedback = useRef<Feedback | null>(null);
  const root = useRef<HTMLElement>(null);
  const [{ tilt }, tiltApi] = useSpring(() => ({ tilt: 0, config: { tension: 260, friction: 24 } }));

  const reduced = Boolean(settings.reducedMotion || systemReduced);
  const tier: PresentationTier = webglFailed ? 'lite' : settings.tier === 'auto' ? capability : settings.tier;
  const { context } = state;
  const step = currentStep(context);
  const current = currentRound(context);
  const phase = String(state.value);
  const reading = state.matches('reading');
  const words = useMemo(() => current?.round.words ?? [], [current?.round.words]);
  const roundRecords = current ? context.records.filter(r => r.scenarioId === current.chain.id) : [];
  const lastRecord = context.records.at(-1);
  const judged = (state.matches('feedback') || state.matches('beatFeedback')) && lastRecord?.beatId === current?.beat.id;
  const beatKey = current ? `${current.chain.id}:${context.beat}` : phase;

  // ---------------------------------------------------------------- setup
  useEffect(() => {
    setCapability(detectTier());
    setNow(Date.now());
    let cancelled = false;
    loadAvailableAssets().then(found => {
      if (cancelled) return;
      setAssets(found);
      feedback.current = createFeedback(found);
    });
    return () => { cancelled = true; feedback.current?.dispose(); };
  }, []);

  // A stalled session check must not lock a guest out: after 5 s play as a guest; a late sign-in reloads progress.
  const [authTimedOut, setAuthTimedOut] = useState(false);
  useEffect(() => {
    if (authStatus !== 'loading') return;
    const timer = setTimeout(() => setAuthTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [authStatus]);
  useEffect(() => {
    if (authStatus === 'loading' && !authTimedOut) return;
    let cancelled = false;
    repository.current = authStatus === 'authenticated' ? new HttpLastWordPersistence() : new BrowserLastWordPersistence(localStorage, sets);
    repository.current.load().then(snapshot => {
      if (cancelled) return;
      setBaseline(snapshot);
      setStorage(authStatus === 'authenticated' ? 'Progress saves to your account.' : 'Progress stays on this browser. Sign in to keep it everywhere.');
    }).catch(() => {
      if (!cancelled) setStorage('Progress could not load. You can still play; saving can be retried.');
    }).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [authStatus, authTimedOut, sets]);

  const cue = useCallback((name: Cue) => {
    const { sound, haptics } = useLastWordSettings.getState();
    feedback.current?.play(name, sound, haptics);
  }, []);

  // Cues observe committed state; they never gate it.
  useEffect(() => { if (reading && context.beat >= 0) cue('arrival'); }, [beatKey, reading, cue, context.beat]);
  useEffect(() => {
    if (!judged || !lastRecord) return;
    const held = current?.beat.shift_type === 'false_shift' && lastRecord.correctness === 'best' && lastRecord.previousSelection === lastRecord.selectedWord;
    const perfect = state.matches('feedback') && current && roundRecords.length === current.chain.beats.length && roundRecords.every(r => r.correctness === 'best');
    cue(perfect ? 'perfect-read' : held ? 'hold' : lastRecord.correctness === 'best' ? 'best' : lastRecord.correctness);
  }, [judged, lastRecord, cue]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (state.matches('recap')) cue('mastery'); }, [phase, cue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the heading of each new screen so screen readers announce it (§41: logical order).
  useEffect(() => { root.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }); }, [phase, beatKey, mapOpen]);

  // Optional ambient bed, off by default, its own toggle; ducks during feedback.
  const music = useRef<Howl | null>(null);
  useEffect(() => {
    const url = assetUrl(assets, mapOpen ? 'music.map-ambience' : 'music.chamber-ambience');
    if (!settings.music || !url) { music.current?.unload(); music.current = null; return; }
    const howl = new Howl({ src: [url], loop: true, html5: true, volume: 0.35 });
    howl.play();
    music.current = howl;
    return () => { howl.unload(); };
  }, [settings.music, assets, mapOpen]);
  useEffect(() => { music.current?.volume(state.matches('feedback') ? 0.12 : 0.35); }, [phase]);

  // ---------------------------------------------------------------- progress
  const projected = useMemo(
    () => {
      // Tutorial play is guided exposure, never mastery evidence (matches the server's applySubmission).
      const tutorial = new Set(context.steps.flatMap(s => (s.kind === 'round' && s.role === 'tutorial' ? [s.chainId] : [])));
      return context.records.filter(r => !tutorial.has(r.scenarioId)).reduce(updateMastery, baseline);
    },
    [context.records, context.steps, baseline],
  );

  useEffect(() => {
    if (!state.matches('recap') || !repository.current) return;
    if (context.steps.some(s => s.kind === 'round' && s.role === 'tutorial')) settings.update({ tutorialDone: true });
    if (!context.records.length || !context.completedAt) return;
    let cancelled = false;
    setStorage('Saving your distinctions…');
    const decisions = context.records.map(({ id, sessionId, setId, scenarioId, beatId, presentedWords, selectedWord, previousSelection, reactionTimeMs, hintLevel, confidence, reviewIntervalDays, occurredAt }) =>
      ({ id, sessionId, setId, scenarioId, beatId, presentedWords, selectedWord, previousSelection, reactionTimeMs, hintLevel, confidence, reviewIntervalDays, occurredAt }));
    repository.current.saveSession({ id: context.sessionId, startedAt: context.startedAt, completedAt: context.completedAt, decisions }).then(snapshot => {
      if (cancelled) return;
      setSaved(snapshot);
      setStorage(authStatus === 'authenticated' ? 'Saved to your account.' : 'Saved on this browser.');
    }).catch(() => { if (!cancelled) setStorage('Save failed. Your results are still here.'); });
    return () => { cancelled = true; };
  }, [phase, saveAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- input (keyboard, tap and drag all send the same events)
  const select = useCallback((word: string) => {
    if (!reading || !words.includes(word)) return;
    cue(context.selected && context.selected !== word ? 'switch' : 'select');
    send({ type: 'SELECT', word });
  }, [reading, words, context.selected, cue, send]);
  const move = (direction: -1 | 1) => {
    // With nothing selected, a direction picks the word on that side.
    if (!context.selected) return select(direction > 0 ? words[words.length - 1] : words[0]);
    select(words[Math.max(0, Math.min(words.length - 1, words.indexOf(context.selected) + direction))]);
  };
  const lock = () => { if (reading && context.selected) { cue('lock'); send({ type: 'LOCK', now: Date.now() }); } };
  const next = () => { cue('ui-tap'); send({ type: 'NEXT', now: Date.now() }); };
  const finish = () => send({ type: 'FINISH', now: Date.now() });
  const start = (mode: Mode) => {
    setNow(Date.now());
    setSaved(null);
    cue('reveal');
    send({ type: 'START', mode, now: Date.now(), sessionId: crypto.randomUUID(), baseline, tutorialDone: settings.tutorialDone });
  };
  const bind = useDrag(({ active, movement: [x], last, canceled }) => {
    tiltApi.start({ tilt: reduced || !active ? 0 : Math.max(-1, Math.min(1, x / 120)) });
    if (last && !canceled && Math.abs(x) > 40) move(x > 0 ? 1 : -1);
  }, { axis: 'x', filterTaps: true });

  // On window, not <main>: after a screen change focus can land on <body>, and keys must still work (§7.2).
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (target.closest('select,input,textarea,summary,[data-settings]')) return;
    if (reading) {
      if (['ArrowLeft', 'a', 'A'].includes(event.key)) { event.preventDefault(); move(-1); return; }
      if (['ArrowRight', 'd', 'D'].includes(event.key)) { event.preventDefault(); move(1); return; }
      if (/^[1-5]$/.test(event.key) && words[Number(event.key) - 1]) { event.preventDefault(); select(words[Number(event.key) - 1]); return; }
      if ((event.key === 'Enter' || event.key === ' ') && (target.tagName !== 'BUTTON' || target.dataset.word)) { event.preventDefault(); lock(); }
    }
  };

  const keyHandler = useRef(onKey);
  keyHandler.current = onKey;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const onUnavailable = useCallback(() => setWebglFailed(true), []);
  const due = dueEdges(sets, baseline, now).length;
  const hasProgress = Object.keys(baseline.edges).length > 0 || settings.tutorialDone;
  const backdrop = assetUrl(assets, 'image.chamber-backdrop.landscape');
  const backdropPortrait = assetUrl(assets, 'image.chamber-backdrop.portrait');
  const liteTile = assetUrl(assets, 'texture.tile-surface.lite');
  const hints = current && (current.beat.hints ?? current.chain.hints);
  const hintText = hints && [null, hints.attention, hints.axis, hints.contrast][context.hintLevel];
  const skipped = context.steps.filter(s => s.kind === 'diagnosis' && s.result.outcome === 'A').length;
  const corrected = context.steps.filter(s => s.kind === 'contrast').length;

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <main ref={root} className="lw-game" data-tier={tier} data-reduced={reduced} data-phase={phase}
        style={{ ['--lw-backdrop' as string]: backdrop ? `url(${backdrop})` : 'none', ['--lw-backdrop-portrait' as string]: backdropPortrait ? `url(${backdropPortrait})` : 'none', ['--lw-tile' as string]: liteTile ? `url(${liteTile})` : 'none' }}>
        <div className="lw-atmosphere" aria-hidden="true"><div /><div /></div>
        {tier !== 'lite' && !mapOpen && <div className="lw-backdrop-canvas" aria-hidden="true"><ChamberBoundary onUnavailable={onUnavailable}><Backdrop tier={tier} assets={assets} /></ChamberBoundary></div>}
        <header className="lw-header">
          <Link href="/vocab/games" className="lw-back" aria-label="Back to games"><ArrowLeft size={18} /></Link>
          <span className="lw-logotype">{assetUrl(assets, 'icon.wordmark') ? <img src={assetUrl(assets, 'icon.wordmark')!} alt="Last Word" height={18} /> : <>LAST<span>WORD</span></>}</span>
          <span className="lw-header-note">A GAME OF MEANING</span>
          <button className="lw-icon-button" aria-label="Game settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={19} /></button>
        </header>

        {settingsOpen && (
          <section className="lw-settings" data-settings aria-label="Game settings">
            <label>Presentation
              <select value={settings.tier} onChange={e => settings.update({ tier: e.target.value as PresentationTier | 'auto' })}>
                <option value="auto">Automatic</option><option value="full">Full 3D</option><option value="standard">Standard</option><option value="lite">Lite</option>
              </select>
            </label>
            <label><input type="checkbox" checked={settings.reducedMotion} onChange={e => settings.update({ reducedMotion: e.target.checked })} /> Reduced motion{systemReduced ? ' (on in your system)' : ''}</label>
            <label><input type="checkbox" checked={settings.sound} onChange={e => { settings.update({ sound: e.target.checked }); if (e.target.checked) feedback.current?.play('select', true, false); }} /> Sound effects</label>
            <label><input type="checkbox" checked={settings.music} onChange={e => settings.update({ music: e.target.checked })} /> Ambient music</label>
            <label><input type="checkbox" checked={settings.haptics} onChange={e => settings.update({ haptics: e.target.checked })} /> Haptics</label>
            <p>Self-paced: no timers. You can change your mind until you lock.</p>
            <button onClick={() => setSettingsOpen(false)}>Done</button>
          </section>
        )}

        {mapOpen ? (
          <MasteryMap sets={sets} mastery={saved ?? projected} now={now} assets={assets} onClose={() => setMapOpen(false)} />
        ) : state.matches('home') ? (
          sets.length ? <Home assets={assets} ready={ready} due={due} hasProgress={hasProgress} onStart={start} onMap={() => setMapOpen(true)} />
            : <section className="lw-summary"><h1 tabIndex={-1} data-autofocus>No distinctions are published yet.</h1><p>Check back soon.</p></section>
        ) : state.matches('card') && step && step.kind !== 'round' ? (
          <CardScreen card={step} sets={sets} onNext={next} onFinish={finish} />
        ) : state.matches('recap') ? (
          <Recap before={baseline} after={saved ?? projected} records={context.records} skipped={skipped} corrected={corrected} now={context.completedAt ?? now}
            assets={assets} saveStatus={storage} onRetry={storage.startsWith('Save failed') ? () => setSaveAttempt(n => n + 1) : undefined}
            onHome={() => { if (saved) setBaseline(saved); setNow(Date.now()); send({ type: 'HOME' }); }} onMap={() => setMapOpen(true)} />
        ) : current ? (
          <section className="lw-play" aria-label="Semantic chamber">
            <div className="lw-round-header">
              <span className="lw-eyebrow"><span />{ROLE_LABEL[current.round.role]}</span>
              <span className="lw-small">{current.chain.frame ?? ''}</span>
            </div>

            <div className="lw-context-shell" {...bind()}>
              <div className="lw-context-top">
                <span>{state.matches('paused') ? 'PAUSED' : judged ? 'THE TURNING POINT' : context.beat === 0 ? 'READ THE SITUATION' : 'NEW EVIDENCE'}</span>
                <ol className="lw-beat-dots" aria-label={`Beat ${context.beat + 1} of ${current.chain.beats.length}`}>
                  {current.chain.beats.map((b, i) => <li key={b.id} data-active={i <= context.beat} aria-current={i === context.beat ? 'step' : undefined} />)}
                </ol>
              </div>
              <h2 className="lw-sr-only" tabIndex={-1} data-autofocus>Beat {context.beat + 1} of {current.chain.beats.length}</h2>
              {current.chain.beats.slice(0, context.beat).map(b => <p key={b.id} className="lw-previous">{b.text}</p>)}
              {/* Text settles before reading: one short fade/rise, then static (§41). */}
              <motion.p key={beatKey} className="lw-sentence" aria-live="polite"
                initial={{ opacity: 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0.12 : timing.context / 1000, ease: [0.2, 0.7, 0.2, 1] }}>
                {judged ? <ClueText text={current.beat.text} clue={current.beat.decisive_clue} /> : current.beat.text}
              </motion.p>
              {judged && state.matches('beatFeedback') && <p className="lw-beat-reason">{current.beat.reason}</p>}
              {hintText && reading && <p className="lw-hint" role="status"><Icon assets={assets} id="hint" fallback={Lightbulb} size={16} />{hintText}</p>}
            </div>

            <div className="lw-word-field" data-locked={!reading} {...bind()}>
              {tier !== 'lite' && (
                <div className="lw-canvas" aria-hidden="true">
                  <ChamberBoundary onUnavailable={onUnavailable}>
                    <Chamber words={words} selected={context.selected} locked={!reading} best={judged ? current.beat.best_word : null}
                      missed={Boolean(judged && lastRecord?.correctness === 'incorrect')} beat={context.beat} beatKey={beatKey}
                      reduced={reduced} tier={tier} tilt={tilt} assets={assets} onUnavailable={onUnavailable} />
                  </ChamberBoundary>
                </div>
              )}
              <div className="lw-choices" role="group" aria-label="Choose the word that fits now" style={{ gridTemplateColumns: `repeat(${words.length}, minmax(0, 1fr))` }}>
                {words.map((word, index) => {
                  const chosen = context.selected === word;
                  const stronger = judged && current.beat.best_word === word;
                  return (
                    <button key={word} className="lw-word" data-word={word} data-selected={chosen} data-stronger={stronger} aria-pressed={chosen} disabled={!reading} onClick={() => select(word)}>
                      <span className="lw-word-index" aria-hidden="true">{index + 1}</span>
                      <strong>{word}</strong>
                      <span className="lw-word-status">{stronger ? 'BEST FIT' : chosen ? (reading ? 'SELECTED · REVERSIBLE' : 'LOCKED') : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {current.round.askConfidence && reading && (
              <fieldset className="lw-confidence">
                <legend>How sure are you? <span>(optional)</span></legend>
                {(['guessing', 'pretty-sure', 'certain'] as const).map(value => (
                  <label key={value}><input type="radio" name="confidence" checked={context.confidence === value} onChange={() => send({ type: 'CONFIDENCE', confidence: value })} />{value === 'pretty-sure' ? 'Pretty sure' : value === 'certain' ? 'Certain' : 'Guessing'}</label>
                ))}
              </fieldset>
            )}

            {state.matches('feedback') && roundRecords.length > 0 ? (
              <RoundFeedback chain={current.chain} records={roundRecords} onNext={next} onFinish={finish} nextLabel="Continue" />
            ) : (
              <div className="lw-action-row">
                <p role="status" className="lw-action-status" data-correctness={judged ? lastRecord?.correctness : undefined}>
                  {state.matches('paused') ? 'Paused. Take your time.' : judged && lastRecord ? `${verdictLabel(lastRecord.correctness)} · ${current.chain.purpose === 'tutorial' ? 'guided, no points' : `+${lastRecord.score} pts`}${lastRecord.correctness === 'best' ? '' : ` · ${current.beat.best_word} fits better`}` : context.selected ? `${context.selected} · you can still change it` : 'Tap a word, swipe, or use ← →'}
                </p>
                {reading && current.round.hintsAllowed && context.hintLevel < 3 && (
                  <button className="lw-text-button" onClick={() => { cue('hint'); send({ type: 'HINT' }); }}>{context.hintLevel ? 'Another hint' : 'Hint'}</button>
                )}
                {reading && <button className="lw-icon-button" aria-label="Pause" onClick={() => send({ type: 'PAUSE', now: Date.now() })}><Pause size={16} /></button>}
                {state.matches('paused') ? <button className="lw-primary" onClick={() => send({ type: 'RESUME', now: Date.now() })}>Resume</button>
                  : reading ? <button className="lw-primary" disabled={!context.selected} onClick={lock}><Lock size={16} aria-hidden="true" />{context.beat === current.chain.beats.length - 1 ? 'Have the last word' : 'Lock this reading'}</button>
                    : <button className="lw-primary" onClick={next}>Continue<ArrowRight size={18} aria-hidden="true" /></button>}
              </div>
            )}
            <p className="lw-controls">← → or A / D to move · 1–{words.length} to choose · Enter to lock · swipe to switch</p>
          </section>
        ) : null}

        <footer className="lw-footer">
          <span>{tier === 'lite' ? 'LITE CHAMBER' : tier === 'standard' ? 'STANDARD CHAMBER' : 'FULL CHAMBER'}{reduced ? ' · REDUCED MOTION' : ''}</span>
          {!state.matches('home') && !state.matches('recap') && <button className="lw-text-button" onClick={finish}>End session</button>}
        </footer>
      </main>
    </MotionConfig>
  );
}
