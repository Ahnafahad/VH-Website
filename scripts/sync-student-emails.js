/**
 * Sync student emails from MongoDB to students.json
 * This ensures students.json always has the latest emails from the database
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Try to load from .env.local first
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath) && !process.env.MONGODB_URI) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      process.env[key] = value;
    }
  });
}

// Load from environment variables (set in .env.local or pass via command line)
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI environment variable is not set!');
  console.error('Please set it in .env.local or pass it as an environment variable.');
  process.exit(1);
}

async function syncStudentEmails() {
  console.log('\n📧 Syncing Student Emails from Database...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('vh-website');
    const users = db.collection('users');

    // Load students.json
    const studentsPath = path.join(process.cwd(), 'public', 'data', 'students.json');
    const studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));

    let updated = 0;
    let notFound = 0;

    // For each student in students.json
    for (const [studentId, student] of Object.entries(studentsData.students)) {
      // Find in database by roleNumbers (which includes old studentId)
      const dbUser = await users.findOne({
        roleNumbers: { $in: [studentId, parseInt(studentId)] },
        role: 'student'
      });

      if (dbUser) {
        if (student.email !== dbUser.email) {
          console.log(`  ✏️  Updating ${student.name}`);
          console.log(`     Old: ${student.email}`);
          console.log(`     New: ${dbUser.email}`);
          student.email = dbUser.email;
          updated++;
        }
      } else {
        console.log(`  ⚠️  ${student.name} (${studentId}) not found in database`);
        notFound++;
      }
    }

    // Save updated students.json
    if (updated > 0) {
      fs.writeFileSync(studentsPath, JSON.stringify(studentsData, null, 2));
      console.log(`\n✅ Updated ${updated} student emails in students.json`);
    } else {
      console.log('\n✅ All emails are up to date');
    }

    if (notFound > 0) {
      console.log(`⚠️  ${notFound} students not found in database`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }

  console.log('\n✨ Done!\n');
}

syncStudentEmails();
