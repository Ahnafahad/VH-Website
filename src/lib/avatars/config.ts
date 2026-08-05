/**
 * Avatar picker feature flag.
 *
 * The picker is built and ready but must not appear to any student until the
 * user says so ("I will tell when to activate it" — Wave 4 decision #3).
 * Default is OFF: unset, empty, or anything other than the literal string
 * 'true' keeps the popup dormant.
 *
 * To activate: set AVATAR_PICKER_ENABLED=true in the environment (Vercel
 * project env vars + .env.local for local testing) and redeploy/restart.
 * This is a server-only flag (no NEXT_PUBLIC_ prefix) — it is read inside
 * AvatarGate, a server component, so the value never reaches the client
 * bundle and no client code needs to know it exists.
 */
export const AVATAR_PICKER_ENABLED = process.env.AVATAR_PICKER_ENABLED === 'true';
