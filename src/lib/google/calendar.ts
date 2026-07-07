/**
 * Google Calendar client — Algorithm F from the LMS plan.
 *
 * IMPORTANT: This is a separate host-only OAuth flow.
 * It MUST NOT touch src/lib/auth.ts or the NextAuth GoogleProvider.
 * Calendar scope never enters the student login flow.
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from '@/lib/db';
import { googleCredentials } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ─── Build OAuth2 client ────────────────────────────────────────────────────

function buildOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
  );
}

// ─── getHostClient ──────────────────────────────────────────────────────────

/**
 * Load the single google_credentials row (at most one host).
 * If multiple rows exist (invariant violation), picks the latest updatedAt.
 * If expiresAt < now+60s: refresh the token and persist the new one.
 *
 * Returns null when no credentials row exists (calendar features disabled).
 */
export async function getHostClient(): Promise<OAuth2Client | null> {
  // Load the row with the latest updatedAt
  const rows = await db
    .select()
    .from(googleCredentials)
    .orderBy(desc(googleCredentials.updatedAt))
    .limit(1);

  if (rows.length === 0) return null;

  const cred = rows[0];
  const oauth2 = buildOAuth2Client();

  oauth2.setCredentials({
    access_token:  cred.accessToken,
    refresh_token: cred.refreshToken,
    expiry_date:   cred.expiresAt.getTime(),
  });

  // Refresh if token expires within 60 seconds
  const now = Date.now();
  if (cred.expiresAt.getTime() < now + 60_000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();

      const newAccessToken = credentials.access_token ?? cred.accessToken;
      const newExpiresAt   = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(now + 3600_000); // default 1h if not returned

      // Persist updated token
      await db
        .update(googleCredentials)
        .set({
          accessToken: newAccessToken,
          expiresAt:   newExpiresAt,
          updatedAt:   new Date(),
        })
        .where(eq(googleCredentials.id, cred.id));

      // Update the in-memory client
      oauth2.setCredentials({
        access_token:  newAccessToken,
        refresh_token: credentials.refresh_token ?? cred.refreshToken,
        expiry_date:   newExpiresAt.getTime(),
      });
    } catch (err) {
      console.error('[Google Calendar] Token refresh failed:', err);
      // Return the client anyway (may still work if expiry is a few seconds off)
    }
  }

  return oauth2;
}

// ─── createMeetEvent ─────────────────────────────────────────────────────────

export interface MeetEventInput {
  title:           string;
  description?:    string;
  startISO:        string;
  endISO:          string;
  attendeeEmails?: string[];
}

export interface MeetEventResult {
  meetLink:  string;
  eventId:   string;
}

/**
 * Insert a Google Calendar event with a Meet conference.
 * Returns { meetLink, eventId } on success, null if no host client.
 * Throws plain Error on API failure (caller should catch and convert to ApiException).
 */
export async function createMeetEvent(
  input: MeetEventInput,
): Promise<MeetEventResult | null> {
  const client = await getHostClient();
  if (!client) return null;

  const calendar = google.calendar({ version: 'v3', auth: client });

  const res = await calendar.events.insert({
    calendarId:             'primary',
    conferenceDataVersion:  1,
    sendUpdates:            'all',
    requestBody: {
      summary:     input.title,
      description: input.description,
      start: { dateTime: input.startISO, timeZone: 'Asia/Dhaka' },
      end:   { dateTime: input.endISO,   timeZone: 'Asia/Dhaka' },
      attendees: (input.attendeeEmails ?? []).map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId:            randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const event = res.data;
  const meetLink = event.hangoutLink;
  const eventId  = event.id;

  if (!meetLink || !eventId) {
    throw new Error('Google Calendar did not return a Meet link or event id');
  }

  return { meetLink, eventId };
}

// ─── updateMeetEvent ─────────────────────────────────────────────────────────

export interface MeetEventPatch {
  title?:           string;
  description?:     string;
  startISO?:        string;
  endISO?:          string;
  attendeeEmails?:  string[];
}

/**
 * Patch an existing Calendar event (PATCH semantics — only provided fields updated).
 * Throws plain Error on API failure.
 */
export async function updateMeetEvent(
  eventId: string,
  patch:   MeetEventPatch,
): Promise<void> {
  const client = await getHostClient();
  if (!client) return;

  const calendar = google.calendar({ version: 'v3', auth: client });

  const requestBody: Record<string, unknown> = {};
  if (patch.title       !== undefined) requestBody.summary     = patch.title;
  if (patch.description !== undefined) requestBody.description = patch.description;
  if (patch.startISO    !== undefined) requestBody.start = { dateTime: patch.startISO, timeZone: 'Asia/Dhaka' };
  if (patch.endISO      !== undefined) requestBody.end   = { dateTime: patch.endISO,   timeZone: 'Asia/Dhaka' };
  if (patch.attendeeEmails !== undefined) {
    requestBody.attendees = patch.attendeeEmails.map((email) => ({ email }));
  }

  await calendar.events.patch({
    calendarId:  'primary',
    eventId,
    sendUpdates: 'all',
    requestBody,
  });
}

// ─── deleteMeetEvent ─────────────────────────────────────────────────────────

/**
 * Delete a Calendar event. Best-effort: swallows 404/410 errors silently.
 */
export async function deleteMeetEvent(eventId: string): Promise<void> {
  const client = await getHostClient();
  if (!client) return;

  const calendar = google.calendar({ version: 'v3', auth: client });

  try {
    await calendar.events.delete({
      calendarId:  'primary',
      eventId,
      sendUpdates: 'all',
    });
  } catch (err: unknown) {
    // Swallow 404 (already deleted) and 410 (gone)
    const status = (err as { code?: number })?.code;
    if (status === 404 || status === 410) return;
    throw err;
  }
}

// ─── getAuthUrl ──────────────────────────────────────────────────────────────

/**
 * Generate the Google OAuth URL for the host-connect flow.
 * scope: calendar.events only (NOT profile/email — this is staff-only).
 * state: caller should generate a nonce and store it in a short-lived httpOnly cookie.
 */
export function getAuthUrl(state: string): string {
  const oauth2 = buildOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       ['https://www.googleapis.com/auth/calendar.events'],
    state,
  });
}

// ─── exchangeCode ─────────────────────────────────────────────────────────────

export interface ExchangedTokens {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    Date;
  scope:        string;
}

/**
 * Exchange an authorization code for tokens.
 * Returns the token fields ready to upsert into google_credentials.
 */
export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const oauth2 = buildOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.access_token) {
    throw new Error('No access_token returned from Google');
  }

  return {
    accessToken:  tokens.access_token,
    refreshToken: tokens.refresh_token ?? '',
    expiresAt:    tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
    scope:        tokens.scope ?? 'https://www.googleapis.com/auth/calendar.events',
  };
}
