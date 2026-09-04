const { createClient } = require('@libsql/client');
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

// Load env
const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && !k.startsWith('#')) process.env[k] = v.join('=');
});

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY in .env.local');

const resend = new Resend(process.env.RESEND_API_KEY);

const html = fs.readFileSync(path.join(__dirname, 'email-preview.html'), 'utf8');

async function main() {
  const priority = [
    '9nipassist@gmail.com',
    'baroerriorwe@gmail.com',
    'nazahmaryum11@gmail.com',
    'raisashahreen53@gmail.com',
    'raisaislam88147@gmail.com',
    'islamramia17@gmail.com',
    'samiha.ibnaat.raya@gmail.com',
    'taiefariyan53@gmail.com',
    'wakifr2025@gmail.com',
    'warisa.jamil26@gmail.com',
    'saminyasarprokrity@gmail.com',
    'nawarnafeesah@gmail.com',
    'mahjabinrozaa24@gmail.com',
  ];
  const res = await db.execute(`SELECT email, name FROM users WHERE email IN (${priority.map(()=>'?').join(',')})`, priority);
  const recipients = res.rows;

  console.log(`\nSending to ${recipients.length} recipients...\n`);

  for (const { email, name } of recipients) {
    try {
      await resend.emails.send({
        from: 'Ahnaf <ahnaf@vh-beyondthehorizons.org>',
        to: email,
        subject: 'IBA/BUP Admission Course 2026–27 — Orientation This Wednesday',
        html,
      });
      console.log(`✓ ${name || email} — ${email}`);
    } catch (err) {
      console.error(`✗ ${email} — ${err.message}`);
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\nDone.');
}

main().catch(console.error);
