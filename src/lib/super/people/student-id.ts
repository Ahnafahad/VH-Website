/** Pure student-ID validation for manual reassignment (mirrors the last-5-digits uniqueness rule in assign-student-id.ts). */
import { last5 } from '@/lib/students/assign-student-id';

export function checkStudentId(value: string, others: (string | null)[]): string | null {
  if (!/^\d{5,6}$/.test(value)) return 'Student ID must be 5 or 6 digits';
  if (others.some(o => o === value)) return 'That student ID is already taken';
  const l5 = last5(value);
  if (others.some(o => o && last5(o) === l5)) return 'The last 5 digits collide with another student ID';
  return null;
}
