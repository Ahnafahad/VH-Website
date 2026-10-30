# 1-on-1 session booking — redesign (2026-10-30)

## Why
Students saw "all slots booked": the old model needed an instructor to publish fixed slots, and none ever had (1 cancelled slot in the live DB). Requests carried no times, nobody was notified of them, and any staff member could resolve any request.

## Flow (the user's own five steps)
1. Student requests: subject, topic, length, online / in person / either, plus 1–4 times that suit them.
2. Matching instructors are emailed (instructors tagged for that product; super admins if nobody is tagged).
3. One instructor either **accepts** one of the student's times, or **proposes** up to 4 alternatives — each a specific time or a range the student picks a start from.
4. Student accepts a proposal (or suggests new times, which goes back to the instructor).
5. Once both sides have agreed: online → Google Meet created on the host account; in person → plain calendar event with the location. Student and instructor are both attendees and are emailed.

`status`: pending → proposed ⇄ pending → scheduled | declined | cancelled. Every change is a conditional UPDATE, so two people acting at once can't both win.

## Rules
- Times: ≥ 1 h ahead, ≤ 90 days; max 4 options; session length 15–120 min.
- A student may hold 2 open (pending/proposed) requests.
- Neither the instructor nor the student can be double-booked (overlap check at confirmation).
- A confirmed online session always has a link: if Meet creation fails the request is put back and the user is told.
- Students can cancel > 2 h before start; instructors any time. Cancelling deletes the calendar event and emails the other party.
- Who handles what: `instructor_products` (user ↔ iba/fbs). Super admins handle everything. Seeded by `scripts/apply-booking-redesign.mjs`.

## Not changed
`booking_slots` and its API routes are left in place but no longer used by any screen.
