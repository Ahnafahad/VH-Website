import type { Metadata } from 'next';
import ProgramPageClient from './ProgramPageClient';

export const metadata: Metadata = {
  title: 'IBA DU & DU FBS Admission Coaching Programs',
  description:
    'Two pathways, one standard. In-depth breakdowns of our IBA DU (5-month) and DU FBS (4-month) admission coaching programs for English-medium students — class structure, mocks, test format, and outcomes.',
  keywords: [
    'IBA DU coaching',
    'DU FBS coaching',
    'IBA admission program',
    'English medium IBA preparation',
    'BUP IBA coaching',
  ],
  alternates: { canonical: '/program' },
  openGraph: {
    title: 'IBA DU & DU FBS Admission Coaching Programs | Beyond the Horizons',
    description:
      'In-depth IBA DU (5-month) and DU FBS (4-month) admission coaching programs for English-medium students.',
    url: '/program',
  },
};

export default function ProgramPage() {
  return <ProgramPageClient />;
}
