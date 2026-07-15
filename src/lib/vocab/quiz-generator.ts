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
import { logVocabErrorSafe } from '@/lib/vocab/error-log';

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
  /** All 5 options in A–E order. Empty for typed (production) questions. */
  options: {
    letter:  'A' | 'B' | 'C' | 'D' | 'E';
    /** Real pool word id, or 0 for plain-string options (synonym/antonym). */
    wordId:  number;
    word:    string;
  }[];
  correctLetter: 'A' | 'B' | 'C' | 'D' | 'E';
  correctWordId: number;
  /** Shown to student after they answer. */
  explanation:   string;
  /** 'choice' (default) — MCQ; 'typed' — student types the answer. */
  inputMode?:    'choice' | 'typed';
  /**
   * Typed questions only: the expected answer. Server-side — must be
   * stripped before the question is sent to the client.
   */
  correctWord?:  string;
  /** Typed questions only: hint shown to the student. */
  typedHint?:    { firstLetter: string; length: number };
  /**
   * 'word' (default) — options are real pool words, answered by wordId.
   * 'string' — options are plain strings (synonym/antonym), answered by letter.
   */
  optionKind?:   'word' | 'string';
}

/** True when the question expects a typed (production-recall) answer. */
export function isTypedQuestion(q: Pick<GeneratedQuestion, 'type'>): boolean {
  return q.type === 'type_word' || q.type === 'type_cloze';
}

// AI response shape we parse
interface AIQuestionResult {
  questionText: string;
  explanation:  string;
}

function blankTarget(example: string, word: string): string | null {
  if (!example.trim()) return null;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const replaced = example.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '_____');
  return replaced === example ? null : replaced;
}

/** Reliable, deterministic copy used when external AI providers are unavailable. */
export function buildDeterministicQuestionCopy(input: QuizQuestionInput): AIQuestionResult {
  const { correct, type } = input;
  const cloze = blankTarget(correct.exampleSentence, correct.word);
  const definition = correct.definition.trim() || `the vocabulary word “${correct.word}”`;

  if (type === 'type_word') {
    return {
      questionText: `Type the word that means: ${definition}`,
      explanation: `${correct.word} means ${definition}`,
    };
  }
  if (type === 'type_cloze' && cloze) {
    return {
      questionText: `Complete the sentence: ${cloze}`,
      explanation: `${correct.word} completes the sentence and means ${definition}`,
    };
  }
  if ((type === 'fill_blank' || type === 'correct_usage') && cloze) {
    return {
      questionText: `Which word best completes this sentence? ${cloze}`,
      explanation: `${correct.word} fits the context because it means ${definition}`,
    };
  }
  return {
    questionText: `Which word best matches this definition? ${definition}`,
    explanation: `${correct.word} is the closest match: ${definition}`,
  };
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
      type_word: `The student must TYPE the word "${correct.word}" from memory — no options are shown. Write a prompt that paraphrases the word's meaning in your own words (do NOT quote the definition verbatim and do NOT mention the word or any of its close derivatives). End the prompt with: "Type the word." Difficulty: ${difficulty}.`,
      type_cloze: `The student must TYPE the missing word "${correct.word}" from memory — no options are shown. Write a fill-in-the-blank sentence using ___ where the context points clearly and uniquely to the correct word (NOT the definition verbatim or the example sentence). Difficulty: ${difficulty}.`,
      // synonym/antonym questions are built locally without AI — never sent in prompts.
      synonym: '',
      antonym: '',
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

/**
 * Scale the output token budget with the number of questions in the batch —
 * each question needs ~250 tokens for questionText+explanation. A fixed
 * budget truncates large batches (up to 20 questions) mid-JSON, breaking
 * parsing and triggering slow retries.
 */
function computeMaxTokens(questionCount: number): number {
  return Math.min(8192, 300 * questionCount + 512);
}

async function callDeepSeek(prompt: string, maxTokens: number): Promise<AIQuestionResult[]> {
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
      max_tokens:  maxTokens,
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

async function callGemini(prompt: string, maxTokens: number): Promise<AIQuestionResult[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.87, maxOutputTokens: maxTokens },
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
  const LETTERS  = ['A', 'B', 'C', 'D', 'E'] as const;
  const prompt   = buildPrompt(inputs, studentLevel);
  const maxTokens = computeMaxTokens(inputs.length);

  function assembleResults(results: AIQuestionResult[]): GeneratedQuestion[] {
    if (results.length !== inputs.length) {
      throw new Error(`AI returned ${results.length} questions, expected ${inputs.length}`);
    }
    return inputs.map((q, i) => {
      const { correct, selection }      = q;
      const { questionText, explanation } = results[i];
      const typed = isTypedQuestion(q);
      const options = typed ? [] : selection.allOptions.map((w, idx) => ({
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
        ...(typed ? {
          inputMode:   'typed' as const,
          correctWord: correct.word,
          typedHint:   {
            firstLetter: correct.word.charAt(0).toUpperCase(),
            length:      correct.word.length,
          },
        } : { inputMode: 'choice' as const }),
      };
    });
  }

  // ── Primary: DeepSeek (up to MAX_RETRIES attempts) ──────────────────────
  let deepSeekError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return assembleResults(await callDeepSeek(prompt, maxTokens));
    } catch (err) {
      deepSeekError = err;
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  // ── Fallback: Gemini (one attempt) ────────────────────────────────────
  console.warn('DeepSeek failed, falling back to Gemini:', deepSeekError);
  logVocabErrorSafe({
    source:   'quiz_generation',
    severity: 'warning',
    context:  'deepseek_provider',
    message:  deepSeekError instanceof Error ? deepSeekError.message : String(deepSeekError),
    detail: {
      attempts:   MAX_RETRIES + 1,
      stack:      deepSeekError instanceof Error ? deepSeekError.stack : undefined,
      errorType:  deepSeekError instanceof Error ? deepSeekError.name : typeof deepSeekError,
    },
  });
  try {
    return assembleResults(await callGemini(prompt, maxTokens));
  } catch (geminiErr) {
    console.error('All AI providers failed; using deterministic quiz fallback.', {
      deepSeekError,
      geminiError: geminiErr,
    });
    logVocabErrorSafe({
      source:   'quiz_generation',
      severity: 'error',
      context:  'all_providers_failed',
      message:  'All AI providers failed; falling back to deterministic quiz generation',
      detail: {
        deepSeekError: {
          message: deepSeekError instanceof Error ? deepSeekError.message : String(deepSeekError),
          stack:   deepSeekError instanceof Error ? deepSeekError.stack : undefined,
        },
        geminiError: {
          message: geminiErr instanceof Error ? geminiErr.message : String(geminiErr),
          stack:   geminiErr instanceof Error ? (geminiErr as Error).stack : undefined,
        },
      },
    });
    return assembleResults(inputs.map(buildDeterministicQuestionCopy));
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
 * Upgrade recognition questions to production (typed) questions for words the
 * user already knows well. Recognition (MCQ) is easier than production —
 * once a word is 'familiar'+ (mastery score > 60), ~half of its questions
 * become typed recall, alternating between definition→word and cloze.
 */
export function injectProductionTypes(
  types:           VocabQuestionType[],
  correctWordIds:  number[],
  masteryByWordId: Map<number, number>,
): VocabQuestionType[] {
  let toggle = 0;
  return types.map((t, i) => {
    const score = masteryByWordId.get(correctWordIds[i]) ?? 0;
    if (score > 60 && Math.random() < 0.5) {
      return toggle++ % 2 === 0 ? 'type_word' : 'type_cloze';
    }
    return t;
  });
}

// ─── Exam mode (IBA-style) — locally built lexical questions ─────────────────
// IBA DU English vocabulary formats: synonym MCQ, antonym MCQ, analogies,
// sentence completion. Synonym/antonym questions need no AI: the stem is the
// target word and the options are plain strings drawn from the word bank's
// synonym/antonym lists.

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a synonym or antonym MCQ for `correct` without calling the AI.
 * Options are plain strings (optionKind 'string', wordId 0) — the answer is
 * checked by letter, not by wordId.
 *
 * Returns null when the word lacks the required synonym/antonym data or when
 * not enough clean distractor strings can be assembled.
 */
export function buildLexicalQuestion(
  correct:   WordForDistractor,
  selection: DistractorSelection,
  kind:      'synonym' | 'antonym',
): GeneratedQuestion | null {
  const answerPool = kind === 'synonym' ? correct.synonyms : correct.antonyms;
  if (answerPool.length === 0) return null;

  const correctOption = pickRandom(answerPool);

  // Strings that must never appear as distractors: the word itself and every
  // member of the answer pool (any of them would also be a right answer).
  const banned = new Set(
    [correct.word, ...answerPool].map(s => s.toLowerCase().trim()),
  );

  const distractorStrings: string[] = [];
  const seen = new Set<string>([correctOption.toLowerCase().trim()]);
  const push = (s: string | undefined) => {
    if (!s) return;
    const key = s.toLowerCase().trim();
    if (seen.has(key) || banned.has(key)) return;
    seen.add(key);
    distractorStrings.push(s);
  };

  // Classic exam trap: the opposite relation as one of the wrong options.
  const trapPool = kind === 'synonym' ? correct.antonyms : correct.synonyms;
  if (trapPool.length > 0) push(pickRandom(trapPool));

  // Fill the rest from the distractor words' own synonym lists (same register
  // as the correct option), falling back to the distractor word itself.
  for (const d of selection.distractors) {
    if (distractorStrings.length >= 4) break;
    push(d.synonyms.length > 0 ? pickRandom(d.synonyms) : d.word);
  }
  for (const d of selection.allOptions) {
    if (distractorStrings.length >= 4) break;
    push(d.word);
  }
  if (distractorStrings.length < 4) return null;

  // Place the correct option at a random position among 5.
  const correctIndex = Math.floor(Math.random() * 5);
  const optionStrings = [...distractorStrings.slice(0, 4)];
  optionStrings.splice(correctIndex, 0, correctOption);

  const relation = kind === 'synonym' ? 'most nearly SIMILAR' : 'most nearly OPPOSITE';
  return {
    id:            randomUUID(),
    type:          kind,
    questionText:  `Choose the word ${relation} in meaning to "${correct.word}".`,
    options:       optionStrings.map((word, idx) => ({
      letter: OPTION_LETTERS[idx],
      wordId: 0,
      word,
    })),
    correctLetter: OPTION_LETTERS[correctIndex],
    correctWordId: correct.id,
    explanation:   `"${correct.word}" means: ${correct.definition} — "${correctOption}" is ${kind === 'synonym' ? 'a synonym' : 'an antonym'}.`,
    inputMode:     'choice',
    optionKind:    'string',
  };
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
