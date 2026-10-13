import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db, tests } from '@/lib/db';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';

export async function GET() {
  try {
    await requireSuperAdmin();
    const rows = await db.select({ id: tests.id, title: tests.title, slug: tests.slug, bucket: tests.bucket, status: tests.status })
      .from(tests).orderBy(desc(tests.id));
    return NextResponse.json({ tests: rows });
  } catch (error) {
    return createErrorResponse(error);
  }
}
