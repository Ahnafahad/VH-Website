/**
 * GET /mocks/[slug]/solutions: the interactive solution sheet. Signed-in + canAccessTest + released
 * (solutionsOpen; staff always). The template is lib/mocks/solution-sheet/sheet.html; the content lives in
 * the mock_solutions table and is inlined here with the viewer's answers and the cohort's stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { validateAuth } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { canAccessTest, isTestStaff } from '@/lib/tests/access';
import { getPublishedTestBySlug } from '@/lib/tests/service';
import { applyWindowOverrides } from '@/lib/tests/window-overrides';
import { solutionsOpen } from '@/lib/mocks/state';
import { buildSolutionSheetData } from '@/lib/mocks/solutions';

const HEADERS = { 'Cache-Control': 'private, no-store' };
const html = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

function waitPage(slug: string) {
  return html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solutions</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#1a0f12;color:#f3ece6;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:1.4rem">Solutions are not open yet</h1>
<p style="opacity:.75;max-width:30rem">They open once every window of the mock has closed and results go up at 8pm (Dhaka) on the exam day.</p>
<a href="/mocks/${esc(slug)}/results" style="color:#e4b363">&larr; Back to results</a></div></body>`, 403);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let email: string;
  try { ({ email } = await validateAuth()); }
  catch { return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${encodeURIComponent(`/mocks/${slug}/solutions`)}`, req.url)); }
  const user = await getUserByEmail(email);
  if (!user) return html('Not found', 404);

  const found = await getPublishedTestBySlug(slug);
  if (!found || !found.test.isMock || !canAccessTest(user, found.test)) return html('Not found', 404);
  const { test } = found;
  const windows = await applyWindowOverrides(user.id, found.windows);
  if (!isTestStaff(user) && !solutionsOpen(test, windows)) return waitPage(slug);

  const data = await buildSolutionSheetData(test, user.id, user.name ?? 'Student');
  if (!data) return html('Solutions for this mock are not available yet.', 404);

  const json = JSON.stringify(data).replace(/</g, '\\u003c'); // also covers </script>, <!--
  const sheet = (await readFile(path.join(process.cwd(), 'src/lib/mocks/solution-sheet/sheet.html'), 'utf-8'))
    .replace('<script src="data.js"></script>', () => `<script>window.SOLN_DATA=${json}</script>`)
    .replace('BTH Mock 1 — </span>', () => `${esc(test.title)} — </span>`)
    .replaceAll('src="refs/', 'src="/solution-sheet/')
    .replaceAll('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/', '/solution-sheet/katex/') // CSP allows only self-hosted scripts
    .replace('<div class="header-actions">', () =>
      `<div class="header-actions"><a class="btn-pill" href="/mocks/${esc(slug)}/results" style="text-decoration:none">&larr; Results</a>`);
  return html(sheet);
}
