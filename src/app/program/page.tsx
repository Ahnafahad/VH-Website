import type { Metadata } from 'next';
import ProgramPageClient from './ProgramPageClient';

export const metadata: Metadata = {
  title: 'The Programs — Beyond the Horizons',
  description:
    'Two pathways, one standard. In-depth breakdowns of our IBA DU (5-month) and DU FBS (4-month) admission programs — class structure, mocks, test format, and outcomes.',
};

export default function ProgramPage() {
  return <ProgramPageClient />;
}
