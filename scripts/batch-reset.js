#!/usr/bin/env node

/**
 * Batch Reset Script
 *
 * Clears all student accounts and game data from the previous batch.
 * Admins and super_admins are preserved.
 *
 * What is deleted:
 *   - All users with role: "student"
 *   - All documents in: mathscores, vocabscores, accountingscores, accountingprogresses
 *   - All documents in: registrations
 *
 * What is preserved:
 *   - All admin and super_admin user accounts
 *   - access-control.json and generated-access-control.ts
 *   - Env vars, codebase, everything else
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ── Load .env.local ──────────────────────────────────────────────────────────

function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...rest] = trimmed.split('=');
          if (key && rest.length > 0) {
            process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
      console.log('Loaded .env.local');
    }
  } catch (e) {
    console.log('Note: could not load .env.local:', e.message);
  }
}

// ── Minimal schemas (matches production models) ──────────────────────────────

const UserSchema = new mongoose.Schema({
  email: String,
  name: String,
  role: String,
  active: Boolean,
}, { collection: 'users', strict: false });

const RegistrationSchema = new mongoose.Schema({}, { collection: 'registrations', strict: false });
const MathScoreSchema    = new mongoose.Schema({}, { collection: 'mathscores',    strict: false });
const VocabScoreSchema   = new mongoose.Schema({}, { collection: 'vocabscores',   strict: false });
const AccountingScoreSchema    = new mongoose.Schema({}, { collection: 'accountingscores',    strict: false });
const AccountingProgressSchema = new mongoose.Schema({}, { collection: 'accountingprogresses', strict: false });

const User               = mongoose.model('User',               UserSchema);
const Registration       = mongoose.model('Registration',       RegistrationSchema);
const MathScore          = mongoose.model('MathScore',          MathScoreSchema);
const VocabScore         = mongoose.model('VocabScore',         VocabScoreSchema);
const AccountingScore    = mongoose.model('AccountingScore',    AccountingScoreSchema);
const AccountingProgress = mongoose.model('AccountingProgress', AccountingProgressSchema);

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  loadEnvFile();

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not set');
    process.exit(1);
  }

  console.log('\nConnecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected.\n');

  // ── Dry-run counts ────────────────────────────────────────────────────────

  const [
    totalUsers, adminUsers, studentUsers,
    mathCount, vocabCount, acctScoreCount, acctProgressCount,
    regCount
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: { $in: ['admin', 'super_admin'] } }),
    User.countDocuments({ role: 'student' }),
    MathScore.countDocuments({}),
    VocabScore.countDocuments({}),
    AccountingScore.countDocuments({}),
    AccountingProgress.countDocuments({}),
    Registration.countDocuments({}),
  ]);

  console.log('='.repeat(52));
  console.log('  PRE-RESET STATE');
  console.log('='.repeat(52));
  console.log(`  Users total          : ${totalUsers}`);
  console.log(`    → admins/super     : ${adminUsers}  (KEEPING)`);
  console.log(`    → students         : ${studentUsers}  (DELETING)`);
  console.log(`  Math scores          : ${mathCount}  (DELETING)`);
  console.log(`  Vocab scores         : ${vocabCount}  (DELETING)`);
  console.log(`  Accounting scores    : ${acctScoreCount}  (DELETING)`);
  console.log(`  Accounting progress  : ${acctProgressCount}  (DELETING)`);
  console.log(`  Registrations        : ${regCount}  (DELETING)`);
  console.log('='.repeat(52));

  if (studentUsers + mathCount + vocabCount + acctScoreCount + acctProgressCount + regCount === 0) {
    console.log('\nNothing to delete — database is already clean.');
    await mongoose.connection.close();
    process.exit(0);
  }

  // ── List admins being preserved ───────────────────────────────────────────

  const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } }, 'email name role').lean();
  console.log('\n  Admins being preserved:');
  for (const a of admins) {
    console.log(`    [${a.role}] ${a.name} <${a.email}>`);
  }
  console.log('');

  // ── Execute deletions ─────────────────────────────────────────────────────

  console.log('Running reset...\n');

  const [
    delStudents,
    delMath,
    delVocab,
    delAcctScore,
    delAcctProgress,
    delReg,
  ] = await Promise.all([
    User.deleteMany({ role: 'student' }),
    MathScore.deleteMany({}),
    VocabScore.deleteMany({}),
    AccountingScore.deleteMany({}),
    AccountingProgress.deleteMany({}),
    Registration.deleteMany({}),
  ]);

  // ── Post-reset verification ───────────────────────────────────────────────

  const [remainingUsers, remainingStudents] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'student' }),
  ]);

  console.log('='.repeat(52));
  console.log('  RESET COMPLETE');
  console.log('='.repeat(52));
  console.log(`  Students deleted     : ${delStudents.deletedCount}`);
  console.log(`  Math scores deleted  : ${delMath.deletedCount}`);
  console.log(`  Vocab scores deleted : ${delVocab.deletedCount}`);
  console.log(`  Acct scores deleted  : ${delAcctScore.deletedCount}`);
  console.log(`  Acct progress deleted: ${delAcctProgress.deletedCount}`);
  console.log(`  Registrations deleted: ${delReg.deletedCount}`);
  console.log('─'.repeat(52));
  console.log(`  Users remaining      : ${remainingUsers}  (all admins)`);
  console.log(`  Students remaining   : ${remainingStudents}  (should be 0)`);
  console.log('='.repeat(52));

  if (remainingStudents !== 0) {
    console.error('\nWARNING: Some students were not deleted. Check manually.');
  } else {
    console.log('\nDatabase is clean and ready for the new batch.');
    console.log('Next step: add new students via /admin/users or /api/add-fbs-students');
  }

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async err => {
  console.error('\nFATAL ERROR:', err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
