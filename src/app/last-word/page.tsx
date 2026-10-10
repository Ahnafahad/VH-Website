import type { Metadata } from 'next';
import LastWordGame from '@/features/last-word/LastWordGame';
import { fixtureSets } from '@/features/last-word/content/fixtures';

export const metadata: Metadata = { title: 'Last Word', description: 'Follow the context. Find the word that fits now.' };

export default function LastWordPage() {
  return <LastWordGame sets={fixtureSets} />;
}
