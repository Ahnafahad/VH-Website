import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const i = trimmed.indexOf('=');
      if (i > 0) process.env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const [total, pos, neg, inapp, nulls] = await Promise.all([
  client.execute('SELECT COUNT(*) as n FROM vocab_words'),
  client.execute("SELECT COUNT(*) as n FROM vocab_words WHERE connotation='positive'"),
  client.execute("SELECT COUNT(*) as n FROM vocab_words WHERE connotation='negative'"),
  client.execute("SELECT COUNT(*) as n FROM vocab_words WHERE connotation='inapplicable'"),
  client.execute('SELECT COUNT(*) as n FROM vocab_words WHERE connotation IS NULL'),
]);
console.log('total words    :', total.rows[0].n);
console.log('positive       :', pos.rows[0].n);
console.log('negative       :', neg.rows[0].n);
console.log('inapplicable   :', inapp.rows[0].n);
console.log('null           :', nulls.rows[0].n);
process.exit(0);
