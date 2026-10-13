import { describe, it, expect } from 'vitest';
import { changedKeys, csvCell, parseJson } from '../diff';
import { findAnomalies } from '../anomalies';

describe('diff', () => {
  it('finds changed, added and removed keys', () => {
    expect(changedKeys({ a: 1, b: 2, c: 3 }, { a: 1, b: 5, d: 4 }).sort()).toEqual(['b', 'c', 'd']);
    expect(changedKeys(null, { x: 1 })).toEqual(['x']);
  });
  it('parses json safely and escapes csv', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('nope')).toBe('nope');
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
  });
});

describe('anomalies', () => {
  it('flags many IPs and many denied attempts', () => {
    const ev = [
      ...['1', '2', '3', '4'].map(i => ({ type: 'signin', email: 'a@x.com', ip: i, createdAt: 0 })),
      ...[1, 2, 3].map(() => ({ type: 'signin_denied', email: 'b@x.com', ip: null, createdAt: 0 })),
    ];
    const kinds = findAnomalies(ev).map(a => `${a.email}:${a.kind}`).sort();
    expect(kinds).toEqual(['a@x.com:many_ips', 'b@x.com:many_denied']);
  });
});
