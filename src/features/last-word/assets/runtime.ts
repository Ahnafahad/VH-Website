'use client';

/**
 * Client asset lookup. The build writes public/last-word/assets/available.json listing only the
 * asset ids whose files passed validation (scripts/last-word/validate-assets.mjs --write). Anything
 * not listed uses its procedural placeholder, so dropping in a file needs no code change.
 */
const ROOT = '/last-word/assets/';
let loading: Promise<Map<string, string>> | null = null;

export function loadAvailableAssets(): Promise<Map<string, string>> {
  return (loading ??= fetch(`${ROOT}available.json`, { cache: 'no-cache' })
    .then(response => (response.ok ? response.json() : { assets: [] }))
    .then((data: { assets?: { id: string; paths: string[] }[] }) => new Map((data.assets ?? []).map(asset => [asset.id, ROOT + asset.paths[0]])))
    .catch(() => new Map()));
}

/** Synchronous lookup after loadAvailableAssets() resolved; null = use the placeholder. */
export type AssetUrls = Map<string, string>;
export const assetUrl = (assets: AssetUrls, id: string) => assets.get(id) ?? null;
