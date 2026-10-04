-- Owner-reviewed migration. Do not apply against a remote database during development.
CREATE TABLE last_word_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  score INTEGER NOT NULL,
  decision_count INTEGER NOT NULL,
  submission TEXT NOT NULL,
  UNIQUE(user_id, client_id)
);
CREATE INDEX last_word_sessions_user_idx ON last_word_sessions(user_id);
CREATE TABLE last_word_node_mastery (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, word)
);
CREATE TABLE last_word_edge_mastery (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edge_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, edge_id)
);
CREATE TABLE last_word_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edge_id TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  interval_days REAL NOT NULL,
  data TEXT NOT NULL,
  UNIQUE(user_id, edge_id)
);
CREATE INDEX last_word_reviews_due_idx ON last_word_reviews(user_id, due_at);
CREATE TABLE last_word_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES last_word_sessions(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  set_id TEXT NOT NULL,
  edge_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  beat_id TEXT NOT NULL,
  presented_words TEXT NOT NULL,
  selected_word TEXT NOT NULL,
  best_word TEXT NOT NULL,
  semantic_fit REAL NOT NULL,
  correctness TEXT NOT NULL,
  reaction_time_ms INTEGER NOT NULL,
  changed_selection INTEGER NOT NULL,
  previous_selection TEXT,
  hint_level INTEGER NOT NULL,
  confidence TEXT,
  misconception_tag TEXT,
  content_difficulty TEXT NOT NULL,
  review_interval_days REAL NOT NULL,
  score INTEGER NOT NULL,
  evidence_weight REAL NOT NULL,
  occurred_at INTEGER NOT NULL,
  data TEXT NOT NULL,
  UNIQUE(session_id, client_id),
  UNIQUE(session_id, scenario_id, beat_id)
);
CREATE INDEX last_word_decisions_edge_idx ON last_word_decisions(user_id, edge_id);
