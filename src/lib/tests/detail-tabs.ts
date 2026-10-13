// Pure (no 'use client') so the server page can call parseTab(); a client module's exports can't be called from the server.
export type DetailTab = 'overview' | 'windows' | 'attempts' | 'analytics' | 'settings' | 'answerKey';

export const DETAIL_TABS: { key: DetailTab; label: string; adminOnly?: boolean }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'windows',   label: 'Windows' },
  { key: 'attempts',  label: 'Attempts' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings',  label: 'Settings' },
  { key: 'answerKey', label: 'Answer key', adminOnly: true },
];

export function parseTab(raw: string | undefined | null): DetailTab {
  return DETAIL_TABS.some(t => t.key === raw) ? (raw as DetailTab) : 'overview';
}
