'use client';

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMachine } from '@xstate/react';
import { useDrag } from '@use-gesture/react';
import { useSpring } from '@react-spring/three';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, AudioLines, Check, ChevronRight, Fingerprint, Orbit, Pause, Settings2, Sparkles } from 'lucide-react';
import type { LastWordSet } from './content/schema';
import { updateMastery } from './core/learning';
import { emptyMastery, type MasterySnapshot } from './core/types';
import { BrowserLastWordPersistence, HttpLastWordPersistence, type LastWordPersistence } from './persistence';
import { currentContent, diagnostic, lastWordMachine } from './game/machine';
import { useLastWordMastery, useLastWordSettings } from './game/store';
import { createFeedbackHooks, type Cue } from './presentation/audio';
import { detectTier, timing, type PresentationTier } from './presentation/tokens';
import './last-word.css';

const Chamber = dynamic(() => import('./presentation/SemanticChamber'), { ssr: false });
class ChamberBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function LastWordGame({ sets }: { sets: LastWordSet[] }) {
  const [state, send] = useMachine(lastWordMachine, { input: { sets, sessionId: 'pending', now: 0 } });
  const { status: authStatus } = useSession();
  const settings = useLastWordSettings();
  const masteryStore = useLastWordMastery();
  const systemReduced = useReducedMotion();
  const [capability, setCapability] = useState<PresentationTier>('lite');
  const [webglFailed, setWebglFailed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [baseline, setBaseline] = useState<MasterySnapshot>(emptyMastery);
  const [storageStatus, setStorageStatus] = useState('Loading progress');
  const [ready, setReady] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const repository = useRef<LastWordPersistence | null>(null);
  const sound = useRef<ReturnType<typeof createFeedbackHooks> | null>(null);
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [palette, setPalette] = useState({ surface: '#172e39', edge: '#a9e3dc', light: '#c1a7e8' });
  const [{ tilt }, springApi] = useSpring(() => ({ tilt: 0, config: { tension: 260, friction: 24 } }));
  const reduced = Boolean(settings.reducedMotion || systemReduced);
  const tier = webglFailed ? 'lite' : settings.tier === 'auto' ? capability : settings.tier;
  const { context } = state;
  const { set, chain, beat } = currentContent(context);
  const words = set.words.map((word) => word.word);
  const reading = state.matches('reading');
  const feedback = state.matches('feedback');
  const locked = state.matches('locked');
  const tutorial = context.round < 2;
  const diagnosing = context.round >= 2 && context.round <= 4;
  const last = context.records.at(-1);
  const beatKey = `${chain.id}-${beat.id}`;
  const phase = String(state.value);
  const live = !['home', 'diagnosis', 'recap'].includes(phase);

  useEffect(() => {
    setCapability(detectTier());
    sound.current = createFeedbackHooks();
    const style = root.current && getComputedStyle(root.current);
    if (style) setPalette({ surface: style.getPropertyValue('--lw-object').trim(), edge: style.getPropertyValue('--lw-accent').trim(), light: style.getPropertyValue('--lw-secondary').trim() });
    send({ type: 'RESTART', now: Date.now(), sessionId: crypto.randomUUID() });
    return () => sound.current?.dispose();
  }, [send]);

  useEffect(() => {
    if (authStatus === 'loading') return;
    let cancelled = false;
    repository.current = authStatus === 'authenticated' ? new HttpLastWordPersistence() : new BrowserLastWordPersistence(localStorage);
    repository.current.load().then((snapshot) => {
      if (cancelled) return;
      setBaseline(snapshot); useLastWordMastery.getState().replace(snapshot);
      setStorageStatus(authStatus === 'authenticated' ? 'Account progress connected' : 'Progress stays on this browser');
      setReady(true);
    }).catch(() => {
      if (cancelled) return;
      setStorageStatus('Progress could not load. Your session can still be played; saving can be retried.');
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [authStatus]);

  const cue = useCallback((name: Cue) => {
    const preferences = useLastWordSettings.getState();
    sound.current?.play(name, preferences.sound, preferences.haptics);
  }, []);
  useEffect(() => { if (reading) cue('arrival'); }, [beatKey, reading, cue]);
  useEffect(() => {
    if (feedback && last) cue(last.correctness);
    if (state.matches('recap')) cue('mastery');
  }, [feedback, phase, last, cue, state]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [phase, beatKey]);

  const projected = useMemo(() => context.records.filter((record) => !record.scenarioId.startsWith('ca_tutorial')).reduce(updateMastery, baseline), [context.records, baseline]);
  useEffect(() => { useLastWordMastery.getState().replace(projected); }, [projected]);

  useEffect(() => {
    if (!context.completedAt || !repository.current) return;
    let cancelled = false;
    setStorageStatus('Saving your distinctions…');
    repository.current.saveSession({ id: context.sessionId, startedAt: context.startedAt, completedAt: context.completedAt, decisions: context.records }).then((snapshot) => {
      if (cancelled) return;
      useLastWordMastery.getState().replace(snapshot);
      setStorageStatus(authStatus === 'authenticated' ? 'Saved to your account' : 'Saved on this browser');
    }).catch(() => { if (!cancelled) setStorageStatus('Save failed. Your results are still here.'); });
    return () => { cancelled = true; };
  }, [context.completedAt, context.records, context.sessionId, context.startedAt, authStatus, saveAttempt]);

  const select = useCallback((word: string) => {
    if (!reading) return;
    cue(context.selected && context.selected !== word ? 'switch' : 'selection');
    send({ type: 'SELECT', word });
  }, [reading, cue, context.selected, send]);
  const bind = useDrag(({ active, movement: [x], last: released, canceled }) => {
    springApi.start({ tilt: reduced || !active ? 0 : Math.max(-1, Math.min(1, x / 100)) });
    if (released && !canceled && Math.abs(x) > 35 && reading) {
      const current = Math.max(0, words.indexOf(context.selected ?? ''));
      select(words[Math.max(0, Math.min(words.length - 1, current + (x > 0 ? 1 : -1)))]);
    }
  }, { axis: 'x', filterTaps: true, pointer: { touch: true } });
  const advance = () => {
    if (reading) { if (context.selected) { cue('lock'); send({ type: 'LOCK', now: Date.now() }); } }
    else if (state.matches('paused')) send({ type: 'RESUME', now: Date.now() });
    else send({ type: 'NEXT', now: Date.now() });
  };
  const onUnavailable = useCallback(() => setWebglFailed(true), []);
  const diagnosis = diagnostic(context);
  const roundRecords = context.records.filter((record) => record.scenarioId === chain.id);
  const score = context.records.reduce((total, record) => total + record.score, 0);

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <main ref={root} className="lw-game" data-tier={tier} data-reduced={reduced} data-phase={phase} data-beat={beatKey}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('select,input,summary,[data-settings]') || target.tagName === 'A') return;
          if (reading && ['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', '1', '2', '3', '4', '5'].includes(event.key)) {
            event.preventDefault();
            const current = Math.max(0, words.indexOf(context.selected ?? ''));
            const index = /^\d$/.test(event.key) ? Number(event.key) - 1 : Math.max(0, Math.min(words.length - 1, current + (['ArrowLeft', 'a', 'A'].includes(event.key) ? -1 : 1)));
            if (words[index]) select(words[index]);
          } else if (['Enter', ' '].includes(event.key) && (target.tagName !== 'BUTTON' || target.hasAttribute('data-word'))) {
            event.preventDefault();
            if (live) advance();
          }
        }}>
        <div className="lw-atmosphere" aria-hidden="true"><div /><div /></div>
        <header className="lw-header">
          <Link href="/vocab/home" className="lw-back" aria-label="Back to vocabulary"><ArrowLeft size={18} /></Link>
          <Link href="/last-word" className="lw-logotype">LAST<span>WORD</span><i /></Link>
          <span className="lw-header-note">A GAME OF MEANING</span>
          <button className="lw-icon-button" aria-label="Game settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={19} /></button>
        </header>

        {settingsOpen && <section className="lw-settings" data-settings aria-label="Game settings">
          <label>Presentation<select aria-label="Presentation" value={settings.tier} onChange={(e) => settings.update({ tier: e.target.value as PresentationTier | 'auto' })}>
            <option value="auto">Automatic</option><option value="full">Full 3D</option><option value="standard">Standard</option><option value="lite">Lite</option>
          </select></label>
          <label><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => settings.update({ reducedMotion: e.target.checked })} /> Reduced motion{systemReduced ? ' (system enabled)' : ''}</label>
          <label><input type="checkbox" checked={settings.sound} onChange={(e) => { settings.update({ sound: e.target.checked }); if (e.target.checked) cue('selection'); }} /> Sound</label>
          <label><input type="checkbox" checked={settings.haptics} onChange={(e) => settings.update({ haptics: e.target.checked })} /> Haptics</label>
          <p>Self-paced. No countdown. Change your mind until you lock.</p>
          <button onClick={() => setSettingsOpen(false)}>Done</button>
        </section>}

        {state.matches('home') && <section className="lw-launch">
          <div className="lw-eyebrow"><span /> THE SEMANTIC CHAMBER</div>
          <h1 ref={heading} tabIndex={-1}>Meaning moves.<br /><em>Move with it.</em></h1>
          <p>A situation unfolds. One detail changes everything.<br className="lw-desktop" /> Find the word that fits <em>now.</em></p>
          <div className="lw-launch-sculpture" aria-hidden="true"><div className="lw-orbit" /><span className="lw-mini-tile">persistent</span><i>↔</i><span className="lw-mini-tile">obstinate</span></div>
          <button className="lw-primary" disabled={!ready} onClick={() => { send({ type: 'START', now: Date.now() }); }}>Enter the chamber <ArrowRight size={18} /></button>
          <p className="lw-small">A short guided run · Your pace · Headphones optional</p>
          <div className="lw-launch-footer"><span><Fingerprint size={16} /> FEEL THE DISTINCTION</span><span><Orbit size={16} /> FOLLOW THE CONTEXT</span></div>
        </section>}

        {live && <section className="lw-play" aria-label="Semantic chamber">
          <div className="lw-round-header"><span className="lw-eyebrow">{tutorial ? 'LEARN THE FEEL' : diagnosing ? 'PROVE WHAT YOU KNOW' : 'FOLLOW THE MEANING'}</span><span className="lw-small">{tutorial ? 'Tutorial' : diagnosing ? 'Cold diagnostic' : `Round ${context.round - 4} / 2`}</span></div>
          <div className="lw-context-shell" {...bind()}>
            <div className="lw-context-ornament" aria-hidden="true">⌖</div>
            <div className="lw-context-top"><span>{state.matches('paused') ? 'PAUSED' : locked ? 'DECISION LOCKED' : feedback ? 'THE TURNING POINT' : context.beat === 0 ? 'READ THE SITUATION' : 'NEW EVIDENCE'}</span><div className="lw-beat-dots" aria-label={`Beat ${context.beat + 1} of ${chain.beats.length}`}>{chain.beats.map((item, index) => <i key={item.id} data-active={index <= context.beat} />)}</div></div>
            <h1 ref={heading} tabIndex={-1} className="lw-sr-only">{tutorial ? 'Tutorial' : diagnosing ? 'Cold diagnostic' : 'Last Word round'}, beat {context.beat + 1}</h1>
            {context.beat > 0 && <p className="lw-previous">{chain.beats[context.beat - 1].text}</p>}
            <motion.p key={beatKey} className="lw-sentence" initial={{ opacity: reduced ? 1 : 0, transform: reduced ? 'none' : 'translateY(12px) scale(.985)' }} animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }} transition={{ duration: reduced ? 0 : timing.context / 1000, ease: [0.2, 0.7, 0.2, 1] }}>
              {feedback ? <>{beat.text.split(beat.decisive_clue)[0]}<mark>{beat.decisive_clue}</mark>{beat.text.split(beat.decisive_clue)[1]}</> : beat.text}
            </motion.p>
            <div className="lw-context-bottom"><span>{tutorial ? context.beat === 0 ? 'Choose the word that fits. You can change your mind.' : 'Read the new detail. Keep your choice or move.' : 'Which word fits the situation now?'}</span>{reading && <button aria-label="Pause reading" className="lw-icon-button" onClick={() => send({ type: 'PAUSE', now: Date.now() })}><Pause size={15} /></button>}</div>
          </div>

          <div className="lw-word-field" data-feedback={feedback} data-locked={locked} {...bind()}>
            <div className="lw-connection" aria-hidden="true"><span /></div>
            {tier !== 'lite' && <div className="lw-canvas" aria-hidden="true"><ChamberBoundary onUnavailable={onUnavailable}><Chamber words={words} selected={context.selected} locked={locked || feedback} feedback={feedback} best={feedback ? beat.best_word : null} confidentError={Boolean(last?.confidence === 'certain' && last?.correctness === 'incorrect')} beatKey={beatKey} reduced={reduced} tier={tier} tilt={tilt} palette={palette} onUnavailable={onUnavailable} /></ChamberBoundary></div>}
            <div className="lw-choices" style={{ gridTemplateColumns: `repeat(${words.length}, minmax(0, 1fr))` }} role="group" aria-label="Choose a word">
              {words.map((word, index) => <button key={word} data-word={word} data-selected={context.selected === word} data-stronger={feedback && beat.best_word === word} className="lw-word" aria-pressed={context.selected === word} aria-label={`Choose ${word}`} disabled={!reading} onClick={() => select(word)}>
                <span className="lw-word-index">0{index + 1}</span><strong>{word}</strong><span className="lw-word-status">{feedback && beat.best_word === word ? 'BEST FIT' : context.selected === word ? locked || feedback ? 'LOCKED' : 'MAGNETISED' : 'SELECT WORD'}{context.selected === word && <span aria-hidden="true"> ◇</span>}</span>
              </button>)}
            </div>
          </div>

          {diagnosing && reading && <fieldset className="lw-confidence"><legend>How sure are you? <span>(optional)</span></legend>{(['guessing', 'pretty-sure', 'certain'] as const).map((value) => <label key={value}><input type="radio" name="confidence" value={value} checked={context.confidence === value} onChange={() => send({ type: 'CONFIDENCE', confidence: value })} />{value === 'pretty-sure' ? 'Pretty sure' : value === 'certain' ? 'Certain' : 'Guessing'}</label>)}</fieldset>}

          {feedback && last && <motion.section className="lw-feedback" aria-label="Feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.24 }}>
            <div className="lw-feedback-icon"><Sparkles size={19} /></div><div><span className="lw-eyebrow">{last.correctness === 'best' ? 'PRECISELY READ' : last.correctness === 'defensible' ? 'A DEFENSIBLE READING' : 'NOTICE THE DISTINCTION'}</span>
              <h2>{last.correctness === 'best' ? beat.shift_type === 'false_shift' ? 'You held your ground.' : `${beat.best_word} fits.` : `${beat.best_word} fits more precisely.`}</h2>
              <p>{beat.reason}</p><p className="lw-contrast">{chain.contrast_rule}</p>
              <details><summary>Why this word?</summary><p>{chain.feedback_deep}</p>{!tutorial && <ol>{roundRecords.map((record, index) => <li key={record.id}>Beat {index + 1}: {record.selectedWord} — {record.correctness}. {chain.beats[index].reason}</li>)}</ol>}</details>
            </div>
          </motion.section>}
          <div className="lw-action-row"><p role="status" className="lw-action-status">{state.matches('paused') ? 'Take your time. Your reading time is paused.' : locked ? `Last word: ${context.selected}.` : feedback ? tutorial ? 'Read the situation. Follow the meaning.' : roundRecords.every((r) => r.correctness === 'best') ? 'Perfect read · Every clue followed' : 'Every detail sharpens the boundary.' : context.selected ? `${context.selected} selected · still reversible` : 'Tap a word, or move with ← →'}</p>
            <button className="lw-primary" disabled={reading && !context.selected} onClick={advance}>{state.matches('paused') ? 'Resume' : reading ? context.beat === chain.beats.length - 1 ? 'Have the last word' : 'Lock this reading' : locked ? tutorial || context.beat === chain.beats.length - 1 ? 'See the meaning' : 'Reveal next beat' : context.round === 6 ? 'Session recap' : 'Continue'}<ArrowRight size={18} /></button>
          </div>
          <p className="lw-controls">← → or A / D to move <span>·</span> 1–{words.length} to select <span>·</span> Space / Enter to lock <span>·</span> Swipe to switch</p>
        </section>}

        {state.matches('diagnosis') && <section className="lw-summary lw-diagnosis"><div className="lw-summary-symbol"><Fingerprint size={36} /></div><span className="lw-eyebrow">YOUR COLD READ · OUTCOME {diagnosis.outcome}</span><h1 ref={heading} tabIndex={-1}>{diagnosis.outcome === 'A' ? 'You know this boundary.' : diagnosis.outcome === 'B' ? 'The words are familiar.' : diagnosis.outcome === 'D' ? 'One detail to reconsider.' : 'Let’s sharpen the distinction.'}</h1><p>{diagnosis.message}</p><p className="lw-small">{diagnosis.outcome === 'A' ? 'Instruction skipped. A later review will check retention. You can finish here or try two optional challenges.' : 'Next: two evolving situations. The explanation follows your judgment.'}</p>
          {context.records.filter((r) => r.scenarioId.startsWith('po_diagnostic') && r.correctness !== 'best').map((record) => <p className="lw-diagnostic-clue" key={record.id}>{set.chains.find((c) => c.id === record.scenarioId)?.beats[0].reason}</p>)}
          <button className="lw-primary" onClick={advance}>{diagnosis.outcome === 'A' ? 'Try the challenges' : 'Follow the meaning'}<ChevronRight size={18} /></button>{diagnosis.outcome === 'A' && <button className="lw-text-button" onClick={() => send({ type: 'FINISH', now: Date.now() })}>Finish with recap</button>}
        </section>}

        {state.matches('recap') && <section className="lw-summary"><div className="lw-summary-symbol"><Check size={32} /></div><span className="lw-eyebrow">TODAY YOU SHARPENED</span><h1 ref={heading} tabIndex={-1}>A little more precise.</h1><p>The words stayed. Your understanding moved.</p>
          <div className="lw-mastery-list">{Object.values(masteryStore.value.edges).map((edge) => <div className="lw-mastery-row" key={edge.edgeId}><div><span>{edge.edgeId.replaceAll('__', ' ↔ ').replaceAll('-', ' ')}</span><small>{edge.bestCount} precise decisions · {edge.kinds.includes('hold') ? 'held through distraction' : 'evidence collected'}</small></div><strong>{edge.status}</strong></div>)}</div>
          <div className="lw-recap-stats"><div><strong>{score}</strong><span>semantic score</span></div><div><strong>{context.records.filter((r) => r.correctness === 'best' && r.kind === 'hold').length}</strong><span>holds read correctly</span></div><div><strong>{diagnosis.skipInstruction ? 1 : 0}</strong><span>distinctions skipped</span></div></div>
          <p className="lw-small">Word knowledge: {Object.values(masteryStore.value.nodes).map((node) => `${node.word} — ${node.status}`).join(' · ') || 'More unassisted evidence needed.'}</p>
          <p className="lw-review-note"><Orbit size={17} />{Object.values(masteryStore.value.reviews).some((review) => review.intervalDays === 0) ? 'A fresh context is due for review.' : 'Next review: tomorrow or later, based on your evidence.'} Durable mastery needs a later session.</p>
          <p role="status" className="lw-small">{storageStatus}</p>{storageStatus.startsWith('Save failed') && <button className="lw-text-button" onClick={() => setSaveAttempt((value) => value + 1)}>Retry saving</button>}
          <Link className="lw-primary" href="/vocab/home">Back to vocabulary <ArrowRight size={18} /></Link>
          <button className="lw-text-button" onClick={() => { setBaseline(masteryStore.value); send({ type: 'RESTART', now: Date.now(), sessionId: crypto.randomUUID() }); }}>Replay this practice fixture</button>
        </section>}
        <footer className="lw-footer"><span><i /> {tier === 'lite' ? 'LITE CHAMBER' : tier === 'standard' ? 'SEMANTIC CHAMBER' : 'FULL CHAMBER'}{reduced ? ' · REDUCED MOTION' : ''}</span><span><AudioLines size={13} /> {settings.sound ? 'SOUND ON' : 'QUIET MODE'}</span></footer>
      </main>
    </MotionConfig>
  );
}
