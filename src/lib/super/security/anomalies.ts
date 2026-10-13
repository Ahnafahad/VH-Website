export interface EventLite { type: string; email: string | null; ip: string | null; createdAt: number }
export interface Anomaly { email: string; kind: 'many_ips' | 'many_denied'; detail: string }

/** Sign-in anomaly hints over a window of events (callers pass the last 24h). */
export function findAnomalies(events: EventLite[], maxIps = 3, maxDenied = 3): Anomaly[] {
  const ips = new Map<string, Set<string>>();
  const denied = new Map<string, number>();
  for (const e of events) {
    if (!e.email) continue;
    if (e.type === 'signin' && e.ip) {
      if (!ips.has(e.email)) ips.set(e.email, new Set());
      ips.get(e.email)!.add(e.ip);
    }
    if (e.type === 'signin_denied') denied.set(e.email, (denied.get(e.email) ?? 0) + 1);
  }
  const out: Anomaly[] = [];
  for (const [email, set] of ips) if (set.size > maxIps) out.push({ email, kind: 'many_ips', detail: `${set.size} distinct IPs in 24h` });
  for (const [email, n] of denied) if (n >= maxDenied) out.push({ email, kind: 'many_denied', detail: `${n} denied attempts in 24h` });
  return out;
}
