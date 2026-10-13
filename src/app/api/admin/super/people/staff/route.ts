import { handle } from '@/lib/super/people/route';
import { listStaff, getWorkload } from '@/lib/super/people/staff';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const [staff, workload] = await Promise.all([listStaff(), getWorkload()]);
    return { staff, workload };
  });
}
