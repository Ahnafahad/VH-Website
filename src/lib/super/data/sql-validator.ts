/**
 * Read-only SQL validator for the super-admin console. This is the security boundary: the
 * query is tokenized (strings, quoted identifiers and comments are understood, not regex-guessed),
 * must be exactly ONE statement, start with SELECT/WITH/EXPLAIN/PRAGMA(read-only list), and may not
 * contain any write/DDL/transaction keyword outside a string or quoted identifier. The returned
 * `sql` is rebuilt from tokens with comments removed, so what runs is what was validated.
 */

type Tok = { t: 'ws' | 'comment' | 'string' | 'ident' | 'word' | 'punct'; s: string };

export type SqlCheck = { ok: true; sql: string; kind: 'select' | 'pragma' | 'explain' } | { ok: false; reason: string };

const FORBIDDEN = new Set([
  'insert', 'update', 'delete', 'drop', 'alter', 'create', 'attach', 'detach', 'vacuum', 'reindex', 'analyze',
  'begin', 'commit', 'rollback', 'savepoint', 'release', 'truncate', 'upsert', 'pragma',
  'load_extension', 'fts3_tokenizer', 'readfile', 'writefile', 'edit', 'zeroblob',
  // Unbounded recursion can't be interrupted server-side (the client timeout only abandons the wait).
  'recursive',
]);

/** Secret-bearing column names. Redacted by result-column name AND refused outright if named in the query,
 *  so an alias (`push_subscription AS x`) cannot dodge the redaction. */
export const PROTECTED_COLUMN = /push_subscription|token|secret|password|credential|api_?key|auth_key|private_key/i;
const SAFE_PRAGMAS = new Set(['table_info', 'table_xinfo', 'table_list', 'index_list', 'index_info', 'index_xinfo', 'foreign_key_list', 'database_list']);

const isWordChar = (ch: string) => /[A-Za-z0-9_$]/.test(ch) || ch.charCodeAt(0) > 127;

export function tokenize(src: string): Tok[] | string {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\0') return 'NUL byte in query';
    if (' \t\n\r\f'.includes(c)) {
      let j = i + 1;
      while (j < src.length && ' \t\n\r\f'.includes(src[j])) j++;
      out.push({ t: 'ws', s: src.slice(i, j) }); i = j; continue;
    }
    if (c === '-' && src[i + 1] === '-') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = src.length;
      out.push({ t: 'comment', s: src.slice(i, j) }); i = j; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      if (j < 0) return 'unterminated comment';
      out.push({ t: 'comment', s: src.slice(i, j + 2) }); i = j + 2; continue;
    }
    if (c === "'" || c === '"' || c === '`' || c === '[') {
      const close = c === '[' ? ']' : c;
      let j = i + 1;
      for (;;) {
        if (j >= src.length) return 'unterminated string or quoted identifier';
        if (src[j] === close) {
          if (c !== '[' && src[j + 1] === close) { j += 2; continue; }
          break;
        }
        j++;
      }
      out.push({ t: c === "'" ? 'string' : 'ident', s: src.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (isWordChar(c)) {
      let j = i + 1;
      while (j < src.length && isWordChar(src[j])) j++;
      out.push({ t: 'word', s: src.slice(i, j) }); i = j; continue;
    }
    out.push({ t: 'punct', s: c }); i++;
  }
  return out;
}

export function validateReadOnlySql(input: string): SqlCheck {
  if (typeof input !== 'string' || !input.trim()) return { ok: false, reason: 'Empty query' };
  if (input.length > 20_000) return { ok: false, reason: 'Query too long (max 20,000 characters)' };
  const toks = tokenize(input);
  if (typeof toks === 'string') return { ok: false, reason: toks };

  const sig = toks.filter(x => x.t !== 'ws' && x.t !== 'comment');
  // Exactly one statement: a ';' may only be the very last significant token.
  const semi = sig.findIndex(x => x.t === 'punct' && x.s === ';');
  if (semi >= 0 && semi !== sig.length - 1) return { ok: false, reason: 'Only one statement is allowed' };
  const body = semi >= 0 ? sig.slice(0, semi) : sig;
  if (!body.length) return { ok: false, reason: 'Empty query' };

  const first = body[0].t === 'word' ? body[0].s.toLowerCase() : '';
  let kind: 'select' | 'pragma' | 'explain';
  if (first === 'select' || first === 'with') kind = 'select';
  else if (first === 'explain') {
    kind = 'explain';
    let k = 1;
    if (body[1]?.s.toLowerCase() === 'query' && body[2]?.s.toLowerCase() === 'plan') k = 3;
    const next = body[k]?.s.toLowerCase();
    if (next !== 'select' && next !== 'with') return { ok: false, reason: 'EXPLAIN must be followed by SELECT' };
  } else if (first === 'pragma') {
    const name = body[1]?.s.toLowerCase();
    const rest = body.slice(2);
    const okShape = rest.length === 0 || (rest.length === 3 && rest[0].s === '(' && rest[2].s === ')' && ['word', 'string', 'ident'].includes(rest[1].t));
    if (!name || !SAFE_PRAGMAS.has(name) || !okShape) {
      return { ok: false, reason: `Only read-only PRAGMAs are allowed (${[...SAFE_PRAGMAS].join(', ')})` };
    }
    return { ok: true, sql: body.map(x => x.s).join(' '), kind: 'pragma' };
  } else return { ok: false, reason: 'Query must start with SELECT, WITH, EXPLAIN or PRAGMA table_info' };

  for (const x of body) {
    if ((x.t === 'word' || x.t === 'ident') && PROTECTED_COLUMN.test(x.s)) {
      return { ok: false, reason: `Protected column not allowed in the console: ${x.s}` };
    }
  }

  for (let i = 0; i < body.length; i++) {
    const w = body[i];
    if (w.t !== 'word') continue;
    const lw = w.s.toLowerCase();
    if (FORBIDDEN.has(lw)) return { ok: false, reason: `Keyword not allowed in read-only mode: ${w.s}` };
    if (lw === 'replace' && body[i + 1]?.s !== '(') return { ok: false, reason: 'Keyword not allowed in read-only mode: REPLACE' };
  }

  // Rebuild from tokens: comments become a space, trailing ';' dropped.
  const text = toks.map(x => (x.t === 'comment' ? ' ' : x.s)).join('').trim().replace(/;\s*$/, '');
  return { ok: true, sql: text, kind };
}
