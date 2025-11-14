// Check Ayaz's current email

print('\n🔍 Checking Ayaz\'s account...\n');

// First try to find by name
const ayazByName = db.users.findOne({ name: /Ayaz/i });

if (ayazByName) {
  print('✅ Found Ayaz by name:');
  print('   Email: ' + ayazByName.email);
  print('   Name: ' + ayazByName.name);
  print('   Student ID: ' + (ayazByName.studentId || 'N/A'));
  print('   Role Numbers: [' + (ayazByName.roleNumbers || []).join(', ') + ']');
  print('   Role: ' + ayazByName.role);
  print('   Active: ' + ayazByName.active);
  print('   Access Types: IBA=' + ayazByName.accessTypes.IBA + ', FBS=' + ayazByName.accessTypes.FBS);
} else {
  print('❌ Ayaz not found by name');
}

print('\n✨ Done!\n');
