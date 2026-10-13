import { NextRequest } from 'next/server';
import { ApiException, safeApiHandler } from '@/lib/api-utils';
import { requireOperationalAdmin } from '@/lib/lms/operations-auth';
import { listExpenseEntries } from '@/lib/lms/operations-store';
import { expensesCsv, filterEntries, MONTH_RE } from '@/lib/lms/expense-report';

// GET /api/lms/admin/operational/export?month=YYYY-MM[&category=&unreimbursed=1&q=]
// Omit month for every month. Same filters as the tracker screen, so the file matches what is shown.
export async function GET(req: NextRequest) {
  // safeApiHandler always answers JSON, so use it for auth/validation errors and unwrap the CSV on success.
  const result = await safeApiHandler(async () => {
    await requireOperationalAdmin();
    const params = req.nextUrl.searchParams;
    const month = params.get('month') ?? undefined;
    if (month !== undefined && !MONTH_RE.test(month)) throw new ApiException('Invalid month', 400);
    const rows = filterEntries(await listExpenseEntries(), {
      month, category: params.get('category') || undefined,
      unreimbursed: params.get('unreimbursed') === '1', q: params.get('q') ?? undefined,
    });
    return { month: month ?? 'all', csv: expensesCsv(rows) };
  });
  if (!result.ok) return result;
  const { month, csv } = await result.json() as { month: string; csv: string };
  // BOM so Excel reads the file as UTF-8.
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="expenses-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
