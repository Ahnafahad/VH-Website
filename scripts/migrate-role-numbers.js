/**
 * Migration script to move studentId to roleNumbers array
 * This ensures backward compatibility while supporting multiple role numbers
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
  }
}

loadEnvFile();

// Connect to MongoDB
async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;

  if (!mongoUri) {
    throw new Error('MongoDB URI not found in environment variables');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
}

// Run migration
async function migrate() {
  try {
    await connectToDatabase();

    // Get User model
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // Find all users with studentId but no roleNumbers or empty roleNumbers
    const users = await User.find({
      studentId: { $exists: true, $ne: null },
      $or: [
        { roleNumbers: { $exists: false } },
        { roleNumbers: { $size: 0 } }
      ]
    });

    console.log(`Found ${users.length} users to migrate`);

    let migrated = 0;
    for (const user of users) {
      // Add studentId to roleNumbers array if not already there
      await User.updateOne(
        { _id: user._id },
        { $set: { roleNumbers: [user.studentId] } }
      );
      migrated++;
      console.log(`Migrated user: ${user.email} (${user.studentId})`);
    }

    console.log(`\nMigration complete! Migrated ${migrated} users.`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the migration
migrate()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
