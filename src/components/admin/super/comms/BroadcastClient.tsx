'use client';

import React from 'react';
import {
  SLATE, MUTED, BORDER, SURFACE_ALT, RED, T_SM, T_BASE, SPIN_CSS,
  TabBar, Toast, PrimaryBtn, GhostBtn, FieldInput, FieldTextarea, FieldSelect, FieldLabel, useConfirm,
  fmtDhaka, dhakaLocalToISO,
} from '../../lms/lms-shared';
import { SuperHeader, SuperCard, SuperBadge, SuperTable, StatGrid, StatTile, tdStyle, superApi } from '../super-ui';

type Channel = 'push' | 'email' | 'banner';
type Mode = 'everyone' | 'batchProduct' | 'individuals';
type Role = 'student' | 'instructor' | 'admin' | 'super_admin';
interface Segment { audience: { mode: 'everyone' } | { mode: 'batchProduct'; product: string; batch: string | null } | { mode: 'individuals'; userIds: number[] }; roles?: Role[] }
interface Preview { count: number; pushable: number; sample: { id: number; name: string; email: string; role: string; batch: string | null }[] }
interface Delivery { recipients: number; push?: { sent: number; failed: number; skippedNoPref: number }; email?: { sent: number; failed: number }; banner?: boolean; error?: string }
interface Row { id: number; title: string; body: string; channels: string; segment: string; status: string; scheduledAt: number | null; sentAt: number | null; createdAt: number; sentCount: number; result: Delivery | null }
interface Banner { text: string; level: string; expiresAt: number }
interface Deliverability {
  warmup: { startDate: string; totalDays: number; day: number; complete: boolean; endsOn: string };
  resend: { available: false; reason: string } | { available: true; total: number; counts: Record<string, number>; problems: { id: string; to: string; subject: string; event: string; at: string }[] };
  recentBlasts: { id: number; title: string; status: string; sentAt: number | null; email: { sent: number; failed: number } | null }[];
}

const TABS = [{ id: 'compose', label: 'Compose' }, { id: 'history', label: 'History' }, { id: 'deliverability', label: 'Deliverability' }, { id: 'reports', label: 'Reports' }];
const ROLE_OPTIONS: Role[] = ['student', 'instructor', 'admin', 'super_admin'];
const statusTone = (s: string) => s === 'sent' ? 'ok' : s === 'failed' ? 'bad' : s === 'scheduled' || s === 'sending' ? 'warn' : 'neutral';
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 };

export default function BroadcastClient() {
  const [tab, setTab] = React.useState('compose');
  const [toast, setToast] = React.useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  // Compose state
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [channels, setChannels] = React.useState<Channel[]>(['push']);
  const [mode, setMode] = React.useState<Mode>('everyone');
  const [product, setProduct] = React.useState('iba');
  const [batch, setBatch] = React.useState('');
  const [ids, setIds] = React.useState('');
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [when, setWhen] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [previewErr, setPreviewErr] = React.useState<string | null>(null);

  // Banner state
  const [banner, setBanner] = React.useState<Banner | null>(null);
  const [bText, setBText] = React.useState('');
  const [bLevel, setBLevel] = React.useState('info');
  const [bHours, setBHours] = React.useState('72');

  const [history, setHistory] = React.useState<Row[] | null>(null);
  const [deliv, setDeliv] = React.useState<Deliverability | null>(null);
  const [report, setReport] = React.useState<string | null>(null);

  const note = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };
  const fail = (e: unknown) => note(e instanceof Error ? e.message : 'Something went wrong');

  const segment: Segment = React.useMemo(() => {
    const userIds = ids.split(/[\s,]+/).map(Number).filter(n => Number.isInteger(n) && n > 0);
    const audience = mode === 'everyone' ? { mode: 'everyone' as const }
      : mode === 'batchProduct' ? { mode: 'batchProduct' as const, product, batch: batch.trim() || null }
      : { mode: 'individuals' as const, userIds };
    return { audience, ...(roles.length ? { roles } : {}) };
  }, [mode, product, batch, ids, roles]);

  const needsPeople = channels.some(c => c !== 'banner');
  const segmentReady = mode !== 'individuals' || (segment.audience.mode === 'individuals' && segment.audience.userIds.length > 0);

  // Live recipient preview (debounced)
  React.useEffect(() => {
    if (!segmentReady) { setPreview(null); setPreviewErr(null); return; }
    const t = setTimeout(() => {
      superApi<Preview>('/api/admin/super/comms/preview', { method: 'POST', body: { segment } })
        .then(p => { setPreview(p); setPreviewErr(null); })
        .catch(e => { setPreview(null); setPreviewErr(e.message); });
    }, 400);
    return () => clearTimeout(t);
  }, [segment, segmentReady]);

  const loadBanner = React.useCallback(() => {
    superApi<{ banner: Banner | null }>('/api/admin/super/comms/banner').then(d => setBanner(d.banner)).catch(fail);
  }, []);
  const loadHistory = React.useCallback(() => {
    superApi<{ broadcasts: Row[] }>('/api/admin/super/comms/broadcasts').then(d => setHistory(d.broadcasts)).catch(fail);
  }, []);

  React.useEffect(() => { loadBanner(); }, [loadBanner]);
  React.useEffect(() => {
    if (tab === 'history') loadHistory();
    if (tab === 'deliverability' && !deliv) superApi<Deliverability>('/api/admin/super/comms/deliverability').then(setDeliv).catch(fail);
    if (tab === 'reports' && report === null) superApi<{ text: string }>('/api/admin/super/comms/report').then(d => setReport(d.text)).catch(fail);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = <T,>(list: T[], v: T) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];
  const canSend = title.trim() && body.trim() && channels.length > 0 && segmentReady && (!needsPeople || (preview && preview.count > 0));

  async function send() {
    const scheduledAt = when ? dhakaLocalToISO(when) : null;
    const who = needsPeople ? `${preview?.count ?? 0} recipients` : 'the banner only';
    const ok = await confirm({
      title: scheduledAt ? 'Schedule broadcast?' : 'Send broadcast now?',
      message: `"${title.trim()}" via ${channels.join(' + ')} to ${who}${scheduledAt ? `, at ${fmtDhaka(new Date(scheduledAt).getTime())} (Dhaka)` : ''}. This cannot be recalled once sent.`,
      confirmLabel: scheduledAt ? 'Schedule' : 'Send now',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await superApi<{ status: string; result?: Delivery }>('/api/admin/super/comms/broadcasts', {
        method: 'POST', body: { title: title.trim(), body: body.trim(), channels, segment, scheduledAt },
      });
      note(r.status === 'scheduled' ? 'Broadcast scheduled' : r.status === 'sent' ? 'Broadcast sent' : `Broadcast failed${r.result?.error ? `: ${r.result.error}` : ''}`);
      if (r.status !== 'failed') { setTitle(''); setBody(''); setWhen(''); }
      loadBanner();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  function resendAsNew(row: Row) {
    try {
      const seg = JSON.parse(row.segment) as Segment;
      setTitle(row.title); setBody(row.body); setChannels(JSON.parse(row.channels) as Channel[]);
      setMode(seg.audience.mode); setRoles(seg.roles ?? []);
      if (seg.audience.mode === 'batchProduct') { setProduct(seg.audience.product); setBatch(seg.audience.batch ?? ''); }
      if (seg.audience.mode === 'individuals') setIds(seg.audience.userIds.join(', '));
      setWhen(''); setTab('compose'); note('Loaded into Compose as a new broadcast');
    } catch { note('Could not read that broadcast'); }
  }

  async function cancel(id: number) {
    if (!(await confirm({ title: 'Cancel scheduled broadcast?', message: 'It will not be sent.', confirmLabel: 'Cancel broadcast', cancelLabel: 'Keep', destructive: true }))) return;
    try { await superApi(`/api/admin/super/comms/broadcasts/${id}`, { method: 'PATCH', body: { action: 'cancel' } }); loadHistory(); } catch (e) { fail(e); }
  }

  async function saveBanner() {
    try {
      await superApi('/api/admin/super/comms/banner', { method: 'PUT', body: { text: bText, level: bLevel, hours: Number(bHours) } });
      setBText(''); loadBanner(); note('Banner is live');
    } catch (e) { fail(e); }
  }
  async function clearBanner() {
    if (!(await confirm({ title: 'Clear the banner?', message: 'Students will stop seeing it (cached copies may take up to two minutes).', confirmLabel: 'Clear', destructive: true }))) return;
    try { await superApi('/api/admin/super/comms/banner', { method: 'DELETE' }); loadBanner(); note('Banner cleared'); } catch (e) { fail(e); }
  }

  async function sendTestReport() {
    setBusy(true);
    try { await superApi('/api/admin/super/comms/report', { method: 'POST' }); note('Test report sent to the root email'); } catch (e) { fail(e); } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 64px' }}>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Broadcast" subtitle="Push, email and in-app announcements to a segment of users" />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'compose' && (
        <>
          <SuperCard title="Message">
            <div style={{ display: 'grid', gap: 12 }}>
              <div><FieldLabel htmlFor="bc-title">Title</FieldLabel><FieldInput id="bc-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} /></div>
              <div><FieldLabel htmlFor="bc-body">Body</FieldLabel><FieldTextarea id="bc-body" value={body} maxLength={2000} onChange={e => setBody(e.target.value)} /></div>
              <div>
                <FieldLabel>Channels</FieldLabel>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: T_BASE, color: SLATE }}>
                  {(['push', 'email', 'banner'] as Channel[]).map(c => (
                    <label key={c} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={channels.includes(c)} onChange={() => setChannels(toggle(channels, c))} />
                      {c === 'banner' ? 'In-app banner (all students, 72h)' : c === 'push' ? 'Push' : 'Email'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </SuperCard>

          <SuperCard title="Segment">
            <div style={grid}>
              <div><FieldLabel htmlFor="bc-mode">Audience</FieldLabel>
                <FieldSelect id="bc-mode" value={mode} onChange={e => setMode(e.target.value as Mode)}>
                  <option value="everyone">Everyone (active users)</option>
                  <option value="batchProduct">Product / batch students</option>
                  <option value="individuals">Individual users</option>
                </FieldSelect></div>
              {mode === 'batchProduct' && (<>
                <div><FieldLabel htmlFor="bc-product">Product</FieldLabel>
                  <FieldSelect id="bc-product" value={product} onChange={e => setProduct(e.target.value)}>
                    <option value="iba">IBA</option><option value="fbs">FBS</option><option value="fbs_detailed">FBS detailed</option>
                  </FieldSelect></div>
                <div><FieldLabel htmlFor="bc-batch">Batch (blank = all)</FieldLabel><FieldInput id="bc-batch" value={batch} onChange={e => setBatch(e.target.value)} /></div>
              </>)}
              {mode === 'individuals' && (
                <div style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="bc-ids">User IDs (comma separated)</FieldLabel><FieldInput id="bc-ids" value={ids} onChange={e => setIds(e.target.value)} placeholder="12, 40, 77" /></div>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <FieldLabel>Only these roles (none ticked = no role filter)</FieldLabel>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: T_BASE, color: SLATE }}>
                {ROLE_OPTIONS.map(r => (
                  <label key={r} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(toggle(roles, r))} />{r.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
          </SuperCard>

          <SuperCard title="Recipient preview">
            {previewErr ? <p style={{ margin: 0, color: RED, fontSize: T_BASE }}>{previewErr}</p>
              : !preview ? <p style={{ margin: 0, color: MUTED, fontSize: T_BASE }}>{segmentReady ? 'Loading…' : 'Add at least one user ID.'}</p>
              : (<>
                <StatGrid>
                  <StatTile label="Recipients" value={preview.count} />
                  <StatTile label="Reachable by push" value={preview.pushable} hint="subscribed + announcements on" />
                </StatGrid>
                {preview.count > 0 && <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>
                  {preview.sample.map(s => s.name).join(', ')}{preview.count > preview.sample.length ? `, and ${preview.count - preview.sample.length} more` : ''}
                </p>}
              </>)}
          </SuperCard>

          <SuperCard title="Send">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 220 }}><FieldLabel htmlFor="bc-when">Schedule (Dhaka time, blank = send now)</FieldLabel><FieldInput id="bc-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></div>
              <PrimaryBtn onClick={send} disabled={!canSend} loading={busy}>{when ? 'Schedule' : 'Send now'}</PrimaryBtn>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: T_SM, color: MUTED }}>Push respects each user&apos;s announcements setting. Email goes to every recipient, a few at a time. Large sends can take a few minutes.</p>
          </SuperCard>

          <SuperCard title="In-app banner">
            {banner ? (
              <p style={{ margin: '0 0 12px', fontSize: T_BASE, color: SLATE }}>
                <SuperBadge tone="gold">{banner.level}</SuperBadge>{' '}{banner.text}
                <span style={{ color: MUTED }}> (until {fmtDhaka(banner.expiresAt)})</span>{' '}
                <GhostBtn small onClick={clearBanner}>Clear</GhostBtn>
              </p>
            ) : <p style={{ margin: '0 0 12px', fontSize: T_BASE, color: MUTED }}>No banner is live.</p>}
            <div style={grid}>
              <div style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="bn-text">Banner text</FieldLabel><FieldInput id="bn-text" value={bText} maxLength={280} onChange={e => setBText(e.target.value)} /></div>
              <div><FieldLabel htmlFor="bn-level">Level</FieldLabel><FieldSelect id="bn-level" value={bLevel} onChange={e => setBLevel(e.target.value)}><option value="info">Info</option><option value="warn">Warning</option><option value="urgent">Urgent</option></FieldSelect></div>
              <div><FieldLabel htmlFor="bn-hours">Show for (hours)</FieldLabel><FieldInput id="bn-hours" type="number" min={1} max={720} value={bHours} onChange={e => setBHours(e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 12 }}><PrimaryBtn small onClick={saveBanner} disabled={!bText.trim()}>Publish banner</PrimaryBtn></div>
          </SuperCard>
        </>
      )}

      {tab === 'history' && (
        <SuperCard title="Broadcasts">
          {!history ? <p style={{ color: MUTED, fontSize: T_BASE }}>Loading…</p> : history.length === 0 ? <p style={{ color: MUTED, fontSize: T_BASE }}>Nothing sent yet.</p> : (
            <SuperTable head={['Title', 'Channels', 'Status', 'When', 'Delivered', '']}>
              {history.map(r => (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.title}</td>
                  <td style={tdStyle}>{(JSON.parse(r.channels) as string[]).join(', ')}</td>
                  <td style={tdStyle}><SuperBadge tone={statusTone(r.status)}>{r.status}</SuperBadge></td>
                  <td style={tdStyle}>{fmtDhaka(r.sentAt ?? r.scheduledAt ?? r.createdAt)}</td>
                  <td style={tdStyle}>{r.sentCount}{r.result && ((r.result.email?.failed ?? 0) + (r.result.push?.failed ?? 0) > 0) ? ` (${(r.result.email?.failed ?? 0) + (r.result.push?.failed ?? 0)} failed)` : ''}{r.result?.error ? ` ${r.result.error}` : ''}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {r.status === 'scheduled' && <GhostBtn small onClick={() => cancel(r.id)}>Cancel</GhostBtn>}{' '}
                    <GhostBtn small onClick={() => resendAsNew(r)}>Resend as new</GhostBtn>
                  </td>
                </tr>
              ))}
            </SuperTable>
          )}
        </SuperCard>
      )}

      {tab === 'deliverability' && (!deliv ? <p style={{ color: MUTED, fontSize: T_BASE }}>Loading…</p> : (<>
        <SuperCard title="Domain warmup">
          <p style={{ margin: 0, fontSize: T_BASE, color: SLATE }}>
            {deliv.warmup.complete ? `Complete. The ${deliv.warmup.totalDays}-day warmup ran ${deliv.warmup.startDate} to ${deliv.warmup.endsOn}.` : `Day ${deliv.warmup.day} of ${deliv.warmup.totalDays}, started ${deliv.warmup.startDate}.`}
          </p>
        </SuperCard>
        <SuperCard title="Recent email blasts">
          {deliv.recentBlasts.length === 0 ? <p style={{ margin: 0, color: MUTED, fontSize: T_BASE }}>No email broadcasts yet.</p> : (
            <SuperTable head={['Title', 'Status', 'Sent', 'Failed']}>
              {deliv.recentBlasts.map(b => (
                <tr key={b.id}><td style={tdStyle}>{b.title}</td><td style={tdStyle}><SuperBadge tone={statusTone(b.status)}>{b.status}</SuperBadge></td><td style={tdStyle}>{b.email?.sent ?? '-'}</td><td style={tdStyle}>{b.email?.failed ?? '-'}</td></tr>
              ))}
            </SuperTable>
          )}
        </SuperCard>
        <SuperCard title="Bounces and complaints (Resend, last 100 emails)">
          {!deliv.resend.available ? <p style={{ margin: 0, color: MUTED, fontSize: T_BASE }}>Not available: {deliv.resend.reason}.</p> : (<>
            <StatGrid>{Object.entries(deliv.resend.counts).map(([k, v]) => <StatTile key={k} label={k} value={v} tone={['bounced', 'complained', 'failed'].includes(k) ? 'bad' : undefined} />)}</StatGrid>
            {deliv.resend.problems.length === 0 ? <p style={{ margin: 0, color: MUTED, fontSize: T_BASE }}>No bounces or complaints in the sample.</p> : (
              <SuperTable head={['To', 'Subject', 'Event', 'When']}>
                {deliv.resend.problems.map(p => <tr key={p.id}><td style={tdStyle}>{p.to}</td><td style={tdStyle}>{p.subject}</td><td style={tdStyle}><SuperBadge tone="bad">{p.event}</SuperBadge></td><td style={tdStyle}>{p.at}</td></tr>)}
              </SuperTable>
            )}
          </>)}
        </SuperCard>
      </>))}

      {tab === 'reports' && (
        <SuperCard title="Weekly report" action={<PrimaryBtn small onClick={sendTestReport} loading={busy}>Send test report now</PrimaryBtn>}>
          <p style={{ margin: '0 0 12px', fontSize: T_SM, color: MUTED }}>Emailed to the root account every Sunday. This is the current content.</p>
          <pre style={{ margin: 0, padding: 12, background: SURFACE_ALT, border: `1px solid ${BORDER}`, borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: T_BASE, color: SLATE }}>{report ?? 'Loading…'}</pre>
        </SuperCard>
      )}

      {confirmDialog}
      <Toast message={toast} />
    </div>
  );
}
