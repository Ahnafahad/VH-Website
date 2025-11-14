// Check Zuhayr's details

const zuhayrEmail = 'zuhayradeeb@gmail.com';

print('\n🔍 Checking Zuhayr\'s account...\n');

const user = db.users.findOne({ email: zuhayrEmail });

if (user) {
  print('✅ Found user:');
  print('   Email: ' + user.email);
  print('   Name: ' + user.name);
  print('   Student ID (old): ' + (user.studentId || 'N/A'));
  print('   Role Numbers: [' + (user.roleNumbers || []).join(', ') + ']');
  print('   Access Types: IBA=' + user.accessTypes.IBA + ', FBS=' + user.accessTypes.FBS);
} else {
  print('❌ User not found!');
}

print('\n');
