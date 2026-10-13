import { NextRequest } from 'next/server';
import { or, like, desc } from 'drizzle-orm';
import { db, users } from '@/lib/db';
import { handle } from '@/lib/super/people/route';

export const dynamic = 'force-dynamic';

// Same name/email/studentId LIKE search as GET /api/admin/users, capped at 15 for a picker.
export async function GET(req: NextRequest) {
  return handle(async () => {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (q.length < 2) return { users: [] };
    const rows = await db.select({
      id: users.id, name: users.name, email: users.email, studentId: users.studentId,
      batch: users.batch, role: users.role, status: users.status,
    }).from(users)
      .where(or(like(users.name, `%${q}%`), like(users.email, `%${q}%`), like(users.studentId, `%${q}%`)))
      .orderBy(desc(users.createdAt)).limit(15);
    return { users: rows };
  });
}
