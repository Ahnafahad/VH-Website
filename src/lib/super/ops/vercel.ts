/** Vercel REST API client for the Deploys tab. The token is only ever sent in the Authorization header. */
const API = 'https://api.vercel.com';

export const vercelConfigured = () => !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);

function qs(extra: Record<string, string> = {}) {
  const p = new URLSearchParams(extra);
  if (process.env.VERCEL_TEAM_ID) p.set('teamId', process.env.VERCEL_TEAM_ID);
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function vfetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Vercel API ${res.status}: ${body?.error?.message ?? 'request failed'}`);
  return body;
}

export interface DeployRow { id: string; state: string; target: string | null; url: string; createdAt: number; sha: string | null; message: string | null }

export async function listDeployments(limit = 15): Promise<DeployRow[]> {
  const body = await vfetch(`/v6/deployments${qs({ projectId: process.env.VERCEL_PROJECT_ID!, limit: String(limit) })}`);
  return (body.deployments ?? []).map((d: Record<string, any>) => ({
    id: d.uid, state: d.readyState ?? d.state, target: d.target ?? null, url: d.url,
    createdAt: d.created ?? d.createdAt,
    sha: d.meta?.githubCommitSha?.slice(0, 7) ?? null,
    message: d.meta?.githubCommitMessage ?? null,
  }));
}

/** Promote (== instant rollback when the target is older) a deployment to production. */
export async function promoteDeployment(deploymentId: string): Promise<void> {
  await vfetch(`/v10/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID!)}/promote/${encodeURIComponent(deploymentId)}${qs()}`, { method: 'POST' });
}
