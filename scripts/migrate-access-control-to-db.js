#!/usr/bin/env node

/**
 * Migration Script: Access Control JSON to Database
 *
 * This script migrates all users from access-control.json to MongoDB.
 * It preserves all existing data and sets up the new access control fields.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Import User model (we need to define it here since we're in a Node script)
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  role: { type: String, required: true, enum: ['super_admin', 'admin', 'student'] },
  adminId: { type: String, sparse: true, unique: true },
  studentId: { type: String, sparse: true, unique: true },
  class: String,
  batch: String,
  accessTypes: {
    IBA: { type: Boolean, default: false },
    DU: { type: Boolean, default: false },
    FBS: { type: Boolean, default: false }
  },
  mockAccess: {
    duIba: { type: Boolean, default: false },
    bupIba: { type: Boolean, default: false },
    duFbs: { type: Boolean, default: false },
    bupFbs: { type: Boolean, default: false },
    fbsDetailed: { type: Boolean, default: false }
  },
  permissions: [String],
  active: { type: Boolean, default: true },
  addedDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function migrateAccessControl() {
  console.log('🚀 Starting migration from access-control.json to MongoDB...\n');

  const configPath = path.join(process.cwd(), 'access-control.json');

  // Check if config file exists
  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: access-control.json not found in project root');
    process.exit(1);
  }

  try {
    // Read MongoDB URI from environment
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      console.error('❌ Error: MONGODB_URI not found in environment variables');
      console.error('Please set MONGODB_URI in your .env file');
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Read and parse access-control.json
    console.log('📖 Reading access-control.json...');
    const jsonContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(jsonContent);

    if (!config.admins || !config.students) {
      console.error('❌ Error: Invalid access-control.json structure');
      process.exit(1);
    }

    console.log(`Found ${config.admins.length} admins and ${config.students.length} students\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Migrate admins
    console.log('👤 Migrating admins...');
    for (const admin of config.admins) {
      try {
        // Check if already exists
        const existing = await User.findOne({ email: admin.email.toLowerCase() });
        if (existing) {
          console.log(`⏭️  Skipped: ${admin.email} (already exists)`);
          skippedCount++;
          continue;
        }

        // Create new user
        const newUser = new User({
          email: admin.email.toLowerCase(),
          name: admin.name,
          role: admin.role,
          adminId: admin.id,
          permissions: admin.permissions || ['read', 'write', 'admin'],
          active: admin.active !== false,
          addedDate: admin.addedDate ? new Date(admin.addedDate) : new Date(),
          accessTypes: {
            IBA: false,
            DU: false,
            FBS: false
          },
          mockAccess: {
            duIba: false,
            bupIba: false,
            duFbs: false,
            bupFbs: false,
            fbsDetailed: false
          }
        });

        await newUser.save();
        console.log(`✅ Migrated admin: ${admin.email}`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating admin ${admin.email}:`, error.message);
        errorCount++;
      }
    }

    // Migrate students
    console.log('\n👨‍🎓 Migrating students...');
    for (const student of config.students) {
      try {
        // Check if already exists
        const existing = await User.findOne({
          $or: [
            { email: student.email.toLowerCase() },
            { studentId: student.studentId }
          ]
        });

        if (existing) {
          console.log(`⏭️  Skipped: ${student.email} (already exists)`);
          skippedCount++;
          continue;
        }

        // Infer access types from class field
        const classField = (student.class || '').toUpperCase();
        const accessTypes = {
          IBA: classField.includes('IBA'),
          DU: classField.includes('DU'),
          FBS: classField.includes('FBS')
        };

        // Create new user
        const newUser = new User({
          email: student.email.toLowerCase(),
          name: student.name,
          role: 'student',
          studentId: student.studentId,
          class: student.class,
          batch: student.batch,
          permissions: student.permissions || ['read'],
          active: student.active !== false,
          addedDate: student.addedDate ? new Date(student.addedDate) : new Date(),
          accessTypes: accessTypes,
          mockAccess: {
            duIba: false,
            bupIba: false,
            duFbs: false,
            bupFbs: false,
            fbsDetailed: false
          }
        });

        await newUser.save();
        console.log(`✅ Migrated student: ${student.email} (${student.studentId})`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating student ${student.email}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already exist): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${config.admins.length + config.students.length}`);
    console.log('='.repeat(50));

    // Close database connection
    await mongoose.connection.close();
    console.log('\n✅ Migration completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Update your authentication system to use the database');
    console.log('   2. Update admin panel to manage users via database');
    console.log('   3. Test the new system thoroughly');
    console.log('   4. Keep access-control.json as backup until fully migrated\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env.local');

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
    }
  } catch (error) {
    console.log('Note: Could not load .env.local file');
  }
}

loadEnvFile();

// Run migration
if (require.main === module) {
  migrateAccessControl();
}

module.exports = { migrateAccessControl };
