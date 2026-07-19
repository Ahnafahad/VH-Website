/**
 * Word Hunt — DeepSeek sentence + relation judge.
 *
 * A single call judges (1) whether the student's sentence demonstrates real
 * understanding of their GUESSED word, and (2) how the guessed word relates
 * to the round's hidden word. Server-side only. No fallback provider — on
 * total failure the caller must reject the request (attempt not consumed).
 */

import type { GuessRelation } from './types';

const DEEPSEEK_URL   = 'https://api.deepseek.com/v1/chat/completions';
const TIMEOUT_MS     = 20_000;
const MAX_RETRIES    = 2;

export type SentenceVerdict = 'clear' | 'basic' | 'reject';
export type SentenceRejectReason =
  | 'wrong_meaning' | 'weak_context' | 'wrong_form' | 'grammar' | 'too_vague' | 'copied_clue';

export interface JudgeInput {
  guessedWord:      string;
  sentence:         string;
  hiddenWord:        string;
  intendedMeaning:   string;
  definition:        string;
  characteristics:   string[];
  relatedGuesses:    { word: string; distinction: string }[];
  /** Present when this is a revision of a previously rejected sentence. */
  previousFeedback?: string;
}

export interface JudgeResult {
  sentence: {
    verdict:  SentenceVerdict;
    reason:   SentenceRejectReason | null;
    feedback: string;
  };
  relation: {
    value:    GuessRelation;
    feedback: string;
  };
}

const VALID_VERDICTS: SentenceVerdict[] = ['clear', 'basic', 'reject'];
const VALID_REASONS: SentenceRejectReason[] = [
  'wrong_meaning', 'weak_context', 'wrong_form', 'grammar', 'too_vague', 'copied_clue',
];
const VALID_RELATIONS: GuessRelation[] = [
  'correct', 'very_close', 'related', 'same_topic', 'opposite', 'unrelated',
];

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildPrompt(input: JudgeInput): string {
  const {
    guessedWord, sentence, hiddenWord, intendedMeaning, definition,
    characteristics, relatedGuesses, previousFeedback,
  } = input;

  const relatedBlock = relatedGuesses.length
    ? relatedGuesses.map(r => `  - "${r.word}": ${r.distinction}`).join('\n')
    : '  (none authored)';

  const revisionBlock = previousFeedback
    ? `\nThis is a REVISION. The student's previous attempt at this same sentence was rejected with this feedback: "${previousFeedback}". Judge the new sentence on its own merits.`
    : '';

  return `You are judging one guess in a Wordle-style vocabulary game. The student guessed the word "${guessedWord}" and wrote an original sentence using it. You must judge TWO things and return ONLY a JSON object.

STEP 1 — Judge the SENTENCE, purely on whether it demonstrates correct, meaningful understanding of "${guessedWord}" (NOT whether "${guessedWord}" is the hidden word — it usually is not).
Verdicts:
- "clear": confident, specific, unambiguous correct usage.
- "basic": correct but generic/simple (e.g. bare "She was ${guessedWord}." with weak context still counts as reject if too thin — use "basic" only when usage is correct but unremarkable).
- "reject": usage fails. Pick exactly one reason:
  - "wrong_meaning": sentence shows a different/incorrect meaning of the word.
  - "weak_context": too generic to prove understanding (e.g. a bare "She was X." with no supporting context).
  - "wrong_form": wrong part of speech for how the word was written (e.g. using a noun as a verb).
  - "grammar": broken English that obscures the usage.
  - "too_vague": sentence is understandable but doesn't pin down the word's specific meaning.
  - "copied_clue": sentence is copied or trivially adapted from the round's context-sentence clue.
Note: if "${guessedWord}" has multiple valid meanings and the student correctly used a DIFFERENT valid meaning than the one intended, still accept it (clear or basic) — it proves they understand their word.
Never reveal the hidden word or its first letter in your feedback, no matter what.
${revisionBlock}

STEP 2 — Judge the RELATION between the guessed word "${guessedWord}" and the hidden word "${hiddenWord}" (meaning: ${intendedMeaning}; definition: ${definition}; distinguishing characteristics: ${characteristics.join('; ') || 'none authored'}).
Relation values: "correct" (same word/family), "very_close" (near-synonym, subtle difference), "related" (same semantic field, meaningfully different), "same_topic" (same broad topic, not close in meaning), "opposite" (antonym-like), "unrelated" (no meaningful connection).
${relatedGuesses.length ? `If "${guessedWord}" matches one of these authored related guesses, base your relation value and feedback on it:\n${relatedBlock}` : ''}
Relation feedback: 1-3 sentences, teach the student the distinction between their guessed word and the hidden word's meaning — grounded in the definitions above. NEVER state or spell out the hidden word itself.

Student's sentence: "${sentence}"

Return ONLY this JSON shape, no markdown, no prose:
{
  "sentence": { "verdict": "clear"|"basic"|"reject", "reason": "wrong_meaning"|"weak_context"|"wrong_form"|"grammar"|"too_vague"|"copied_clue"|null, "feedback": "..." },
  "relation": { "value": "correct"|"very_close"|"related"|"same_topic"|"opposite"|"unrelated", "feedback": "..." }
}`;
}

// ─── Validation ───────────────────────────────────────────────────────────

function validateResult(parsed: unknown): JudgeResult {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Judge response is not an object');
  }
  const obj = parsed as Record<string, unknown>;
  const s = obj.sentence as Record<string, unknown> | undefined;
  const r = obj.relation as Record<string, unknown> | undefined;

  if (typeof s !== 'object' || s === null) throw new Error('Judge response missing sentence');
  if (typeof r !== 'object' || r === null) throw new Error('Judge response missing relation');

  const verdict = s.verdict;
  if (typeof verdict !== 'string' || !VALID_VERDICTS.includes(verdict as SentenceVerdict)) {
    throw new Error(`Judge response has invalid sentence.verdict: ${String(verdict)}`);
  }
  const reason = s.reason;
  if (reason !== null && (typeof reason !== 'string' || !VALID_REASONS.includes(reason as SentenceRejectReason))) {
    throw new Error(`Judge response has invalid sentence.reason: ${String(reason)}`);
  }
  if (typeof s.feedback !== 'string' || s.feedback.trim() === '') {
    throw new Error('Judge response has invalid sentence.feedback');
  }

  const relationValue = r.value;
  if (typeof relationValue !== 'string' || !VALID_RELATIONS.includes(relationValue as GuessRelation)) {
    throw new Error(`Judge response has invalid relation.value: ${String(relationValue)}`);
  }
  if (typeof r.feedback !== 'string' || r.feedback.trim() === '') {
    throw new Error('Judge response has invalid relation.feedback');
  }

  return {
    sentence: {
      verdict:  verdict as SentenceVerdict,
      reason:   (reason as SentenceRejectReason | null) ?? null,
      feedback: s.feedback,
    },
    relation: {
      value:    relationValue as GuessRelation,
      feedback: r.feedback,
    },
  };
}

function parseJudgeResponse(rawText: string): JudgeResult {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Judge returned invalid JSON');
  }
  return validateResult(parsed);
}

// ─── DeepSeek call ────────────────────────────────────────────────────────

async function callDeepSeekJudge(prompt: string): Promise<JudgeResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'deepseek-chat',
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens:  600,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${err}`);
    }

    const data = await response.json() as {
      choices?: { message?: { content?: string } }[];
    };

    return parseJudgeResponse(data?.choices?.[0]?.message?.content ?? '');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Judge a guess's sentence + word relation in one DeepSeek call.
 * Retries MAX_RETRIES times on failure (network, timeout, bad JSON/shape).
 * Throws on total failure — the caller must NOT consume the attempt.
 */
export async function judgeGuess(input: JudgeInput): Promise<JudgeResult> {
  const prompt = buildPrompt(input);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callDeepSeekJudge(prompt);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
