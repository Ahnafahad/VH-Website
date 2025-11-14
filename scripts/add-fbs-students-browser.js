// Copy and paste this entire code into your browser console
// Make sure you're logged in as admin first!

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

(async function() {
  console.log(`🚀 Starting to process ${students.length} DU FBS students...\n`);

  try {
    const response = await fetch('/api/add-fbs-students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: includes session cookie
      body: JSON.stringify({
        students,
        accessType: 'DU FBS'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', result.error);
      console.error('Status:', response.status);
      return;
    }

    console.log('✅ Success!');
    console.log(`\n📊 Results:`);
    console.log(`   - Migrated: ${result.results.migrated} users`);
    console.log(`   - Updated: ${result.results.updated} existing users`);
    console.log(`   - Created: ${result.results.created} new users`);

    if (result.results.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.results.errors.length}):`);
      result.results.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.email}: ${err.error}`);
      });
    }

    console.log(`\n✨ Total processed: ${students.length} students`);
    console.log('\n📧 Students with placeholder/suspicious emails (review in admin panel):');
    console.log('   - Ramisa Rahman (5074136): 20241110064040@vh.com');
    console.log('   - Shafqat Nur (7842103): 7842103@vh.com');

  } catch (error) {
    console.error('❌ Failed to add students:', error.message);
    console.error('\n💡 Make sure you are logged in as an admin!');
  }
})();
