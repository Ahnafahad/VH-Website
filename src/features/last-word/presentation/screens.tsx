'use client';

import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { ArrowRight, Check, Circle, CircleDot, Lightbulb, Network, Play, RotateCcw, Zap, type LucideProps } from 'lucide-react';
import { assetUrl, type AssetUrls } from '../assets/runtime';
import type { LastWordChain, LastWordSet } from '../content/schema';
import type { DecisionRecord, EdgeMastery, MasterySnapshot } from '../core/types';
import type { Card } from '../game/session';
import { indexEdges } from '../game/session';

// ------------------------------------------------------------------ shared bits

/** A manifest icon tinted with currentColor via CSS mask; the Lucide glyph when the file is absent. */
export function Icon({ assets, id, fallback: Fallback, size = 20 }: { assets: AssetUrls; id: string; fallback: ComponentType<LucideProps>; size?: number }) {
  const url = assetUrl(assets, `icon.${id}`);
  if (!url) return <Fallback size={size} aria-hidden="true" />;
  return <span aria-hidden="true" className="lw-icon" style={{ width: size, height: size, maskImage: `url(${url})`, WebkitMaskImage: `url(${url})` }} />;
}

export type Status = 'NEW' | 'GETTING IT' | 'RELIABLE' | 'FLUENT' | 'MASTERED' | 'REVIEW DUE';
/** §25: plain-language status, never a raw score. */
export function statusOf(edge: EdgeMastery | undefined, mastery: MasterySnapshot, now: number): Status {
  if (!edge || edge.status === 'Unseen') return 'NEW';
  const review = mastery.reviews[edge.edgeId];
  if (review && review.intervalDays > 0 && review.dueAt <= now) return 'REVIEW DUE';
  return ({ Exploring: 'GETTING IT', Distinguishing: 'GETTING IT', Reliable: 'RELIABLE', Fluent: 'FLUENT', Mastered: 'MASTERED' } as const)[edge.status];
}
const STATUS_ICON: Record<Status, string> = { NEW: 'status-new', 'GETTING IT': 'status-getting-it', RELIABLE: 'status-reliable', FLUENT: 'status-fluent', MASTERED: 'status-mastered', 'REVIEW DUE': 'status-review-due' };
export function StatusBadge({ status, assets }: { status: Status; assets: AssetUrls }) {
  return <span className="lw-status" data-status={status}><Icon assets={assets} id={STATUS_ICON[status]} fallback={status === 'MASTERED' ? CircleDot : Circle} size={16} />{status}</span>;
}
export const edgeLabel = (edgeId: string) => edgeId.split('__').join(' ↔ ');

/** The decisive clue highlighted in place when it is an exact excerpt, otherwise quoted after the text. */
export function ClueText({ text, clue }: { text: string; clue: string }) {
  const at = text.indexOf(clue);
  if (at < 0) return <>{text} <span className="lw-clue-quote">Key detail: “{clue}”</span></>;
  return <>{text.slice(0, at)}<mark>{clue}</mark>{text.slice(at + clue.length)}</>;
}

function Summary({ symbol, eyebrow, title, children }: { symbol: ReactNode; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="lw-summary">
      <div className="lw-summary-symbol" aria-hidden="true">{symbol}</div>
      <span className="lw-eyebrow"><span />{eyebrow}</span>
      <h1 tabIndex={-1} data-autofocus>{title}</h1>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ home

export function Home({ assets, ready, due, hasProgress, onStart, onMap }: {
  assets: AssetUrls; ready: boolean; due: number; hasProgress: boolean;
  onStart: (mode: 'journey' | 'quick' | 'review') => void; onMap: () => void;
}) {
  const sculpture = assetUrl(assets, 'image.launch-sculpture');
  return (
    <section className="lw-launch">
      <span className="lw-eyebrow"><span />THE SEMANTIC CHAMBER</span>
      <h1 tabIndex={-1} data-autofocus>Meaning moves.<br /><em>Move with it.</em></h1>
      <p>A situation unfolds one detail at a time. Find the word that fits <em>now</em>.</p>
      {sculpture
        ? <img className="lw-launch-image" src={sculpture} alt="" width={600} height={400} />
        : <div className="lw-launch-sculpture" aria-hidden="true"><div className="lw-orbit" /><span className="lw-mini-tile">persistent</span><i>↔</i><span className="lw-mini-tile">obstinate</span></div>}
      <button className="lw-primary" disabled={!ready} onClick={() => onStart('journey')}>
        <Icon assets={assets} id="continue" fallback={Play} size={18} />{hasProgress ? 'Continue' : 'Enter the chamber'}<ArrowRight size={18} aria-hidden="true" />
      </button>
      <div className="lw-home-actions">
        <button className="lw-secondary" disabled={!ready || !hasProgress} onClick={() => onStart('quick')}><Icon assets={assets} id="quick-run" fallback={Zap} size={18} />Quick Run</button>
        <button className="lw-secondary" disabled={!ready || !due} onClick={() => onStart('review')}><Icon assets={assets} id="review" fallback={RotateCcw} size={18} />Review{due ? ` · ${due} due` : ''}</button>
        <button className="lw-secondary" disabled={!ready} onClick={onMap}><Icon assets={assets} id="mastery-map" fallback={Network} size={18} />Mastery Map</button>
      </div>
      <p className="lw-small">Your pace. No countdown. Sound and haptics are optional.</p>
    </section>
  );
}

// ------------------------------------------------------------------ cards between rounds

export function CardScreen({ card, sets, onNext, onFinish }: { card: Card; sets: LastWordSet[]; onNext: () => void; onFinish: () => void }) {
  const set = 'setId' in card ? sets.find(s => s.set_id === card.setId) : undefined;
  const edge = 'edgeId' in card ? sets.flatMap(s => s.edges).find(e => e.id === card.edgeId) : undefined;
  const next = (label: string) => <button className="lw-primary" onClick={onNext}>{label}<ArrowRight size={18} aria-hidden="true" /></button>;

  if (card.kind === 'message') return (
    <Summary symbol={<Check size={30} />} eyebrow="LEARN THE FEEL" title={card.text}>{next('Continue')}</Summary>
  );
  if (card.kind === 'intro' && edge) return (
    // §22.2: the words as spatially related objects, no definitions yet.
    <Summary symbol={<Network size={30} />} eyebrow="A NEW DISTINCTION" title="Prove what you know">
      <div className="lw-intro-words">{[edge.a, edge.b].map(word => <span key={word} className="lw-mini-tile">{word}</span>)}</div>
      <p>Two short situations first. No teaching until you’ve shown what you already know.</p>
      {next('Prove what you know')}
    </Summary>
  );
  if (card.kind === 'diagnosis') {
    const titles = { A: 'You already own this distinction.', B: 'The words are familiar.', C: 'Let’s sharpen the boundary.', D: 'One detail to reconsider.' };
    return (
      <Summary symbol={<CircleDot size={30} />} eyebrow={`YOUR COLD READ · ${edgeLabel(card.edgeId).toUpperCase()}`} title={titles[card.result.outcome]}>
        <p>{card.result.message}</p>
        {next(card.result.outcome === 'A' ? 'Move on' : 'Follow the meaning')}
        <button className="lw-text-button" onClick={onFinish}>Finish with recap</button>
      </Summary>
    );
  }
  if (card.kind === 'contrast' && edge && set) return (
    // §16: the 2-card contrast, from the content's own senses and boundary rule.
    <Summary symbol={<Lightbulb size={30} />} eyebrow="THE BOUNDARY" title="Where one word stops and the other starts">
      <div className="lw-contrast-cards">
        {[edge.a, edge.b].map(word => {
          const w = set.words.find(item => item.word === word)!;
          return <div key={word}><strong>{word}</strong><p>{w.sense}</p></div>;
        })}
      </div>
      <p className="lw-contrast">{edge.boundary_rule}</p>
      {next('Try a fresh situation')}
    </Summary>
  );
  if (card.kind === 'anchors' && edge && set?.anchors) return (
    <Summary symbol={<Lightbulb size={30} />} eyebrow="CLEAR EXAMPLES" title="Start with the clear cases">
      <div className="lw-contrast-cards">
        {[edge.a, edge.b].map(word => (
          <div key={word}><strong>{word}</strong><ul>{(set.anchors!.positive[word] ?? []).slice(0, 2).map(line => <li key={line}>{line}</li>)}</ul></div>
        ))}
      </div>
      {next('Now the harder ones')}
    </Summary>
  );
  return <Summary symbol={<Check size={30} />} eyebrow="" title="Continue">{next('Continue')}</Summary>;
}

// ------------------------------------------------------------------ round feedback (§22.5, §35, §40)

export function RoundFeedback({ chain, records, onNext, onFinish, nextLabel }: { chain: LastWordChain; records: DecisionRecord[]; onNext: () => void; onFinish: () => void; nextLabel: string }) {
  const last = records.at(-1)!;
  const beat = chain.beats.find(b => b.id === last.beatId)!;
  const perfect = records.length === chain.beats.length && records.every(r => r.correctness === 'best');
  const held = beat.shift_type === 'false_shift' && last.correctness === 'best' && last.previousSelection === last.selectedWord;
  const verdict = last.correctness === 'best' ? (held ? 'You held your ground.' : `${beat.best_word} fits.`) : `${beat.best_word} fits ${last.correctness === 'defensible' ? 'more precisely' : 'here'}.`;
  const turn = chain.beats.findIndex((b, i) => i > 0 && b.best_word !== chain.beats[i - 1].best_word);
  return (
    <section className="lw-feedback" aria-label="Feedback" data-correctness={last.correctness}>
      <span className="lw-eyebrow"><span />{perfect ? 'PERFECT READ' : last.correctness === 'best' ? 'PRECISELY READ' : last.correctness === 'defensible' ? 'A DEFENSIBLE READING' : 'NOTICE THE DETAIL'}</span>
      <h2 tabIndex={-1} data-autofocus>{verdict}</h2>
      <p className="lw-feedback-short">{chain.feedback_short}</p>
      <p className="lw-feedback-clue"><ClueText text={beat.text} clue={beat.decisive_clue} /></p>
      <p className="lw-contrast">{chain.contrast_rule}</p>
      {perfect && <ol className="lw-path" aria-label="Your path">{chain.beats.map(b => <li key={b.id}>{b.best_word}</li>)}</ol>}
      <details>
        <summary>Why?</summary>
        <p>{chain.feedback_deep}</p>
        {turn > 0 && (
          // §35/§36 counterfactual: what had to change for the other word to fit.
          <p className="lw-counterfactual">Before “{chain.beats[turn].decisive_clue}”, <strong>{chain.beats[turn - 1].best_word}</strong> fit: {chain.beats[turn - 1].reason} After it, <strong>{chain.beats[turn].best_word}</strong>: {chain.beats[turn].reason}</p>
        )}
        <ol>{records.map((r, i) => <li key={r.id}>Beat {i + 1}: you chose {r.selectedWord} ({r.correctness}). {chain.beats.find(b => b.id === r.beatId)?.reason}</li>)}</ol>
      </details>
      <div className="lw-action-row">
        <button className="lw-text-button" onClick={onFinish}>End session</button>
        <button className="lw-primary" onClick={onNext}>{nextLabel}<ArrowRight size={18} aria-hidden="true" /></button>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ recap (§22.6, §25)

const WHY: Record<string, string> = { shift: 'a context flip', hold: 'a false shift you held through', transfer: 'a new-domain transfer example', retention: 'a delayed recall', standard: 'a standard context' };

export function Recap({ before, after, records, skipped, corrected, now, assets, saveStatus, onRetry, onHome, onMap }: {
  before: MasterySnapshot; after: MasterySnapshot; records: DecisionRecord[]; skipped: number; corrected: number; now: number;
  assets: AssetUrls; saveStatus: string; onRetry?: () => void; onHome: () => void; onMap: () => void;
}) {
  const touched = [...new Set(records.map(r => r.edgeId))].filter(id => after.edges[id]);
  const reviews = Object.values(after.reviews).filter(r => r.intervalDays > 0).map(r => r.dueAt).sort((a, b) => a - b);
  const nextReview = reviews[0];
  const days = nextReview ? Math.max(0, Math.round((nextReview - now) / 86_400_000)) : null;
  return (
    <Summary symbol={<Check size={30} />} eyebrow="TODAY YOU SHARPENED" title="A little more precise.">
      <div className="lw-mastery-list">
        {touched.length === 0 && <p>The tutorial teaches the feel; distinctions start counting in your next session.</p>}
        {touched.map(id => {
          const was = statusOf(before.edges[id], before, now);
          const is = statusOf(after.edges[id], after, now);
          const kinds = after.edges[id].kinds.filter(k => !(before.edges[id]?.kinds ?? []).includes(k));
          return (
            <div className="lw-mastery-row" key={id}>
              <div><span>{edgeLabel(id)}</span><small>{kinds.length ? `You handled ${new Intl.ListFormat('en', { type: 'conjunction' }).format(kinds.map(k => WHY[k] ?? k))}.` : 'More evidence collected.'}</small></div>
              <StatusBadge status={is} assets={assets} />{was !== is && <span className="lw-sr-only">changed from {was}</span>}
            </div>
          );
        })}
      </div>
      <ul className="lw-recap-lines">
        {skipped > 0 && <li>{skipped} distinction{skipped > 1 ? 's' : ''} skipped because you already knew {skipped > 1 ? 'them' : 'it'}.</li>}
        {corrected > 0 && <li>{corrected} misconception{corrected > 1 ? 's' : ''} corrected.</li>}
        <li>{days === null ? 'No review scheduled yet.' : days === 0 ? 'Next review: later today.' : days === 1 ? 'Next review: tomorrow.' : `Next review: in ${days} days.`}</li>
      </ul>
      <p role="status" className="lw-small">{saveStatus}</p>
      {onRetry && <button className="lw-text-button" onClick={onRetry}>Retry saving</button>}
      <div className="lw-home-actions">
        <button className="lw-primary" onClick={onHome}>Back to the chamber<ArrowRight size={18} aria-hidden="true" /></button>
        <button className="lw-secondary" onClick={onMap}><Network size={18} aria-hidden="true" />Mastery Map</button>
      </div>
    </Summary>
  );
}

// ------------------------------------------------------------------ mastery map (§22.7, §38)

export function MasteryMap({ sets, mastery, now, assets, onClose }: { sets: LastWordSet[]; mastery: MasterySnapshot; now: number; assets: AssetUrls; onClose: () => void }) {
  const edges = useMemo(() => indexEdges(sets).map(e => e.set.edges.find(x => x.id === e.edgeId)!), [sets]);
  const words = useMemo(() => [...new Set(edges.flatMap(e => [e.a, e.b]))], [edges]);
  const [focus, setFocus] = useState<string | null>(null);
  // ponytail: words on one ring; fine for tens of words, a force layout when the bank grows into hundreds.
  const pos = (word: string) => {
    const i = words.indexOf(word);
    const angle = (i / words.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + 40 * Math.cos(angle), y: 50 + 40 * Math.sin(angle) };
  };
  const shown = focus ? edges.filter(e => e.a === focus || e.b === focus) : edges;
  return (
    <section className="lw-map" aria-labelledby="lw-map-title">
      <div className="lw-round-header"><h1 id="lw-map-title" tabIndex={-1} data-autofocus>Mastery Map</h1><button className="lw-text-button" onClick={onClose}>Close</button></div>
      <p className="lw-small">Words are points; the lines between them are distinctions. Select a word to see its neighbours.</p>
      <svg viewBox="0 0 100 100" className="lw-map-graph" aria-hidden="true">
        {edges.map(e => {
          const a = pos(e.a), b = pos(e.b);
          const status = statusOf(mastery.edges[e.id], mastery, now);
          return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} data-status={status} data-dim={focus !== null && !shown.includes(e)} />;
        })}
        {words.map(w => {
          const p = pos(w);
          const node = mastery.nodes[w];
          return <g key={w} transform={`translate(${p.x} ${p.y})`} data-focus={focus === w} data-known={node?.status ?? 'Unknown'}><circle r={2.4} /><text y={-4} textAnchor="middle">{w}</text></g>;
        })}
      </svg>
      <div className="lw-map-words" role="group" aria-label="Words">
        {words.map(w => <button key={w} aria-pressed={focus === w} onClick={() => setFocus(focus === w ? null : w)}>{w}<small>{mastery.nodes[w]?.status ?? 'Unknown'}</small></button>)}
      </div>
      <ul className="lw-mastery-list" aria-label="Distinctions">
        {shown.map(e => (
          <li className="lw-mastery-row" key={e.id}>
            <div><span>{edgeLabel(e.id)}</span><small>{e.boundary_rule}</small></div>
            <StatusBadge status={statusOf(mastery.edges[e.id], mastery, now)} assets={assets} />
          </li>
        ))}
      </ul>
    </section>
  );
}

