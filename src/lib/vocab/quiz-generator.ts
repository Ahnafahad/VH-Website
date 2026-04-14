/**
 * T21 — DeepSeek Quiz Generator
 *
 * Server-side ONLY. API key never leaves server.
 * DeepSeek's sole job: write question text + explanation.
 * Word selection + distractor selection happen in caller code.
 *
 * Retries up to 2 times on parse failure.
 */

import { randomUUID } from 'crypto';
import type { WordForDistractor, DistractorSelection } from '@/lib/vocab/distractor-selector';
import type { VocabQuestionType } from '@/lib/db/schema';

// ─── Variation pools ──────────────────────────────────────────────────────────

const QUESTION_ANGLES = [
  'a situation that unexpectedly improved',
  'a decision someone came to regret',
  'a comparison between two people or eras',
  'someone realizing something too late',
  'a first-time experience',
  'a professional under pressure',
  'a subtle contrast between expectation and reality',
  'a moment of quiet resolution',
  'two opposing viewpoints in tension',
  'a shift in power or authority',
  'an outsider observing something for the first time',
  'a long-term consequence becoming visible',
  'something being described to someone who doesn\'t understand it',
  'a situation that got worse before it got better',
  'a leader or mentor giving direction',
  'someone being proved wrong',
  'a communal or collective effort',
  'an unusual or ironic use of the concept',
  'a moment of hesitation before action',
  'a detail that changes the meaning of everything else',
];

const SENTENCE_CONSTRUCTIONS = [
  'begin with the subject acting first (active voice)',
  'begin with a subordinate clause (When / Although / After / Despite)',
  'use a named character — give them a first name',
  'use a comparative structure (more ... than / less ... than)',
  'embed the target word near the end of the sentence',
  'write a short punchy sentence under 12 words',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type StudentLevel    = 'beginner' | 'intermediate' | 'advanced';

export interface QuizQuestionInput {
  correct:    WordForDistractor;
  selection:  DistractorSelection;
  type:       VocabQuestionType;
  difficulty: DifficultyLevel;
}

export interface GeneratedQuestion {
  /** Stable id for this question within the session. */
  id:            string;
  type:          VocabQuestionType;
  questionText:  string;
  /** All 5 options in A–E order. */
  options: {
    letter:  'A' | 'B' | 'C' | 'D' | 'E';
    wordId:  number;
    word:    string;
  }[];
  correctLetter: 'A' | 'B' | 'C' | 'D' | 'E';
  correctWordId: number;
  /** Shown to student after they answer. */
  explanation:   string;
}

// AI response shape we parse
interface AIQuestionResult {
  questionText: string;
  explanation:  string;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(
  inputs:       QuizQuestionInput[],
  studentLevel: StudentLevel,
): string {
  const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

  const questionBlocks = inputs.map((q, i) => {
    const { correct, selection, type, difficulty } = q;
    const optionLines = selection.allOptions
      .map((w, idx) => `    ${LETTERS[idx]}. ${w.word}`)
      .join('\n');

    const angle        = QUESTION_ANGLES[Math.floor(Math.random() * QUESTION_ANGLES.length)];
    const construction = SENTENCE_CONSTRUCTIONS[Math.floor(Math.random() * SENTENCE_CONSTRUCTIONS.length)];
    const seed         = Math.floor(Math.random() * 9000) + 1000;

    const typeInstructions: Record<VocabQuestionType, string> = {
      fill_blank: `Write a fill-in-the-blank sentence where the blank clearly fits only the correct word. The sentence should use context (NOT the definition verbatim or the example sentence). Difficulty: ${difficulty}.`,
      analogy: `Write an analogy question in the format "Word A : Word B :: ${correct.word} : ___". Choose Word A and Word B so the relationship mirrors how ${correct.word} relates to its correct answer. The blank must be filled by the correct answer word. Difficulty: ${difficulty}.`,
      correct_usage: `Write 3 short sentences. Exactly ONE uses "${correct.word}" correctly in context. The other two use it incorrectly or in a misleading way. The question prompt should ask: "Which sentence uses the word correctly?" Do NOT mention the word in your questionText — embed it naturally in the sentences. Difficulty: ${difficulty}.`,
    };

    return `--- QUESTION ${i + 1} ---
Type: ${type}
Student level: ${studentLevel}
Correct word: ${correct.word}
Part of speech: ${correct.partOfSpeech}
Definition: ${correct.definition}
Synonyms: ${correct.synonyms.join(', ') || 'none'}
Antonyms: ${correct.antonyms.join(', ') || 'none'}
Correct answer position: ${selection.correctLetter}
Options:
${optionLines}
Instruction: ${typeInstructions[type]}
Variation seed: ${seed}
For each sentence you write:
- Narrative angle: frame it as ${angle}
- Sentence construction: ${construction}
- The word's natural meaning governs the topic — do NOT force it into an unrelated domain.
IMPORTANT: Do NOT reuse the example sentence verbatim. Do NOT reveal which option is correct in the questionText.`;
  });

  return `You are a vocabulary quiz writer for advanced Bangladeshi university entrance exam preparation (IBA, BUP, FBS level). Write ${inputs.length} quiz question(s) using the word data provided.

Rules:
- questionText must NOT contain the correct answer word or its definition.
- Explanation must be 1–2 sentences: state what the word means and why it fits the context.
- For fill_blank: use ___ (three underscores) to mark the blank.
- Never reuse example sentences verbatim.
- Output ONLY a valid JSON array. No markdown, no code fences, no prose.

Output format (JSON array, one object per question):
[
  {
    "questionText": "...",
    "explanation": "..."
  }
]

${questionBlocks.join('\n\n')}`;
}

// ─── AI calls ────────────────────────────────────────────────────────────────

/** Parse raw AI text into validated AIQuestionResult[] (shared by all providers). */
function parseAIResponse(rawText: string, provider: string): AIQuestionResult[] {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`${provider} returned invalid JSON`);
  }

  if (!Array.isArray(parsed)) throw new Error(`${provider} response is not an array`);

  return parsed.map((item: unknown) => {
    if (
      typeof item !== 'object' || item === null ||
      typeof (item as Record<string, unknown>).questionText !== 'string' ||
      typeof (item as Record<string, unknown>).explanation  !== 'string'
    ) {
      throw new Error(`${provider} response item missing required fields`);
    }
    const obj = item as Record<string, string>;
    return { questionText: obj.questionText, explanation: obj.explanation };
  });
}

async function callDeepSeek(prompt: string): Promise<AIQuestionResult[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       'deepseek-chat',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.87,
      max_tokens:  2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };

  return parseAIResponse(data?.choices?.[0]?.message?.content ?? '', 'DeepSeek');
}

async function callGemini(prompt: string): Promise<AIQuestionResult[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.87, maxOutputTokens: 2048 },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return parseAIResponse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '', 'Gemini');
}

// ─── Main export ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;

/**
 * Generate quiz questions. Primary: DeepSeek. Fallback: Gemini.
 * Server-side only — never call from client components.
 *
 * @param inputs        - One entry per question (correct word + distractor selection + type).
 * @param studentLevel  - Controls question complexity.
 * @returns             - Array of fully-formed GeneratedQuestion objects.
 * @throws              - If all providers fail.
 */
export async function generateQuizQuestions(
  inputs:       QuizQuestionInput[],
  studentLevel: StudentLevel,
): Promise<GeneratedQuestion[]> {
  const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
  const prompt  = buildPrompt(inputs, studentLevel);

  function assembleResults(results: AIQuestionResult[]): GeneratedQuestion[] {
    if (results.length !== inputs.length) {
      throw new Error(`AI returned ${results.length} questions, expected ${inputs.length}`);
    }
    return inputs.map((q, i) => {
      const { correct, selection }      = q;
      const { questionText, explanation } = results[i];
      const options = selection.allOptions.map((w, idx) => ({
        letter:  LETTERS[idx],
        wordId:  w.id,
        word:    w.word,
      }));
      return {
        id:            randomUUID(),
        type:          q.type,
        questionText,
        options,
        correctLetter: selection.correctLetter,
        correctWordId: correct.id,
        explanation,
      };
    });
  }

  // ── Primary: DeepSeek (up to MAX_RETRIES attempts) ──────────────────────
  let deepSeekError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return assembleResults(await callDeepSeek(prompt));
    } catch (err) {
      deepSeekError = err;
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  // ── Fallback: Gemini (one attempt) ────────────────────────────────────
  console.warn('DeepSeek failed, falling back to Gemini:', deepSeekError);
  try {
    return assembleResults(await callGemini(prompt));
  } catch (geminiErr) {
    throw new Error(
      `All AI providers failed. DeepSeek: ${deepSeekError} | Gemini: ${geminiErr}`,
    );
  }
}

/**
 * Determine student level based on theme completion percentage.
 * Beginner < 40% → Intermediate < 70% → Advanced.
 */
export function resolveStudentLevel(completedThemes: number, totalThemes: number): StudentLevel {
  if (totalThemes === 0) return 'beginner';
  const pct = completedThemes / totalThemes;
  if (pct >= 0.70) return 'advanced';
  if (pct >= 0.40) return 'intermediate';
  return 'beginner';
}

/**
 * Pick question types for a session given the student level.
 * Harder types are mixed in once unlocked.
 */
export function pickQuestionTypes(
  count:        number,
  studentLevel: StudentLevel,
): VocabQuestionType[] {
  const pool: VocabQuestionType[] = [];

  if (studentLevel === 'beginner') {
    pool.push(...Array(count).fill('fill_blank'));
  } else if (studentLevel === 'intermediate') {
    // ~60% fill_blank, ~40% analogy
    for (let i = 0; i < count; i++) {
      pool.push(i % 5 < 3 ? 'fill_blank' : 'analogy');
    }
  } else {
    // advanced: mix all three roughly 40/30/30
    for (let i = 0; i < count; i++) {
      if (i % 10 < 4)      pool.push('fill_blank');
      else if (i % 10 < 7) pool.push('analogy');
      else                  pool.push('correct_usage');
    }
  }

  return pool;
}

/**
 * Adjust difficulty within a session based on consecutive correct/wrong answers.
 * 2 consecutive correct → nudge up. 2 consecutive wrong → nudge down.
 */
export function adjustDifficulty(
  current:             DifficultyLevel,
  consecutiveCorrect:  number,
  consecutiveWrong:    number,
): DifficultyLevel {
  if (consecutiveCorrect >= 2) {
    if (current === 'easy')   return 'medium';
    if (current === 'medium') return 'hard';
  }
  if (consecutiveWrong >= 2) {
    if (current === 'hard')   return 'medium';
    if (current === 'medium') return 'easy';
  }
  return current;
}
