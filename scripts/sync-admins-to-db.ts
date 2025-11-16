/**
 * Sync admins from access-control.json to MongoDB
 * Run this script to ensure admins exist in the database
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(process.cwd(), '.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env.local:', result.error);
}

// User schema (simplified)
interface IUser {
  email: string;
  name: string;
  role: string;
  permissions: string[];
  active: boolean;
  addedDate: Date;
}

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  permissions: [{ type: String }],
  active: { type: Boolean, default: true },
  addedDate: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

async function syncAdmins() {
  try {
    console.log('🔄 Starting admin sync from JSON to MongoDB...');

    // Read access-control.json
    const jsonPath = path.join(process.cwd(), 'access-control.json');
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ access-control.json not found at:', jsonPath);
      process.exit(1);
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const admins = jsonData.admins || [];
    console.log(`📋 Found ${admins.length} admins in JSON file`);

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable not set');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    let synced = 0;
    let updated = 0;
    let skipped = 0;

    for (const admin of admins) {
      try {
        const email = admin.email.toLowerCase();
        const existingUser = await User.findOne({ email });

        if (existingUser) {
          // Update existing user if they're not already an admin
          if (existingUser.role !== admin.role) {
            existingUser.role = admin.role;
            existingUser.name = admin.name;
            existingUser.permissions = admin.permissions || ['read', 'write', 'delete'];
            existingUser.active = admin.active !== false;
            await existingUser.save();
            console.log(`  ✏️  Updated: ${email} (${admin.role})`);
            updated++;
          } else {
            console.log(`  ⏭️  Skipped: ${email} (already synced)`);
            skipped++;
          }
        } else {
          // Create new admin user
          const newUser = new User({
            email,
            name: admin.name,
            role: admin.role,
            permissions: admin.permissions || ['read', 'write', 'delete'],
            active: admin.active !== false,
            addedDate: new Date()
          });
          await newUser.save();
          console.log(`  ➕ Created: ${email} (${admin.role})`);
          synced++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${admin.email}:`, error);
      }
    }

    console.log('\n📊 Sync Summary:');
    console.log(`  ➕ Created: ${synced}`);
    console.log(`  ✏️  Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log('✅ Admin sync complete!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error syncing admins:', error);
    process.exit(1);
  }
}

syncAdmins();
