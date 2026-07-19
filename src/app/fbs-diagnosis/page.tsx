import type { Metadata } from 'next';
import FbsDiagnosisClient from './FbsDiagnosisClient';

export const metadata: Metadata = {
  title: 'Free FBS Diagnostic Test — DU C-Unit | Beyond the Horizons',
  description:
    'A free 30-minute FBS (DU C-Unit) diagnostic. 50 MCQs across five subjects, instant detailed results with explanations, a live leaderboard, and an instructor benchmark.',
};

export default function FbsDiagnosisPage() {
  return <FbsDiagnosisClient />;
}
