import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), read: vi.fn(), save: vi.fn(),
}));
vi.mock('@/lib/tests/route-helpers', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/db-access-control', () => ({ isEmailAuthorized: vi.fn() }));
vi.mock('@/lib/vocab/error-log', () => ({ logVocabErrorSafe: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/lms/operations-store', async importOriginal => {
  const actual = await importOriginal<typeof import('../operations-store')>();
  return { ...actual, readOperationalSection: mocks.read, saveOperationalRecord: mocks.save };
});

import { GET, POST } from '@/app/api/lms/admin/operational/[section]/route';
import { PATCH } from '@/app/api/lms/admin/operational/[section]/[id]/route';
import { ApiException } from '@/lib/api-utils';

const context = (section: string) => ({ params: Promise.resolve({ section }) });
const request = (method = 'GET', body?: unknown) => new NextRequest('http://localhost/api/lms/admin/operational/expenses', {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: 7, role: 'admin' });
  mocks.read.mockResolvedValue({ entries: [] });
  mocks.save.mockResolvedValue({ id: 9 });
});

describe('operational API authorization', () => {
  it.each(['student', 'instructor'])('blocks %s from every section and mutation', async role => {
    mocks.requireUser.mockResolvedValue({ id: 7, role });
    for (const section of ['instructors', 'expenses', 'income', 'extra-classes']) {
      expect((await GET(request(), context(section))).status).toBe(403);
      expect((await POST(request('POST', {}), context(section))).status).toBe(403);
      expect((await PATCH(request('PATCH', {}), { params: Promise.resolve({ section, id: '1' }) })).status).toBe(403);
    }
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('blocks unauthenticated reads and writes', async () => {
    mocks.requireUser.mockRejectedValue(new ApiException('Authentication required', 401));
    expect((await GET(request(), context('instructors'))).status).toBe(401);
    expect((await POST(request('POST', {}), context('expenses'))).status).toBe(401);
    expect((await PATCH(request('PATCH', {}), { params: Promise.resolve({ section: 'expenses', id: '1' }) })).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(['admin', 'super_admin'])('allows %s to read and save', async role => {
    mocks.requireUser.mockResolvedValue({ id: 7, role });
    expect((await GET(request(), context('expenses'))).status).toBe(200);
    const body = { date: '2026-10-06', amount: '100.25', category: 'Rent' };
    expect((await POST(request('POST', body), context('expenses'))).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith('expenses', body, 7);
    expect((await PATCH(request('PATCH', body), { params: Promise.resolve({ section: 'income', id: '9' }) })).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith('income', body, 7, 9);
  });
});

describe('operational API input', () => {
  it('rejects unknown sections and invalid IDs before saving', async () => {
    expect((await GET(request(), context('unknown'))).status).toBe(404);
    for (const id of ['0', '-1', '1.5', '1e3', '99999999999999999']) {
      expect((await PATCH(request('PATCH', {}), { params: Promise.resolve({ section: 'expenses', id }) })).status).toBe(400);
    }
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('returns a validation error for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/lms/admin/operational/expenses', { method: 'POST', body: '{' });
    expect((await POST(req, context('expenses'))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
