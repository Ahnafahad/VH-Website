'use client';

/**
 * ClassCloseoutPrompt — pinned "Needs attention" panel on /admin.
 * Lists PAST class sessions still missing an instructor and/or a real subject,
 * with an inline form per row that PATCHes /api/lms/admin/classes/{id}.
 */

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { formatInstructorNames } from '@/lib/lms/instructor-name';
import { RED, BORDER, MUTED, SLATE, SURFACE, WARN, WARN_BG, R_MD, R_LG, R_XL } from '@/components/admin/lms/tokens';

const SUBJECTS = ['english', 'math', 'analytical', 'accounting', 'economics', 'business_studies'] as const;

export interface CloseoutSession {
  id: number;
  title: string;
  subject: string;
  scheduledAt: number; // epoch ms
  instructorId: number | null;
  topic: string | null;
  classNumber: number | null;
}

interface TeachingUser {
  id: number;
  name: string;
}

const fmtDhaka = (ms: number) =>
  new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(ms));

function Row({
  session,
  teachingUsers,
  onSaved,
}: {
  session: CloseoutSession;
  teachingUsers: TeachingUser[];
  onSaved: (id: number) => void;
}) {
  const needsSubject = session.subject === 'tbd';
  const instructorNames = formatInstructorNames(teachingUsers);

  const [instructorId, setInstructorId] = useState(
    session.instructorId != null ? String(session.instructorId) : '',
  );
  const [subject, setSubject] = useState(needsSubject ? '' : session.subject);
  const [topic, setTopic] = useState(session.topic ?? '');
  const [classNumber, setClassNumber] = useState(
    session.classNumber != null ? String(session.classNumber) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const updates: Record<string, unknown> = {};

    const nextInstructor = instructorId ? Number(instructorId) : null;
    if (nextInstructor !== session.instructorId) updates.instructorId = nextInstructor;

    if (needsSubject && subject) updates.subject = subject;

    const nextTopic = topic.trim() || null;
    if (nextTopic !== (session.topic ?? null)) updates.topic = nextTopic;

    const nextClassNumber = classNumber.trim() ? Number(classNumber) : null;
    if (nextClassNumber !== (session.classNumber ?? null)) updates.classNumber = nextClassNumber;

    if (Object.keys(updates).length === 0) {
      setError('Set the instructor or subject first');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/lms/admin/classes/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const e = (await res.json()) as { error?: string };
        throw new Error(e.error ?? 'Failed');
      }
      onSaved(session.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    padding: '7px 9px',
    borderRadius: R_MD,
    border: `1px solid ${BORDER}`,
    background: SURFACE,
    fontSize: 12,
    color: SLATE,
    outline: 'none',
    minWidth: 0,
  };

  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: R_LG,
        padding: '12px 14px',
        background: SURFACE,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>{session.title}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>{fmtDhaka(session.scheduledAt)}</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={instructorId}
          onChange={(e) => setInstructorId(e.target.value)}
          style={{ ...fieldStyle, flex: '1 1 150px' }}
          aria-label="Instructor"
        >
          <option value="">Instructor…</option>
          {teachingUsers.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {instructorNames.get(u.id) ?? u.name}
            </option>
          ))}
        </select>

        {needsSubject && (
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ ...fieldStyle, flex: '1 1 120px' }}
            aria-label="Subject"
          >
            <option value="">Subject…</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        )}

        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic (optional)"
          style={{ ...fieldStyle, flex: '1 1 150px' }}
          aria-label="Topic"
        />

        <input
          type="number"
          min="0"
          step="1"
          value={classNumber}
          onChange={(e) => setClassNumber(e.target.value)}
          placeholder="Class #"
          style={{ ...fieldStyle, flex: '0 1 90px' }}
          aria-label="Class number"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 16px',
            borderRadius: R_MD,
            border: `1px solid ${RED}`,
            background: RED,
            color: SURFACE,
            fontSize: 12,
            fontWeight: 650,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && <p style={{ margin: 0, fontSize: 11, color: RED }}>{error}</p>}
    </div>
  );
}

export default function ClassCloseoutPrompt({
  sessions,
  teachingUsers,
}: {
  sessions: CloseoutSession[];
  teachingUsers: TeachingUser[];
}) {
  const [rows, setRows] = useState(sessions);

  if (rows.length === 0) return null;

  const handleSaved = (id: number) => setRows((prev) => prev.filter((s) => s.id !== id));

  return (
    <section
      aria-labelledby="admin-closeout-heading"
      style={{
        marginBottom: 28,
        border: `1px solid ${WARN}55`,
        borderRadius: R_XL,
        background: WARN_BG,
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <AlertCircle size={16} style={{ color: WARN, flexShrink: 0 }} aria-hidden />
        <h2 id="admin-closeout-heading" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: WARN }}>
          Needs attention · {rows.length} past class{rows.length !== 1 ? 'es' : ''} missing info
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((s) => (
          <Row key={s.id} session={s} teachingUsers={teachingUsers} onSaved={handleSaved} />
        ))}
      </div>
    </section>
  );
}
