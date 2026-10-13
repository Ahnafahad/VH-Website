/**
 * Migration 0005 and DatabaseLastWordPersistence against a disposable local libSQL file (never Turso).
 * Every migration in drizzle/ is applied in journal order (0000 → 0005), exactly as production would,
 * so this also proves the Last Word migration composes with the essay/operational schema before it.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/lib/db/schema';
import { readContent, selectPlayable } from '../content/load';
import { evaluateDecision } from '../core/learning';
import { flagItems, positionBias } from '../content/quality';
import { DatabaseLastWordPersistence } from '../persistence/database';
import type { SessionSubmission } from '../persistence/types';

const sets = selectPlayable(readContent(), ['draft', 'audited', 'approved', 'published']);
// A temp file, not :memory:: libSQL transactions open a second connection, which would see an empty memory DB.
const client = createClient({ url: pathToFileURL(join(mkdtempSync(join(tmpdir(), 'lw-db-')), 'test.db')).href });
const db = drizzle(client, { schema });
let userId = 0;

beforeAll(async () => {
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: { tag: string }[] };
  for (const { tag } of journal.entries) {
    const sql = readFileSync(`drizzle/${tag}.sql`, 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await client.executeMultiple(statement);
  }
  const user = await client.execute("INSERT INTO users (email, name, role, status) VALUES ('s@example.com', 'S', 'student', 'active') RETURNING id");
  userId = Number(user.rows[0].id);
});

const po = sets.find(s => s.set_id === 'persistent-obstinate')!;
function session(id: string, start: number, chainId = 'po_flip'): SessionSubmission {
  const chain = po.chains.find(c => c.id === chainId)!;
  return {
    id, startedAt: start, completedAt: start + 60_000,
    decisions: chain.beats.map((beat, i) => ({
      id: `${id}-${i}`, sessionId: id, setId: po.set_id, scenarioId: chain.id, beatId: beat.id, presentedWords: ['persistent', 'obstinate'],
      selectedWord: beat.best_word, previousSelection: i ? chain.beats[i - 1].best_word : null, reactionTimeMs: 3000, hintLevel: 0, confidence: null,
      reviewIntervalDays: 0, occurredAt: start + (i + 1) * 1000,
    })),
  };
}

describe('migration 0005 on a disposable database', () => {
  it('creates all five Last Word tables after the earlier migrations', async () => {
    const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'last_word_%' ORDER BY name")).rows.map(r => r.name);
    expect(tables).toEqual(['last_word_decisions', 'last_word_edge_mastery', 'last_word_node_mastery', 'last_word_reviews', 'last_word_sessions']);
  });

  it('matches the Drizzle schema column for column', async () => {
    for (const table of [schema.lastWordSessions, schema.lastWordDecisions, schema.lastWordEdgeMastery, schema.lastWordNodeMastery, schema.lastWordReviews]) {
      const name = (table as unknown as Record<symbol, string>)[Symbol.for('drizzle:Name')];
      const columns = (await client.execute(`PRAGMA table_info(${name})`)).rows.map(r => String(r.name)).sort();
      const expected = Object.values(table).filter((c): c is { name: string } => typeof c === 'object' && c !== null && 'columnType' in c).map(c => c.name).sort();
      expect(columns, name).toEqual(expected);
    }
  });
});

describe('DatabaseLastWordPersistence', () => {
  it('saves a session, recomputes scores server-side, and is idempotent on retry', async () => {
    const store = new DatabaseLastWordPersistence(db, userId, sets);
    const first = await store.saveSession(session('a', 1_000_000));
    expect(first.edges['persistent__obstinate'].observations).toBe(3);
    const again = await store.saveSession(session('a', 1_000_000));
    expect(again.edges['persistent__obstinate'].observations).toBe(3);
    expect((await client.execute('SELECT count(*) AS n FROM last_word_decisions')).rows[0].n).toBe(3);
  });

  it('refuses to replace a saved session with different content', async () => {
    const store = new DatabaseLastWordPersistence(db, userId, sets);
    const tampered = session('a', 1_000_000);
    tampered.decisions[0].reactionTimeMs = 1;
    await expect(store.saveSession(tampered)).rejects.toThrow(/cannot be replaced/);
  });

  it('rejects content the player could not have seen', async () => {
    const store = new DatabaseLastWordPersistence(db, userId, sets.filter(s => s.set_id !== 'persistent-obstinate'));
    await expect(store.saveSession(session('b', 2_000_000))).rejects.toThrow(/Unknown scenario/);
  });

  it('loads exactly what was saved, and keeps users apart', async () => {
    const store = new DatabaseLastWordPersistence(db, userId, sets);
    await store.saveSession(session('c', 5 * 86_400_000, 'po_hold'));
    const loaded = await store.load();
    expect(loaded.sessions.map(s => s.id)).toEqual(['a', 'c']);
    expect(Object.keys(loaded.reviews)).toEqual(['persistent__obstinate']);
    const other = await client.execute("INSERT INTO users (email, name, role, status) VALUES ('t@example.com', 'T', 'student', 'active') RETURNING id");
    expect((await new DatabaseLastWordPersistence(db, Number(other.rows[0].id), sets).load()).sessions).toEqual([]);
  });

  it('awards Lexicore points once per session, and a repeat of the same scenario pays a quarter', async () => {
    const learner = await client.execute("INSERT INTO users (email, name, role, status) VALUES ('u@example.com', 'U', 'student', 'active') RETURNING id");
    const learnerId = Number(learner.rows[0].id);
    await client.execute({ sql: 'INSERT INTO vocab_user_progress (user_id) VALUES (?)', args: [learnerId] });
    const total = async () => Number((await client.execute({ sql: 'SELECT total_points AS t, weekly_points AS w FROM vocab_user_progress WHERE user_id = ?', args: [learnerId] })).rows[0].t);
    const store = new DatabaseLastWordPersistence(db, learnerId, sets);

    const first = await store.saveSession(session('p1', 10 * 86_400_000));
    const earned = first.sessions.at(-1)!.score;
    expect(earned).toBeGreaterThan(0);
    // Every choice is best-fit: 15 each, +5 at each beat where the best word changes and the player switched.
    const beats = po.chains.find(c => c.id === 'po_flip')!.beats;
    expect(earned).toBe(beats.length * 15 + 5 * beats.filter((b, i) => i > 0 && b.best_word !== beats[i - 1].best_word).length);
    expect(await total()).toBe(earned);

    await store.saveSession(session('p1', 10 * 86_400_000)); // replayed save: no double award
    expect(await total()).toBe(earned);

    const second = await store.saveSession(session('p2', 20 * 86_400_000)); // same scenario, later session
    const repeat = second.sessions.at(-1)!.score;
    expect(repeat).toBeLessThan(earned / 2);
    expect(await total()).toBe(earned + repeat);
  });
});

describe('content QA flags (§45)', () => {
  const beat = po.chains[0].beats[0];
  const row = (selectedWord: string, learnerStrong = false) => {
    const d = evaluateDecision({ id: Math.random().toString(), sessionId: 's', setId: po.set_id, scenarioId: po.chains[0].id, beatId: beat.id, presentedWords: ['persistent', 'obstinate'], selectedWord, previousSelection: null, reactionTimeMs: 3000, hintLevel: 0, confidence: null, reviewIntervalDays: 0, occurredAt: 0 }, po);
    return { ...d, learnerStrong };
  };
  const other = Object.keys(beat.fit).find(w => w !== beat.best_word)!;

  it('flags an item strong learners miss and where answers split', () => {
    const rows = [...Array(8)].map(() => row(other, true)).concat([...Array(8)].map(() => row(beat.best_word)));
    const [flag] = flagItems(rows);
    expect(flag.reasons.join()).toMatch(/strong learners/);
    expect(flag.reasons.join()).toMatch(/split/);
  });

  it('stays quiet on a healthy item or too little data', () => {
    expect(flagItems([...Array(20)].map(() => row(beat.best_word)))).toEqual([]);
    expect(flagItems([...Array(5)].map(() => row(other, true)))).toEqual([]);
  });

  it('reports accuracy by the slot the best word appeared in', () => {
    expect(positionBias([{ presentedWords: ['a', 'b'], bestWord: 'a', correctness: 'best' }, { presentedWords: ['a', 'b'], bestWord: 'b', correctness: 'incorrect' }]))
      .toEqual([{ slot: 1, shown: 1, accuracy: 1 }, { slot: 2, shown: 1, accuracy: 0 }]);
  });
});
