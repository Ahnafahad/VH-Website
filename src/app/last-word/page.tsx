import { redirect } from 'next/navigation';

/** Last Word now lives inside Lexicore's games. Old links (and staff `?preview=`) forward there. */
export default async function LastWordRedirect({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  redirect(`/vocab/games/last-word${preview ? `?preview=${encodeURIComponent(preview)}` : ''}`);
}
