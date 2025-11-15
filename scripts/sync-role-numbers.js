/**
 * Sync roleNumbers from students.json to MongoDB
 * This ensures database has both 6-digit and 7-digit IDs for students who have FBS mocks
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Try to load from .env.local first, then .env.production
const envPaths = [
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env.production')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath) && !process.env.MONGODB_URI) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });

    if (process.env.MONGODB_URI) {
      console.log(`📁 Loaded environment from ${path.basename(envPath)}`);
      break;
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI environment variable is not set!');
  console.error('Please set it in .env.local or pass it as an environment variable.');
  process.exit(1);
}

async function syncRoleNumbers() {
  console.log('\n🔢 Syncing Role Numbers from students.json to Database...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('vh-website');
    const users = db.collection('users');

    // Load students.json
    const studentsPath = path.join(process.cwd(), 'public', 'data', 'students.json');
    const studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));

    // Group student entries by unique student ID
    const studentGroups = new Map();

    Object.entries(studentsData.students).forEach(([key, student]) => {
      const uniqueId = student.id; // The actual student ID (e.g., "934245")

      if (!studentGroups.has(uniqueId)) {
        studentGroups.set(uniqueId, {
          name: student.name,
          email: student.email,
          keys: []
        });
      }

      studentGroups.get(uniqueId).keys.push(key);
    });

    console.log(`Found ${studentGroups.size} unique students with multiple ID formats\n`);

    let updated = 0;
    let notFound = 0;

    // For each unique student
    for (const [uniqueId, studentInfo] of studentGroups.entries()) {
      const allRoleNumbers = studentInfo.keys.map(k => String(k));

      // Find user in database by any of their role numbers or by email
      const dbUser = await users.findOne({
        $or: [
          { roleNumbers: { $in: allRoleNumbers } },
          { email: studentInfo.email }
        ],
        role: 'student'
      });

      if (dbUser) {
        // Check if database roleNumbers matches our complete list
        const dbRoleNumbers = (dbUser.roleNumbers || []).map(r => String(r));
        const missing = allRoleNumbers.filter(rn => !dbRoleNumbers.includes(rn));

        if (missing.length > 0) {
          console.log(`  ✏️  Updating roleNumbers for ${studentInfo.name}`);
          console.log(`     Current: [${dbRoleNumbers.join(', ')}]`);
          console.log(`     Adding: [${missing.join(', ')}]`);
          console.log(`     New: [${allRoleNumbers.join(', ')}]`);

          await users.updateOne(
            { _id: dbUser._id },
            { $set: { roleNumbers: allRoleNumbers } }
          );

          updated++;
        }
      } else {
        console.log(`  ⚠️  ${studentInfo.name} (${uniqueId}) not found in database`);
        notFound++;
      }
    }

    if (updated > 0) {
      console.log(`\n✅ Updated roleNumbers for ${updated} students`);
    } else {
      console.log('\n✅ All roleNumbers are up to date');
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

syncRoleNumbers();
