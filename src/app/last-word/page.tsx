import type { Metadata } from 'next';
import LastWordGame from '@/features/last-word/LastWordGame';
import { loadPlayableSets } from '@/features/last-word/content/load';

export const metadata: Metadata = { title: 'Last Word', description: 'Follow the context. Find the word that fits now.' };

export default function LastWordPage() {
  return <LastWordGame sets={loadPlayableSets()} />;
}
