import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN. Run with: node --env-file=.env.local <script>');
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// CSV data from iba bup 2026 (1).csv
const csvStudents = [
  { sl: 1,  name: 'warisa jamil',          contact: '01670872602', email: 'warisa.jamil26@gmail.com',          amount: '7000' },
  { sl: 2,  name: 'mutasim billah bishal', contact: '01886909889', email: 'mutasimbillahbishal@gmail.com',      amount: '7000' },
  { sl: 3,  name: 'mehka tarannum',        contact: '01771940940', email: 'mehekatarannum@gmail.com',           amount: '7000' },
  { sl: 4,  name: 'akhter nihal khan',     contact: '01993402114', email: 'nihalkhan93811@gmail.com',           amount: '7000' },
  { sl: 5,  name: 'mohammed ali ayaaz',    contact: '01315292206', email: 'ayaaz3006@gmail.com',                amount: '7000' },
  { sl: 6,  name: 'tashfia ferdousi',      contact: '01805416666', email: 'tbashfia2006@gmail.com',             amount: '7000' },
  { sl: 7,  name: 'ramisa rahman',         contact: '01810156304', email: 'ramisarahman644@gmail.com',          amount: '7000' },
  { sl: 8,  name: 'ishtiana dilruba',      contact: '01729252213', email: 'ishtiana.dilruba@gmail.com',         amount: '15500' },
  { sl: 9,  name: 'sehereen rahman hridita', contact: '01836449399', email: 'riditaishere@gmail.com',           amount: '7000' },
  { sl: 10, name: 'preyanti shahrin nidhi', contact: '01701672108', email: 'preyantishahrin@gmail.com',         amount: '7000' },
  { sl: 11, name: 'mahjabin roza',         contact: '01552381910', email: 'mahajabinrozaa24@gmail.com',         amount: '7000' },
  { sl: 12, name: 'muskan khan',           contact: '01738297731', email: null,                                  amount: '7000' },
  { sl: 13, name: 'mohammad ali hassan',   contact: '01715105050', email: 'alihassan05feb@gmail.com',           amount: '7000' },
  { sl: 14, name: 'nafisa nawar',          contact: '01785776705', email: 'nowarnafeesh@gmail.com',             amount: '7000' },
  { sl: 15, name: 'ninova islam',          contact: '01987792502', email: 'ninova.islam@gmail.com',             amount: '7000' },
  { sl: 16, name: 'samiha haque tasheem', contact: '01878352431', email: 'samihahaquetasneem@gmail.com',       amount: '7000' },
  { sl: 17, name: 'fabiha bushra hasan',  contact: '01788735698', email: 'fabihabushraha@gmail.com',           amount: '7000' },
  { sl: 18, name: 'samin yasar prokrity', contact: '01604517270', email: 'saminyasarprkrity@gmail.com',        amount: '7000' },
  { sl: 19, name: 'zareef hasan',         contact: '01850666153', email: 'zareefhasan123@gmail.com',           amount: '7000' },
  { sl: 20, name: 'samiha islam seen',    contact: '01331309182', email: 'samihaseen45@gmail.com',             amount: '7000' },
  { sl: 21, name: 'rahat hasan nehal',    contact: '01771429648', email: 'rahathasan13573@gmail.com',          amount: '7000', note: 'typo in CSV: rahathasan13573@gmail/com' },
  { sl: 22, name: 'mashit aiman',         contact: '01305109369', email: 'mashiat.ayman062@gmail.com',         amount: '7000', note: 'typo in CSV: mashiat.ayman062gmail.com' },
  { sl: 23, name: 'tasnim bin salam',     contact: '01742443449', email: 'tasnimbinsalam82@gmail.com',         amount: '7000', note: 'typo in CSV: tasnimbinsalam82gmail.com' },
  { sl: 24, name: 'tunazzina tawhid',     contact: '01765550927', email: 'tunti368@gmail.com',                 amount: '5000' },
  { sl: 25, name: 'ramia islam',          contact: '01741900367', email: 'islamramia17@gmail.com',             amount: 'hasan bhai' },
  { sl: 26, name: 'faraz ahmed',          contact: '01316110023', email: 'fzahmed2006@gmail.com',              amount: 'hasan bhai' },
  { sl: 27, name: 'jannatul ferdoush khan', contact: '01346030703', email: 'info.strowberryshortcake@gmail.com', amount: '7000' },
  { sl: 28, name: 'siad ahmed',           contact: '01617790588', email: 'siadahmed0069@gmail.com',            amount: '15500' },
  { sl: 29, name: 'saima tasnim sayed',   contact: '01616763686', email: 'saimaa.sayeed20@gmail.com',          amount: '7000' },
  { sl: 30, name: 'jumanah mariyam raida', contact: '17684046345', email: 'rcmariyam@gmail.com',               amount: '7000' },
];

// Get all users from DB
const result = await client.execute('SELECT id, email, name, whatsapp FROM users ORDER BY name');
const dbUsers = result.rows;

console.log(`\n=== DB has ${dbUsers.length} users ===\n`);
console.log('Checking IBA BUP 2026 CSV students against DB...\n');

const found = [];
const notFound = [];

for (const student of csvStudents) {
  const csvEmail = student.email?.toLowerCase().trim();
  const csvName = student.name.toLowerCase().trim();

  // Try exact email match first
  let match = null;
  if (csvEmail) {
    match = dbUsers.find(u => u.email?.toLowerCase() === csvEmail);
  }

  // If no match, try name-based fuzzy match
  let nameSuggestions = [];
  if (!match) {
    // Find DB users whose name words overlap with CSV name
    const csvWords = csvName.split(' ').filter(w => w.length > 3);
    nameSuggestions = dbUsers.filter(u => {
      const dbName = u.name?.toLowerCase() || '';
      return csvWords.some(w => dbName.includes(w));
    });
  }

  if (match) {
    found.push({ student, dbUser: match, matchType: 'email' });
  } else {
    notFound.push({ student, nameSuggestions });
  }
}

console.log(`✅ FOUND IN DB (${found.length}):`);
for (const { student, dbUser } of found) {
  const emailMatch = student.email?.toLowerCase() === dbUser.email?.toLowerCase();
  console.log(`  #${student.sl} ${student.name}`);
  console.log(`    CSV email:  ${student.email}`);
  console.log(`    DB email:   ${dbUser.email}  (id=${dbUser.id})`);
  if (!emailMatch) console.log(`    ⚠️  EMAIL MISMATCH`);
  console.log();
}

console.log(`\n❌ NOT FOUND BY EMAIL (${notFound.length}):`);
for (const { student, nameSuggestions } of notFound) {
  console.log(`  #${student.sl} ${student.name}`);
  console.log(`    CSV email:  ${student.email ?? '(no email)'}`);
  if (student.note) console.log(`    Note:       ${student.note}`);
  if (nameSuggestions.length > 0) {
    console.log(`    Name matches in DB:`);
    for (const s of nameSuggestions) {
      console.log(`      → id=${s.id}  name="${s.name}"  email="${s.email}"`);
    }
  } else {
    console.log(`    No name match found in DB either`);
  }
  console.log();
}
