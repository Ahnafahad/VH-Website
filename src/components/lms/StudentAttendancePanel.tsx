import type { StudentAttendanceProductSummary } from '@/lib/lms/attendance-summary';

const PRODUCT_LABELS: Record<string, string> = {
  iba: 'IBA',
  fbs: 'FBS',
  fbs_detailed: 'FBS Detailed',
};

interface Props {
  products: StudentAttendanceProductSummary[];
  cap: number;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, color: '#6B7280' }}>{label}</p>
    </div>
  );
}

export default function StudentAttendancePanel({ products, cap }: Props) {
  if (products.length === 0) {
    return <p style={{ fontSize: 13, color: '#9CA3AF' }}>No course access yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {products.map((p) => (
        <div
          key={p.product}
          style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 16 }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
            {PRODUCT_LABELS[p.product] ?? p.product}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Stat value={`${p.onlineUsed} / ${cap}`} label="online attendances used" />
            <Stat value={String(p.onlineRemaining)} label="online remaining" />
            <Stat value={String(p.absences)} label={`absent (of ${p.totalExpected})`} />
          </div>
        </div>
      ))}
    </div>
  );
}
