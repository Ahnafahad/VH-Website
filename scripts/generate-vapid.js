/**
 * Generates VAPID keys for Web Push notifications.
 * Run once and add the output to your .env.local file.
 *
 * Usage:
 *   node scripts/generate-vapid.js
 *
 * Then add the printed values to .env.local:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<printed public key>
 *   VAPID_PRIVATE_KEY=<printed private key>
 */

const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();

console.log('Add these to your .env.local:\n');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
