/**
 * One-off backfill: apply material→class name propagation to links that already
 * existed before propagation was moved server-side.
 *
 * Propagation runs at attach time. Any material attached to a class before that
 * code shipped never renamed its class, so classes like "Monday Class" stay
 * generic even though an attached material carries a perfectly good topic.
 * This script re-runs the same decision over every existing link.
 *
 * It reuses `planPropagation` — the same pure function the live write paths
 * use — so it cannot drift from runtime behaviour. Classes that already carry a
 * real lesson name are protected by `planClassRenameFromMaterial` and are left
 * alone, which also makes this safe to run more than once.
 *
 * Links are read from the `sessionMaterials` junction only, matching
 * propagate.ts. (Verified against prod: the junction is a superset of the
 * legacy `materials.classSessionId` column — 0 column-only links.)
 *
 * Dry run by default. Pass --apply to write.
 *
 *   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"
 *   npx tsx scripts/backfill-class-names.ts            # preview
 *   npx tsx scripts/backfill-class-names.ts --apply    # write
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
// Type-only: erased at compile time, so it does not import the db client early.
import type { LinkedClass } from '../src/lib/naming/propagate';

// .env.local must land in process.env before the db client module is imported,
// since it reads TURSO_* at module scope.
const envPath = path.join(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const APPLY = process.argv.includes('--apply');

async function main() {
  const { eq } = await import('drizzle-orm');
  const { db } = await import('../src/lib/db');
  const { classSessions, materials, sessionMaterials } = await import('../src/lib/db/schema');
  const { planPropagation } = await import('../src/lib/naming/propagate');

  const links = await db
    .select({ sessionId: sessionMaterials.sessionId, materialId: sessionMaterials.materialId })
    .from(sessionMaterials);

  if (links.length === 0) {
    console.log('No session_materials links. Nothing to do.');
    return;
  }

  const allClasses = await db.select().from(classSessions);
  // Live view of class state: a class renamed by an earlier material must be
  // protected from a later one, exactly as it would be at runtime.
  const classById = new Map<number, LinkedClass>(
    allClasses.map(c => [c.id, c as LinkedClass]),
  );

  const byMaterial = new Map<number, number[]>();
  for (const l of links) {
    const list = byMaterial.get(l.materialId) ?? [];
    list.push(l.sessionId);
    byMaterial.set(l.materialId, list);
  }

  const planned: { classId: number; from: string; to: string; via: string }[] = [];

  for (const materialId of [...byMaterial.keys()].sort((a, b) => a - b)) {
    const material = await db.select().from(materials).where(eq(materials.id, materialId)).get();
    if (!material) continue;

    const classes = (byMaterial.get(materialId) ?? [])
      .map(id => classById.get(id))
      .filter((c): c is LinkedClass => !!c);
    if (classes.length === 0) continue;

    const renames = planPropagation(classes, {
      course: material.product as never,
      subject: material.subject as never,
      docType: material.docType as never,
      number: material.number ?? '',
      topic: material.topic ?? '',
    });

    for (const { id, ...update } of renames) {
      const before = classById.get(id)!;
      planned.push({ classId: id, from: before.title, to: update.title, via: material.title });
      classById.set(id, { ...before, ...update });
      if (APPLY) {
        await db.update(classSessions).set(update).where(eq(classSessions.id, id));
      }
    }
  }

  const skipped = allClasses.length - planned.length;
  console.log(`Classes:            ${allClasses.length}`);
  console.log(`Links:              ${links.length}`);
  console.log(`Would rename:       ${planned.length}`);
  console.log(`Untouched:          ${skipped} (already named, or no material attached)\n`);

  for (const p of planned) {
    console.log(`  class ${p.classId}`);
    console.log(`    "${p.from}"`);
    console.log(` -> "${p.to}"`);
    console.log(`    from material: ${p.via}\n`);
  }

  console.log(APPLY
    ? `Applied ${planned.length} rename(s).`
    : `Dry run — no writes performed. Re-run with --apply to write.`);
}

main().catch(err => { console.error(err); process.exit(1); });
