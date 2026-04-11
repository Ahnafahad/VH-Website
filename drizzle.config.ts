import type { Config } from 'drizzle-kit';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually since drizzle-kit runs outside Next.js
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0) {
          process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });
  }
}

loadEnvLocal();

export default {
  schema:    './src/lib/db/schema.ts',
  out:       './drizzle',
  dialect:   'turso',
  dbCredentials: {
    url:       process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
