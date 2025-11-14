// Check the roles and access for FBS students

const sampleEmails = [
  'alexalamgirbd@gmail.com',
  'aseyasaba@gmail.com',
  '7842103@vh.com',
  'mdjibranraiyyan@gmail.com'
];

print('\n📋 Checking FBS Students Roles and Access...\n');
print('='.repeat(80));

sampleEmails.forEach(function(email) {
  const user = db.users.findOne({ email: email });

  if (user) {
    print('\n✅ ' + user.name + ' (' + email + ')');
    print('   Role: ' + user.role);
    print('   Student ID: ' + (user.studentId || 'N/A'));
    print('   Role Numbers: [' + (user.roleNumbers || []).join(', ') + ']');
    print('   Access Types: IBA=' + user.accessTypes.IBA + ', FBS=' + user.accessTypes.FBS);
    print('   Mock Access:');
    print('     - DU IBA: ' + user.mockAccess.duIba);
    print('     - BUP IBA: ' + user.mockAccess.bupIba);
    print('     - DU FBS: ' + user.mockAccess.duFbs);
    print('     - BUP FBS: ' + user.mockAccess.bupFbs);
  } else {
    print('\n❌ ' + email + ' - NOT FOUND');
  }
});

print('\n' + '='.repeat(80));
print('\n📊 Overall Statistics:\n');

const totalUsers = db.users.countDocuments({ role: 'student' });
const fbsUsers = db.users.countDocuments({ 'accessTypes.FBS': true });
const ibaUsers = db.users.countDocuments({ 'accessTypes.IBA': true });
const bothAccess = db.users.countDocuments({ 'accessTypes.IBA': true, 'accessTypes.FBS': true });

print('Total Students: ' + totalUsers);
print('FBS Access: ' + fbsUsers);
print('IBA Access: ' + ibaUsers);
print('Both IBA + FBS: ' + bothAccess);

print('\n✨ Done!\n');
