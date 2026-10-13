import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../csv';

describe('csv serializer', () => {
  it('neutralises formula injection in strings only', () => {
    for (const s of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx']) expect(csvCell(s).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell('safe')).toBe('safe');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('handles null, dates and rows', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
    expect(toCsv(['a', 'b'], [[1, '=x'], [null, 'y,z']])).toBe('a,b\r\n1,\'=x\r\n,"y,z"\r\n');
  });
});
