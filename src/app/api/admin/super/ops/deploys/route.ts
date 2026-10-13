import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createErrorResponse, ApiException } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { recordAudit } from '@/lib/audit-log';
import { listDeployments, promoteDeployment, vercelConfigured } from '@/lib/super/ops/vercel';

export async function GET() {
  try {
    await requireSuperAdmin();
    if (!vercelConfigured()) return NextResponse.json({ configured: false, deployments: [] });
    return NextResponse.json({ configured: true, deployments: await listDeployments() });
  } catch (error) {
    return createErrorResponse(error);
  }
}

const promoteSchema = z.object({ deploymentId: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    if (!vercelConfigured()) throw new ApiException('Not configured: set VERCEL_TOKEN, VERCEL_PROJECT_ID', 400);
    const { deploymentId } = promoteSchema.parse(await req.json());
    const target = (await listDeployments(50)).find(d => d.id === deploymentId);
    if (!target) throw new ApiException('Deployment not found among the latest 50', 404);
    if (target.target !== 'production' || target.state !== 'READY') throw new ApiException('Only a READY production deployment can be promoted', 400);
    await promoteDeployment(deploymentId);
    await recordAudit({ actorUserId: actor.id, action: 'deploy.promote', entityType: 'deployment', after: { deploymentId, sha: target.sha, message: target.message } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}
