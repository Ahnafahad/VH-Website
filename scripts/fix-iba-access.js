// Fix IBA access for students with 6-digit role numbers

print('\n🔧 Fixing IBA Access for students with 6-digit role numbers...\n');

// Find all students who have at least one 6-digit role number
const studentsWithIBA = db.users.find({
  role: 'student',
  roleNumbers: {
    $elemMatch: {
      $regex: /^[0-9]{6}$/
    }
  }
});

let updated = 0;
let alreadyCorrect = 0;

studentsWithIBA.forEach(function(user) {
  // Check if they have a 6-digit role number
  const hasIBARole = user.roleNumbers.some(num => /^[0-9]{6}$/.test(num));

  if (hasIBARole && !user.accessTypes.IBA) {
    // Update to set IBA access
    db.users.updateOne(
      { _id: user._id },
      {
        $set: {
          'accessTypes.IBA': true,
          'mockAccess.duIba': true,
          'mockAccess.bupIba': true,
          updatedAt: new Date()
        }
      }
    );
    print('   ✅ Updated: ' + user.name + ' (' + user.email + ')');
    updated++;
  } else if (hasIBARole && user.accessTypes.IBA) {
    print('   ℹ️  Already correct: ' + user.name);
    alreadyCorrect++;
  }
});

print('\n' + '='.repeat(50));
print('📊 SUMMARY');
print('='.repeat(50));
print('Updated: ' + updated + ' students');
print('Already correct: ' + alreadyCorrect + ' students');
print('\n✨ Done!\n');
