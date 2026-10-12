import { NextResponse } from 'next/server';
import { loadPlayableSets } from '@/features/last-word/content/load';
import type { LastWordSet } from '@/features/last-word/content/schema';

/**
 * Player-visible content, built once at deploy time and served as a static, cacheable file (ETag),
 * so the game page itself stays small. Fields the client never reads are dropped.
 */
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(loadPlayableSets().map(toClient));
}

function toClient(set: LastWordSet) {
  return {
    ...set,
    source: undefined,
    semantic_axes: [],
    words: set.words.map(({ word, sense }) => ({ word, sense })),
    edges: set.edges.map(({ id, a, b, boundary_rule }) => ({ id, a, b, boundary_rule })),
    anchors: set.anchors && { positive: set.anchors.positive },
    chains: set.chains.map(({ qa: _qa, ...chain }) => chain), // eslint-disable-line @typescript-eslint/no-unused-vars
  };
}
