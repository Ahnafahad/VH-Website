/**
 * Server-side propagation of a material's naming facts to the classes it is
 * connected to. This is the single source of truth for the material↔class
 * name link — previously this logic lived only in MaterialsClient.tsx and
 * only fired from the "Link to class" dialog, so no other write path (create
 * material, attach existing material to a class, edit a material's naming
 * facts) ever kept a class name in sync.
 *
 * "Connected to" means rows in the many-to-many `sessionMaterials` junction
 * table — the single source of truth for the material↔class link. Every
 * write path that links a material to a class (create with classSessionId,
 * "Link to class" dialog PATCH, "attach existing material" POST) writes a
 * junction row, so this no longer needs to also union the legacy
 * `materials.classSessionId` column. That column is still written (kept for
 * readers outside this module that haven't been migrated) but is no longer
 * read here.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, materials, sessionMaterials } from '@/lib/db/schema';
import { planClassRenameFromMaterial, ClassForRename, MaterialFacts } from './class-link';
import type { CourseKey, SubjectKey, DocTypeKey } from './taxonomy';

type Db = typeof db;

/** A class row plus its id, as loaded from the DB for the rename planner. */
export interface LinkedClass extends ClassForRename {
  id: number;
}

/** A rename actually applied to a class. */
export interface AppliedRename {
  id: number;
  subject: SubjectKey;
  topic: string | null;
  classNumber: number | null;
  title: string;
}

/**
 * Pure decision step, no I/O: for each linked class, the rename to apply (if
 * any). Classes for which `planClassRenameFromMaterial` returns null
 * (already have a real lesson name) are omitted — this is also what makes
 * propagation idempotent, since a class that was just renamed now carries a
 * usable name and is protected on the next run.
 */
export function planPropagation(classes: LinkedClass[], mat: MaterialFacts): AppliedRename[] {
  const updates: AppliedRename[] = [];
  for (const cls of classes) {
    const plan = planClassRenameFromMaterial(cls, mat);
    if (plan) updates.push({ id: cls.id, ...plan });
  }
  return updates;
}

/**
 * Load the material's naming facts and every class connected to it, apply
 * `planClassRenameFromMaterial` to each, and write back the classes that
 * should rename. Returns the renames actually applied (empty array if none,
 * or if the material has no linked classes).
 *
 * Never throws — a propagation failure must not fail the caller's actual
 * write (creating/linking/editing a material). Failures are logged and
 * treated as "nothing renamed".
 */
export async function propagateMaterialNameToClasses(
  dbClient: Db,
  materialId: number,
): Promise<AppliedRename[]> {
  try {
    const material = await dbClient
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .get();
    if (!material) return [];

    const junctionRows = await dbClient
      .select({ sessionId: sessionMaterials.sessionId })
      .from(sessionMaterials)
      .where(eq(sessionMaterials.materialId, materialId));

    const sessionIds = new Set<number>(junctionRows.map((r) => r.sessionId));
    if (sessionIds.size === 0) return [];

    const classRows = await Promise.all(
      [...sessionIds].map((id) =>
        dbClient.select().from(classSessions).where(eq(classSessions.id, id)).get(),
      ),
    );
    const classes: LinkedClass[] = classRows.filter((c): c is NonNullable<typeof c> => !!c);

    const mat: MaterialFacts = {
      course: material.product as CourseKey,
      subject: material.subject as SubjectKey,
      docType: material.docType as DocTypeKey | null,
      number: material.number ?? '',
      topic: material.topic ?? '',
    };

    const renames = planPropagation(classes, mat);
    for (const { id, ...update } of renames) {
      await dbClient.update(classSessions).set(update).where(eq(classSessions.id, id));
    }
    return renames;
  } catch (err) {
    console.error('[naming/propagate] propagateMaterialNameToClasses failed:', err);
    return [];
  }
}
