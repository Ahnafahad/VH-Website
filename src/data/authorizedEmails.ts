// DEPRECATED: This file is maintained for backward compatibility only
// Please use @/lib/generated-access-control instead for new implementations

import {
  getAdminEmails,
  getStudentEmails,
  getAuthorizedEmails,
  isEmailAuthorized as isEmailAuthorizedNew,
  isAdminEmail as isAdminEmailNew
} from '@/lib/generated-access-control';

// Legacy exports for backward compatibility
// These now pull from the new JSON-based access control system
export const adminEmails = getAdminEmails();
export const studentEmails = getStudentEmails();
export const authorizedEmails = getAuthorizedEmails();

// Legacy functions that delegate to new system
export function isEmailAuthorized(email: string): boolean {
  console.warn('DEPRECATED: Use isEmailAuthorized from @/lib/access-control instead');
  return isEmailAuthorizedNew(email);
}

export function isAdminEmail(email: string): boolean {
  console.warn('DEPRECATED: Use isAdminEmail from @/lib/access-control instead');
  return isAdminEmailNew(email);
}