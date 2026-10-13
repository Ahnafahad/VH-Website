'use client';

import { useState } from 'react';
import { SPIN_CSS, TabBar, Toast } from '../../lms/lms-shared';
import { SuperHeader } from '../super-ui';
import OverridesTab from './OverridesTab';
import AccountTab from './AccountTab';
import PointsTab from './PointsTab';
import RolloverTab from './RolloverTab';

const TABS = [
  { id: 'overrides', label: 'Overrides' },
  { id: 'account', label: 'Account tools' },
  { id: 'points', label: 'Points & leaderboard' },
  { id: 'rollover', label: 'Batch rollover' },
];

export default function StudentsClient() {
  const [tab, setTab] = useState('overrides');
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Student control" subtitle="Per-student overrides, account repair, points and batch rollover. Every action is audited." />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'overrides' && <OverridesTab notify={setToast} />}
      {tab === 'account' && <AccountTab notify={setToast} />}
      {tab === 'points' && <PointsTab notify={setToast} />}
      {tab === 'rollover' && <RolloverTab notify={setToast} />}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
