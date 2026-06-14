/** Convert milliseconds to a human-readable string: "2m 13s", "45s", "1h 3m" */
export function msToHuman(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const hours   = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const secs    = totalSec % 60;
  if (hours > 0) {
    return secs > 0 ? `${hours}h ${minutes}m ${secs}s` : `${hours}h ${minutes}m`;
  }
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}

/** Format a number with thousands separators */
export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

/** Format a percentage (0–100) */
export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—';
  return `${n.toFixed(decimals)}%`;
}
