export function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(part => Number.parseInt(part, 10) || 0);
  const b = right.split('.').map(part => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}
