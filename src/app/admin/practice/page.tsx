import Link from 'next/link';
import { Route, PenLine, Stethoscope, Timer, ChevronRight } from 'lucide-react';
import { BORDER, FONT_HEADING, MUTED, R_LG, SLATE, SURFACE, T_BASE, T_SM } from '@/components/admin/lms/tokens';

export const metadata = { title: 'Practice & Diagnosis — VH Admin' };

const TOOLS = [
  { href: '/admin/marathon',      label: 'Marathon',      icon: Route,       blurb: 'Multi-day chapter drills assigned to a batch.' },
  { href: '/admin/sprint',        label: 'Sprint',        icon: Timer,       blurb: 'In-class FBS MCQ rounds with a per-set leaderboard.' },
  { href: '/admin/redline',       label: 'Redline',       icon: PenLine,     blurb: 'Levelled sentence-correction practice and weakness analytics.' },
  { href: '/admin/diagnosis-fbs', label: 'Diagnosis FBS', icon: Stethoscope, blurb: 'Free FBS diagnostic: stats, attempts and leads.' },
];

export default function PracticeHubPage() {
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: 24, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em' }}>
        Practice &amp; Diagnosis
      </h1>
      <p style={{ margin: '4px 0 24px', fontSize: 13, color: MUTED }}>Student practice tools and diagnostics in one place.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {TOOLS.map(({ href, label, icon: Icon, blurb }) => (
          <Link key={href} href={href} style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: 20, textDecoration: 'none',
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, color: SLATE,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: T_BASE, fontWeight: 700 }}>
              <Icon size={18} aria-hidden /> {label} <ChevronRight size={14} aria-hidden style={{ marginLeft: 'auto', color: MUTED }} />
            </span>
            <span style={{ fontSize: T_SM, color: MUTED }}>{blurb}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
