/**
 * GET /api/lms/dashboard
 * Student aggregate: last class, next class, week schedule, assignments,
 * upcoming tests, announcements. Staff bypass access checks.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { getDashboardData } from '@/lib/lms/dashboard-data';
import type { UserProduct } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireUser();

    // Multi-product users can request a specific product's dashboard via
    // ?product=; invalid/missing values fall back to their first product.
    const requestedProduct = req.nextUrl.searchParams.get('product');
    const activeProduct: UserProduct | undefined =
      requestedProduct && user.products.includes(requestedProduct as UserProduct)
        ? (requestedProduct as UserProduct)
        : user.products[0];

    return getDashboardData(user, activeProduct);
  });
}
