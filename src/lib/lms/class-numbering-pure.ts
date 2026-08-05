// ─── Class Numbering — Pure Computation ────────────────────────────────────────
// No DB imports — unit-testable without a live DB connection.
// The DB fetch layer is in class-numbering.ts.
//
// Computed-on-read class numbering. Series identity = subject × batch ×
// product; each series numbers 1, 2, 3… by scheduledAt ascending (ties
// broken by start time — scheduledAt already carries both, so a plain
// ascending sort handles both at once).
//
// Rules:
//  - subject='tbd' and status='cancelled' sessions get no number and don't
//    consume a slot in the sequence (the next real class takes the next
//    number — no gaps).
//  - The stored `class_number` column is a manual override: non-null always
//    wins for that row's own displayed number, but every qualifying session
//    still keeps its natural chronological rank for the purpose of
//    numbering its siblings — an override on one row never shifts any other
//    row's number.

export interface NumberableSession {
  id: number;
  subject: string;
  product: string;
  batch: string | null;
  scheduledAt: Date;
  status: string;
  classNumber: number | null; // manual override, stored column
}

export function computeClassNumbers(sessions: NumberableSession[]): Map<number, number | null> {
  const result = new Map<number, number | null>();

  const bySeries = new Map<string, NumberableSession[]>();
  for (const s of sessions) {
    const key = `${s.product}|${s.batch ?? ''}|${s.subject}`;
    if (!bySeries.has(key)) bySeries.set(key, []);
    bySeries.get(key)!.push(s);
  }

  for (const group of bySeries.values()) {
    const sorted = [...group].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    let rank = 0;
    for (const s of sorted) {
      const qualifies = s.subject !== 'tbd' && s.status !== 'cancelled';
      const computed = qualifies ? ++rank : null;
      result.set(s.id, s.classNumber ?? computed);
    }
  }

  return result;
}
