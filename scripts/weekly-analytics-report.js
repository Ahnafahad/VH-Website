/* Read-only weekly analytics report. Run with NODE_EXTRA_CA_CERTS set. */
const fs = require('fs');
const { createClient } = require('@libsql/client');
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const a = t.split('='); const k = a.shift();
  if (k && a.length) process.env[k.trim()] = a.join('=').trim().replace(/^["']|["']$/g, '');
}
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const CUT = Math.floor(Date.now() / 1000) - 7 * 86400;
const q = (sql, args = []) => c.execute({ sql, args }).then(r => r.rows).catch(e => [{ ERR: e.message }]);
const J = (x) => JSON.stringify(x);

(async () => {
  const R = {};
  // ── Behavioral (new tables) ──
  R.an_events_7d   = await q(`SELECT COUNT(*) n FROM analytics_events WHERE created_at>=?`, [CUT]);
  R.an_sessions_7d = await q(`SELECT COUNT(*) n, SUM(is_authenticated) auth FROM analytics_sessions WHERE started_at>=?`, [CUT]);
  R.an_top_pages   = await q(`SELECT path, COUNT(*) views FROM analytics_events WHERE type='pageview' AND created_at>=? GROUP BY path ORDER BY views DESC LIMIT 10`, [CUT]);
  R.an_devices     = await q(`SELECT device, COUNT(*) n FROM analytics_sessions WHERE started_at>=? GROUP BY device`, [CUT]);
  R.an_features    = await q(`SELECT name, COUNT(*) n FROM analytics_events WHERE type='feature' AND created_at>=? GROUP BY name ORDER BY n DESC LIMIT 15`, [CUT]);

  // ── Users / activity ──
  R.total_users    = await q(`SELECT COUNT(*) n FROM users`);
  R.new_users_7d   = await q(`SELECT COUNT(*) n FROM users WHERE created_at>=?`, [CUT]);
  R.active_vocab_7d= await q(`SELECT COUNT(*) n FROM vocab_user_progress WHERE last_study_date>=?`, [CUT]);
  R.onboarded      = await q(`SELECT SUM(onboarding_complete) done, COUNT(*) total FROM vocab_user_progress`);

  // ── Vocab last 7d ──
  R.vocab_quiz_7d  = await q(`SELECT session_type, status, COUNT(*) n, SUM(CASE WHEN passed=1 THEN 1 ELSE 0 END) passed FROM vocab_quiz_sessions WHERE started_at>=? GROUP BY session_type, status`, [CUT]);
  R.vocab_flash_7d = await q(`SELECT status, COUNT(*) n FROM vocab_flashcard_sessions WHERE started_at>=? GROUP BY status`, [CUT]);
  R.vocab_ans_type = await q(`SELECT question_type, COUNT(*) n, ROUND(100.0*SUM(is_correct)/COUNT(*),1) acc FROM vocab_quiz_answers WHERE answered_at>=? GROUP BY question_type ORDER BY n DESC`, [CUT]);
  R.srs_events_7d  = await q(`SELECT COUNT(*) n FROM vocab_srs_events WHERE created_at>=?`, [CUT]);
  // hardest words (all-time, needs enough attempts)
  R.hardest_words  = await q(`SELECT w.word, SUM(r.total_attempts) att, ROUND(100.0*SUM(r.correct_attempts)/SUM(r.total_attempts),1) acc, SUM(r.flashcard_missed_count) missed
    FROM vocab_user_word_records r JOIN vocab_words w ON w.id=r.word_id
    GROUP BY r.word_id HAVING att>=8 ORDER BY acc ASC, att DESC LIMIT 12`);
  R.mastery_dist   = await q(`SELECT mastery_level, COUNT(*) n FROM vocab_user_word_records GROUP BY mastery_level`);
  R.confusion      = await q(`SELECT a.word wa, b.word wb, p.count cnt FROM vocab_confusion_pairs p JOIN vocab_words a ON a.id=p.word_a_id JOIN vocab_words b ON b.id=p.word_b_id ORDER BY p.count DESC LIMIT 10`);

  // ── Math last 7d ──
  R.math_sessions_7d = await q(`SELECT status, COUNT(*) n FROM math_sessions WHERE started_at>=? GROUP BY status`, [CUT]);
  R.math_ops_7d      = await q(`SELECT operation, COUNT(*) att, ROUND(100.0*SUM(is_correct)/COUNT(*),1) acc, ROUND(AVG(response_time_ms)) avg_ms, ROUND(100.0*SUM(was_skipped)/COUNT(*),1) skip_pct FROM math_question_attempts WHERE answered_at>=? GROUP BY operation ORDER BY att DESC`, [CUT]);
  R.math_skill_avg   = await q(`SELECT ROUND(AVG(skill_addition),2) add_, ROUND(AVG(skill_subtraction),2) sub, ROUND(AVG(skill_multiplication),2) mul, ROUND(AVG(skill_division),2) div FROM math_user_progress`);

  // ── Funnel / acquisition last 7d ──
  R.reg_7d_status  = await q(`SELECT status, COUNT(*) n FROM registrations WHERE created_at>=? GROUP BY status`, [CUT]);
  R.reg_7d_mode    = await q(`SELECT program_mode, COUNT(*) n FROM registrations WHERE created_at>=? GROUP BY program_mode`, [CUT]);
  R.free_signups_7d= await q(`SELECT COUNT(*) n FROM free_signups WHERE created_at>=?`, [CUT]);
  R.access_req     = await q(`SELECT status, COUNT(*) n FROM vocab_access_requests GROUP BY status`);
  R.upgrade_int    = await q(`SELECT selected_option, COUNT(*) n FROM vocab_upgrade_requests GROUP BY selected_option`);

  for (const [k, v] of Object.entries(R)) console.log(k + ' => ' + J(v));
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
