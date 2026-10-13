import Link from 'next/link';
import { and, desc, eq, gte, sql, count } from 'drizzle-orm';
import {
  db, users, registrations, auditLog, superPendingActions, vocabErrorLogs, userAccess,
} from '@/lib/db';
import { requireSuperAdminPage } from '@/lib/super/guard';
import { SuperHeader, SuperCard, StatGrid, StatTile, SuperTable, SuperBadge } from '@/components/admin/super/super-ui';
import { MUTED, SLATE, RED, BORDER } from '@/components/admin/lms/tokens';
import { NAV_LINKS } from './nav-links';

export const dynamic = 'force-dynamic';

// Local copy: super-ui.tsx is a 'use client' module, so its plain values can't be imported into a Server Component.
const tdStyle = { padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top' } as const;

// Each tile degrades to "—" if its query fails, so one broken table never blanks the home page.
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

export default async function CommandCenterPage() {
  const actor = await requireSuperAdminPage();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const weekAgoIso = weekAgo.toISOString();

  const [roles, studentsActive, regs, pending, errors7d, noAccess, recent] = await Promise.all([
    safe(db.select({ role: users.role, n: count() }).from(users).where(eq(users.status, 'active')).groupBy(users.role), []),
    safe(db.select({ n: count() }).from(users).where(and(eq(users.role, 'student'), eq(users.status, 'active'))), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(registrations).where(gte(registrations.createdAt, weekAgo)), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(superPendingActions).where(eq(superPendingActions.status, 'pending')), [{ n: 0 }]),
    safe(db.select({ n: count() }).from(vocabErrorLogs).where(and(eq(vocabErrorLogs.severity, 'error'), gte(vocabErrorLogs.createdAt, weekAgoIso))), [{ n: 0 }]),
    safe(db.select({ n: sql<number>`count(*)` }).from(users).where(and(
      eq(users.role, 'student'), eq(users.status, 'active'),
      sql`not exists (select 1 from ${userAccess} ua where ua.user_id = ${users.id} and ua.active = 1)`,
    )), [{ n: 0 }]),
    safe(db.select({
      id: auditLog.id, action: auditLog.action, entityType: auditLog.entityType, entityId: auditLog.entityId,
      createdAt: auditLog.createdAt, actor: users.name,
    }).from(auditLog).leftJoin(users, eq(auditLog.actorUserId, users.id)).orderBy(desc(auditLog.id)).limit(15), []),
  ]);

  const roleCount = (r: string) => roles.find(x => x.role === r)?.n ?? 0;
  const supers = roleCount('super_admin');

  return (
    <div style={{ maxWidth: 1100 }}>
      <SuperHeader title="Command Center" subtitle={`Signed in as ${actor.name}. Everything in the regular admin is still here — these are the extra controls.`} />

      <StatGrid>
        <StatTile label="Active students" value={studentsActive[0]?.n ?? '—'} />
        <StatTile label="Staff" value={roleCount('admin') + roleCount('instructor') + supers} hint={`${supers} super · ${roleCount('admin')} admin · ${roleCount('instructor')} instructor`} />
        <StatTile label="Registrations (7d)" value={regs[0]?.n ?? '—'} />
        <StatTile label="Pending approvals" value={pending[0]?.n ?? '—'} tone={(pending[0]?.n ?? 0) > 0 ? 'warn' : 'ok'} />
        <StatTile label="Errors (7d)" value={errors7d[0]?.n ?? '—'} tone={(errors7d[0]?.n ?? 0) > 0 ? 'warn' : 'ok'} />
        <StatTile label="Students w/o access" value={noAccess[0]?.n ?? '—'} tone={(noAccess[0]?.n ?? 0) > 0 ? 'warn' : 'ok'} />
      </StatGrid>

      {supers < 2 && (
        <p role="status" style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: 8, border: `1px solid ${RED}55`, color: RED, fontSize: 13 }}>
          Only one super admin exists. Add a trusted backup in <Link href="/admin/super/staff" style={{ color: RED, fontWeight: 600 }}>Staff manager</Link> so a lost login can&apos;t lock you out.
        </p>
      )}

      <SuperCard title="Jump to">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ textDecoration: 'none', padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, color: SLATE }}>
              <strong style={{ fontSize: 13 }}>{l.label}</strong>
              <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{l.blurb}</span>
            </Link>
          ))}
        </div>
      </SuperCard>

      <SuperCard title="Latest activity" action={<Link href="/admin/super/audit" style={{ fontSize: 12, color: RED }}>Full audit log →</Link>}>
        {recent.length === 0 ? <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No audit events yet.</p> : (
          <SuperTable head={['When', 'Who', 'Action', 'Target']}>
            {recent.map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td style={tdStyle}>{r.actor ?? 'system'}</td>
                <td style={tdStyle}><SuperBadge tone="gold">{r.action}</SuperBadge></td>
                <td style={tdStyle}>{r.entityType}{r.entityId != null ? ` #${r.entityId}` : ''}</td>
              </tr>
            ))}
          </SuperTable>
        )}
      </SuperCard>
    </div>
  );
}
