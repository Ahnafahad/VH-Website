/**
 * POST /api/admin/words/import
 *
 * Bulk word import.
 * Body: { words: WordImportRow[] }
 *
 * Upsert logic:
 *   - If a word (case-insensitive match) already exists in the same theme → update it.
 *   - Otherwise → insert new row.
 *
 * Returns: { imported: number, updated: number, errors: string[] }
 *
 * Admin only.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { db, vocabWords } from '@/lib/db';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const wordImportRowSchema = z.object({
  word:             z.string().min(1, '"word" is required'),
  definition:       z.string().min(1, '"definition" is required'),
  synonyms:         z.string().optional(),
  antonyms:         z.string().optional(),
  example_sentence: z.string().optional(),
  part_of_speech:   z.string().optional(),
  unit_id:          z.number({ required_error: '"unit_id" is required' }),
  theme_id:         z.number({ required_error: '"theme_id" is required' }),
  difficulty_base:  z.number().min(1).max(5).optional(),
});

const bodySchema = z.object({
  words: z.array(wordImportRowSchema).min(1, 'words array must be non-empty'),
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

export interface WordImportRow {
  word:             string;
  definition:       string;
  synonyms?:        string;   // comma-separated string
  antonyms?:        string;   // comma-separated string
  example_sentence?: string;
  part_of_speech?:  string;
  unit_id:          number;
  theme_id:         number;
  difficulty_base?: number;   // 1–5, default 3
}

function parseCommaSeparated(value?: string): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const rawBody = await req.json();
    const parsed  = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiException(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.issues }),
        400,
      );
    }
    const rows: WordImportRow[] = parsed.data.words as WordImportRow[];

    let imported = 0;
    let updated  = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row  = rows[i];
      const line = `Row ${i + 1}`;

      // ── Validate required fields ──────────────────────────────────────────
      if (!row.word?.trim()) {
        errors.push(`${line}: "word" is required`);
        continue;
      }
      if (!row.definition?.trim()) {
        errors.push(`${line} (${row.word}): "definition" is required`);
        continue;
      }
      if (!row.unit_id || !Number.isInteger(Number(row.unit_id))) {
        errors.push(`${line} (${row.word}): "unit_id" must be a valid integer`);
        continue;
      }
      if (!row.theme_id || !Number.isInteger(Number(row.theme_id))) {
        errors.push(`${line} (${row.word}): "theme_id" must be a valid integer`);
        continue;
      }

      const unitId  = Number(row.unit_id);
      const themeId = Number(row.theme_id);
      const word    = row.word.trim();

      const difficultyRaw = row.difficulty_base !== undefined
        ? Number(row.difficulty_base)
        : 3;
      const difficultyBase = isNaN(difficultyRaw)
        ? 3
        : Math.max(1, Math.min(5, Math.round(difficultyRaw)));

      const synonymsJson = JSON.stringify(parseCommaSeparated(row.synonyms));
      const antonymsJson = JSON.stringify(parseCommaSeparated(row.antonyms));

      try {
        // ── Upsert: check if word exists in this theme (case-insensitive) ──
        const existing = await db
          .select({ id: vocabWords.id })
          .from(vocabWords)
          .where(
            and(
              eq(vocabWords.themeId, themeId),
              sql`LOWER(${vocabWords.word}) = LOWER(${word})`,
            )
          )
          .get();

        const now = new Date();

        if (existing) {
          // Update existing word
          await db
            .update(vocabWords)
            .set({
              definition:      row.definition.trim(),
              synonyms:        synonymsJson,
              antonyms:        antonymsJson,
              exampleSentence: row.example_sentence?.trim() ?? '',
              partOfSpeech:    row.part_of_speech?.trim()   ?? '',
              difficultyBase,
              unitId,
              updatedAt:       now,
            })
            .where(eq(vocabWords.id, existing.id));
          updated++;
        } else {
          // Insert new word
          await db
            .insert(vocabWords)
            .values({
              word,
              definition:      row.definition.trim(),
              synonyms:        synonymsJson,
              antonyms:        antonymsJson,
              exampleSentence: row.example_sentence?.trim() ?? '',
              partOfSpeech:    row.part_of_speech?.trim()   ?? '',
              difficultyBase,
              unitId,
              themeId,
              createdAt:       now,
              updatedAt:       now,
            });
          imported++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${line} (${word}): DB error — ${message}`);
      }
    }

    return { imported, updated, errors };
  });
}
