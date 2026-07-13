DELETE FROM vocab_quiz_answers
WHERE id NOT IN (
  SELECT MIN(id)
  FROM vocab_quiz_answers
  GROUP BY session_id, word_id
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_vocab_quiz_answer_session_word
ON vocab_quiz_answers (session_id, word_id);
