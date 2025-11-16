/**
 * Sync roleNumbers from students.json to MongoDB
 * This ensures FBS students can access their mock test results
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

async function syncRoleNumbers() {
  console.log('\n🔄 Syncing roleNumbers to Database...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('vh-website');
    const users = db.collection('users');

    // Load students.json
    const studentsPath = path.join(process.cwd(), 'public', 'data', 'students.json');
    const studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));

    // Build email to IDs mapping
    const emailToIds = new Map();

    Object.entries(studentsData.students).forEach(([key, student]) => {
      const email = student.email?.toLowerCase()?.trim();
      if (email) {
        if (!emailToIds.has(email)) {
          emailToIds.set(email, new Set());
        }
        // Add both the key (actual ID) and the id field
        emailToIds.get(email).add(key);
        if (student.id && student.id !== key) {
          emailToIds.get(email).add(student.id);
        }
      }
    });

    console.log(`📊 Found ${emailToIds.size} unique emails in students.json\n`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    // Update each user
    for (const [email, ids] of emailToIds.entries()) {
      const roleNumbersArray = Array.from(ids);

      const user = await users.findOne({ email, role: 'student' });

      if (user) {
        const currentRoleNumbers = user.roleNumbers || [];

        // Check if update needed
        const needsUpdate = roleNumbersArray.some(id => !currentRoleNumbers.includes(id)) ||
                           currentRoleNumbers.some(id => !roleNumbersArray.includes(id));

        if (needsUpdate) {
          // Find 6-digit ID for studentId
          const sixDigitId = roleNumbersArray.find(id => id.length === 6);

          const updateDoc = {
            $set: {
              roleNumbers: roleNumbersArray
            }
          };

          // Also set studentId if not present
          if (sixDigitId && !user.studentId) {
            updateDoc.$set.studentId = sixDigitId;
          }

          await users.updateOne({ email }, updateDoc);
          console.log(`  ✅ Updated ${email}: [${roleNumbersArray.join(', ')}]`);
          updated++;
        } else {
          console.log(`  ⏭️  Skipped ${email}: already correct`);
          skipped++;
        }
      } else {
        console.log(`  ⚠️  Not found: ${email}`);
        notFound++;
      }
    }

    console.log('\n📈 Summary:');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ⚠️  Not Found: ${notFound}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }

  console.log('\n✨ Done!\n');
}

syncRoleNumbers();
