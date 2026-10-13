/** CSV serializer. String cells starting with = + - @ (or tab/CR) get a leading ' so spreadsheets never run them as formulas. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',') + '\r\n';
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return csvRow(header) + rows.map(csvRow).join('');
}
