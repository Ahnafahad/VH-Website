// Run this script with: mongosh "YOUR_MONGODB_CONNECTION_STRING" add-fbs-students-mongo.js
// Or: mongosh
//     > use your_database_name
//     > load('scripts/add-fbs-students-mongo.js')

const students = [
  { studentId: '6040571', name: 'Alex Alamgir', email: 'alexalamgirbd@gmail.com' },
  { studentId: '9342451', name: 'Aseya Siddiqua Saba', email: 'aseyasaba@gmail.com' },
  { studentId: '1217161', name: 'Ayaz Mohammad Zahir', email: 'iloveburgers2456@gmail.com' },
  { studentId: '6480811', name: 'Ayesha Khaled', email: 'ayeshakhaled41@gmail.com' },
  { studentId: '6500041', name: 'Aymaan Zaman', email: 'aymaanzaman05@gamil.com' },
  { studentId: '4176951', name: 'Kashfia Ahmed', email: 'kashfiaahmed70@gmail.com' },
  { studentId: '4006511', name: 'Mahabub Alam Rafi', email: 'mahbub59rafi@gmail.com' },
  { studentId: '5421271', name: 'Mansib Rahman', email: 'mansibrahmanofficial@gmail.com' },
  { studentId: '4215271', name: 'Sharika Sanjana Chowdhury', email: 'sharikachowdhury03@gmail.com' },
  { studentId: '6246901', name: 'Tarannum Rashid', email: 'sk.tarannum06@gmail.com' },
  { studentId: '6211721', name: 'Zaian Jannat Hussain', email: 'zaianjannat0001@gmail.com' },
  { studentId: '4598891', name: 'Zuhayr Adeeb Ahmed', email: 'zuhayradeeb@gmail.com' },
  { studentId: '1023456', name: 'Amreen Choudhury', email: 'amreenchoudhury05@gmail.com' },
  { studentId: '1738204', name: 'Farhat Mahmud Megha', email: 'meghafarhat@gmail.com' },
  { studentId: '2957813', name: 'Hasnat Islam', email: 'hasnatislam266@gmail.com' },
  { studentId: '3408271', name: 'Jibran Raiyyan', email: 'mdjibranraiyyan@gmail.com' },
  { studentId: '4681295', name: 'Ramisa Raida Ali', email: 'ramisaraida01234@gmail.com' },
  { studentId: '5074136', name: 'Ramisa Rahman', email: '20241110064040@vh.com' },
  { studentId: '6197380', name: 'Sayaf Bin Abdullah', email: 'b.a.sayaf17@gmail.com' },
  { studentId: '7842103', name: 'Shafqat Nur', email: '7842103@vh.com' }
];

const results = {
  migrated: 0,
  updated: 0,
  created: 0,
  errors: []
};

print('\n🚀 Starting to process ' + students.length + ' DU FBS students...\n');

// Step 1: Migrate existing studentIds to roleNumbers (one-time migration)
print('📦 Step 1: Migrating existing studentIds to roleNumbers...');
const usersToMigrate = db.users.find({
  studentId: { $exists: true, $ne: null },
  $or: [
    { roleNumbers: { $exists: false } },
    { roleNumbers: { $size: 0 } }
  ]
});

usersToMigrate.forEach(function(user) {
  if (user.studentId) {
    db.users.updateOne(
      { _id: user._id },
      {
        $set: {
          roleNumbers: [user.studentId],
          updatedAt: new Date()
        }
      }
    );
    results.migrated++;
  }
});

print('   ✅ Migrated ' + results.migrated + ' users\n');

// Step 2: Process each student
print('📝 Step 2: Processing students...\n');

students.forEach(function(student) {
  try {
    const email = student.email.toLowerCase();

    // Validate studentId format (7 digits for FBS)
    if (!/^[0-9]{7}$/.test(student.studentId)) {
      results.errors.push({
        email: email,
        error: 'FBS Student ID must be exactly 7 digits'
      });
      print('   ⚠️  ' + email + ': Invalid student ID format');
      return;
    }

    // Check if user exists
    const existingUser = db.users.findOne({ email: email });

    if (existingUser) {
      // User exists - update their roleNumbers and access
      const roleNumbers = existingUser.roleNumbers || [];

      // Add new FBS role if not already present
      if (!roleNumbers.includes(student.studentId)) {
        roleNumbers.push(student.studentId);
      }

      // Update the user
      db.users.updateOne(
        { email: email },
        {
          $set: {
            roleNumbers: roleNumbers,
            'accessTypes.FBS': true,
            'mockAccess.duFbs': true,
            updatedAt: new Date()
          }
        }
      );

      results.updated++;
      print('   ✅ Updated: ' + student.name + ' (' + email + ')');

    } else {
      // User doesn't exist - create new user
      const newUser = {
        email: email,
        name: student.name.trim(),
        role: 'student',
        studentId: student.studentId,
        roleNumbers: [student.studentId],
        accessTypes: {
          IBA: false,
          FBS: true
        },
        mockAccess: {
          duIba: false,
          bupIba: false,
          duFbs: true,
          bupFbs: false,
          fbsDetailed: false
        },
        permissions: ['read'],
        active: true,
        addedDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      db.users.insertOne(newUser);
      results.created++;
      print('   ➕ Created: ' + student.name + ' (' + email + ')');
    }

  } catch (error) {
    results.errors.push({
      email: student.email,
      error: error.message
    });
    print('   ❌ Error: ' + student.email + ' - ' + error.message);
  }
});

// Print summary
print('\n' + '='.repeat(50));
print('📊 SUMMARY');
print('='.repeat(50));
print('Total processed: ' + students.length + ' students');
print('Migrated: ' + results.migrated + ' users');
print('Updated: ' + results.updated + ' existing users');
print('Created: ' + results.created + ' new users');
print('Errors: ' + results.errors.length);

if (results.errors.length > 0) {
  print('\n⚠️  ERRORS:');
  results.errors.forEach(function(err, index) {
    print('   ' + (index + 1) + '. ' + err.email + ': ' + err.error);
  });
}

print('\n📧 Students with placeholder/suspicious emails:');
print('   - Ramisa Rahman (5074136): 20241110064040@vh.com');
print('   - Shafqat Nur (7842103): 7842103@vh.com');
print('\n✨ Done!\n');
