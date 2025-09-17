#!/usr/bin/env node

/**
 * Build-time Access Control Generator
 *
 * This script reads the access-control.json file and generates a TypeScript file
 * with static data to avoid runtime file system operations in API routes.
 */

const fs = require('fs');
const path = require('path');

function generateAccessControl() {
  console.log('🔧 Generating access control TypeScript from JSON...');

  const configPath = path.join(process.cwd(), 'access-control.json');
  const outputPath = path.join(process.cwd(), 'src', 'lib', 'generated-access-control.ts');

  // Check if config file exists
  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: access-control.json not found in project root');
    process.exit(1);
  }

  try {
    // Read and parse JSON
    const jsonContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(jsonContent);

    // Validate basic structure
    if (!config.admins || !config.students || !Array.isArray(config.admins) || !Array.isArray(config.students)) {
      console.error('❌ Error: Invalid access-control.json structure');
      process.exit(1);
    }

    // Extract active users
    const activeAdmins = config.admins.filter(admin => admin.active !== false);
    const activeStudents = config.students.filter(student => student.active !== false);

    // Generate email arrays
    const adminEmails = activeAdmins.map(admin => admin.email.toLowerCase());
    const studentEmails = activeStudents.map(student => student.email.toLowerCase());
    const allEmails = [...adminEmails, ...studentEmails];

    // Create TypeScript content
    const tsContent = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from access-control.json at build time
// To modify access control, edit access-control.json and run: npm run generate:access-control

export interface GeneratedAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin';
  permissions: string[];
  addedDate: string;
  active: boolean;
}

export interface GeneratedStudentUser {
  studentId: string;
  name: string;
  email: string;
  role: 'student';
  permissions: string[];
  addedDate: string;
  active: boolean;
  class?: string;
  batch?: string;
}

export type GeneratedUser = GeneratedAdminUser | GeneratedStudentUser;

// Full configuration data
export const ACCESS_CONTROL_DATA = ${JSON.stringify(config, null, 2)} as const;

// Pre-computed email arrays for fast lookup
export const adminEmails: readonly string[] = ${JSON.stringify(adminEmails, null, 2)} as const;

export const studentEmails: readonly string[] = ${JSON.stringify(studentEmails, null, 2)} as const;

export const authorizedEmails: readonly string[] = ${JSON.stringify(allEmails, null, 2)} as const;

// User lookup maps for O(1) performance
const adminEmailSet = new Set(adminEmails);
const studentEmailSet = new Set(studentEmails);
const authorizedEmailSet = new Set(authorizedEmails);

// Admin data map
const adminDataMap = new Map<string, GeneratedAdminUser>(
  ${JSON.stringify(activeAdmins)}.map((admin: any) => [admin.email.toLowerCase(), admin as GeneratedAdminUser])
);

// Student data map
const studentDataMap = new Map<string, GeneratedStudentUser>(
  ${JSON.stringify(activeStudents)}.map((student: any) => [student.email.toLowerCase(), student as GeneratedStudentUser])
);

/**
 * Check if an email is authorized (admin or student)
 */
export function isEmailAuthorized(email: string): boolean {
  if (!email) return false;
  return authorizedEmailSet.has(email.toLowerCase());
}

/**
 * Check if an email belongs to an admin
 */
export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  return adminEmailSet.has(email.toLowerCase());
}

/**
 * Check if an email belongs to a student
 */
export function isStudentEmail(email: string): boolean {
  if (!email) return false;
  return studentEmailSet.has(email.toLowerCase());
}

/**
 * Get user information by email
 */
export function getUserByEmail(email: string): GeneratedUser | null {
  if (!email) return null;

  const normalizedEmail = email.toLowerCase();

  // Check admins first
  const admin = adminDataMap.get(normalizedEmail);
  if (admin) return admin;

  // Check students
  const student = studentDataMap.get(normalizedEmail);
  if (student) return student;

  return null;
}

/**
 * Get student by student ID
 */
export function getStudentById(studentId: string): GeneratedStudentUser | null {
  if (!studentId) return null;

  for (const student of studentDataMap.values()) {
    if (student.studentId === studentId) {
      return student;
    }
  }

  return null;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(email: string, permission: string): boolean {
  const user = getUserByEmail(email);
  return user ? user.permissions.includes(permission) : false;
}

/**
 * Get all authorized emails (backward compatibility)
 */
export function getAuthorizedEmails(): string[] {
  return [...authorizedEmails];
}

/**
 * Get all admin emails (backward compatibility)
 */
export function getAdminEmails(): string[] {
  return [...adminEmails];
}

/**
 * Get all student emails (backward compatibility)
 */
export function getStudentEmails(): string[] {
  return [...studentEmails];
}

/**
 * Get access control statistics
 */
export function getAccessControlStats() {
  return {
    totalUsers: authorizedEmails.length,
    activeAdmins: adminEmails.length,
    activeStudents: studentEmails.length,
    superAdmins: ${JSON.stringify(activeAdmins.filter(admin => admin.role === 'super_admin').length)},
    regularAdmins: ${JSON.stringify(activeAdmins.filter(admin => admin.role === 'admin').length)},
    lastUpdated: '${config.lastUpdated || new Date().toISOString()}',
    version: '${config.version || '1.0.0'}',
    generatedAt: '${new Date().toISOString()}'
  };
}

// Export stats for immediate access
export const STATS = getAccessControlStats();

console.log('✅ Generated access control loaded:', STATS);
`;

    // Write the generated TypeScript file
    fs.writeFileSync(outputPath, tsContent, 'utf-8');

    console.log('✅ Successfully generated TypeScript access control file');
    console.log(`📊 Stats: ${activeAdmins.length} admins, ${activeStudents.length} students, ${allEmails.length} total users`);
    console.log(`📝 Output: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error generating access control:', error.message);
    process.exit(1);
  }
}

// Run the generator
if (require.main === module) {
  generateAccessControl();
}

module.exports = { generateAccessControl };