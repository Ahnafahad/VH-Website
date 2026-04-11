/**
 * POST /api/init-admin
 *
 * One-time bootstrap: creates the first super_admin account.
 *
 * SECURITY (RISK_009):
 *  1. Disabled entirely unless INIT_ADMIN_SECRET is set in env.
 *  2. Returns 403 if any admin/super_admin already exists in the DB.
 *
 * Body: { email: string; name: string; secret: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, or } from 'drizzle-orm';
import { db, users } from '@/lib/db';

export async function POST(req: NextRequest) {
  // ── Guard 1: feature must be explicitly enabled via env var ────────────────
  const initSecret = process.env.INIT_ADMIN_SECRET;
  if (!initSecret) {
    return NextResponse.json({ error: 'Disabled' }, { status: 404 });
  }

  // ── Guard 2: refuse if any admin already exists ────────────────────────────
  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.role, 'admin'), eq(users.role, 'super_admin')))
    .get();

  if (existingAdmin) {
    return NextResponse.json({ error: 'Already initialized' }, { status: 403 });
  }

  // ── Parse and validate body ────────────────────────────────────────────────
  let body: { email?: string; name?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, name, secret } = body;

  if (!secret || secret !== initSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!email?.trim() || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // ── Create super_admin ─────────────────────────────────────────────────────
  const normalEmail = email.toLowerCase().trim();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalEmail))
    .get();

  if (existing) {
    // User exists — upgrade to super_admin
    await db
      .update(users)
      .set({ role: 'super_admin', status: 'active', updatedAt: new Date() })
      .where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({
      email:  normalEmail,
      name:   name.trim(),
      role:   'super_admin',
      status: 'active',
    });
  }

  return NextResponse.json({ ok: true, message: 'Super admin created' });
}
