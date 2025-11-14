// Add rahmitasnim2342@gmail.com as admin

const email = 'rahmitasnim2342@gmail.com';
const name = 'Rahmita Tasnim';

print('\n📋 Adding new admin...\n');

// Check if user already exists
const existingUser = db.users.findOne({ email: email.toLowerCase() });

if (existingUser) {
  print('⚠️  User already exists!');
  print('   Current role: ' + existingUser.role);

  if (existingUser.role === 'admin' || existingUser.role === 'super_admin') {
    print('✅ User is already an admin!');
  } else {
    // Update to admin
    db.users.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          role: 'admin',
          updatedAt: new Date()
        }
      }
    );
    print('✅ Updated existing user to admin role');
  }
} else {
  // Create new admin user
  const newAdmin = {
    email: email.toLowerCase(),
    name: name,
    role: 'admin',
    accessTypes: {
      IBA: true,
      FBS: true
    },
    mockAccess: {
      duIba: true,
      bupIba: true,
      duFbs: true,
      bupFbs: true,
      fbsDetailed: true
    },
    permissions: ['read', 'write', 'admin'],
    active: true,
    addedDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  db.users.insertOne(newAdmin);
  print('✅ Created new admin user');
}

print('\n📊 Admin Details:');
const admin = db.users.findOne({ email: email.toLowerCase() });
print('   Email: ' + admin.email);
print('   Name: ' + admin.name);
print('   Role: ' + admin.role);
print('   Access: IBA=' + admin.accessTypes.IBA + ', FBS=' + admin.accessTypes.FBS);
print('\n✨ Done!\n');
