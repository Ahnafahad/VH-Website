import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle, parseBody } from '@/lib/super/people/route';
import { grantTestTime, grantRecordingToStudent, resetSprintAttempt, resetMarathonAttempt } from '@/lib/super/people/overrides';

const id = z.number().int().positive();
const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('test.reopen'), attemptId: id, minutes: z.number().int().min(5).max(240) }),
  z.object({ action: z.literal('test.extend'), attemptId: id, minutes: z.number().int().min(5).max(240) }),
  z.object({ action: z.literal('recording.grant'), userId: id, recordingId: id, days: z.number().int().min(1).max(90) }),
  z.object({ action: z.literal('sprint.reset'), attemptId: id }),
  z.object({ action: z.literal('marathon.reset'), attemptId: id }),
]);

export async function POST(req: NextRequest) {
  return handle(async actor => {
    const b = await parseBody(req, body);
    switch (b.action) {
      case 'test.reopen': return { result: await grantTestTime(actor, b.attemptId, b.minutes, true) };
      case 'test.extend': return { result: await grantTestTime(actor, b.attemptId, b.minutes, false) };
      case 'recording.grant': return { result: await grantRecordingToStudent(actor, b.userId, b.recordingId, b.days) };
      case 'sprint.reset': await resetSprintAttempt(actor, b.attemptId); return {};
      case 'marathon.reset': await resetMarathonAttempt(actor, b.attemptId); return {};
    }
  });
}
