/**
 * Hybrid Access Control System
 *
 * Admins: Stored in access-control.json (simple, no bootstrap issues)
 * Students: Stored in MongoDB (dynamic management via admin panel)
 */

import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';
import fs from 'fs';
import path from 'path';

// Cache for frequently accessed data (with TTL)
const emailCache: Map<string, { user: any; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute

// Load admins from JSON file
let adminsFromJson: any[] = [];
try {
  const jsonPath = path.join(process.cwd(), 'access-control.json');
  if (fs.existsSync(jsonPath)) {
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    adminsFromJson = jsonData.admins || [];
    console.log(`[Access Control] Loaded ${adminsFromJson.length} admins from JSON`);
  }
} catch (error) {
  console.error('[Access Control] Failed to load admins from JSON:', error);
}

/**
 * Get admin from JSON
 */
function getAdminFromJson(email: string): any | null {
  const normalizedEmail = email.toLowerCase();
  const admin = adminsFromJson.find(admin =>
    admin.email.toLowerCase() === normalizedEmail && admin.active !== false
  );
  return admin || null;
}

/**
 * Clear the cache (useful after user updates)
 */
export function clearAccessControlCache() {
  emailCache.clear();
}

/**
 * Get user from cache, JSON (admins), or database (students)
 */
async function getCachedUser(email: string): Promise<any | null> {
  const normalizedEmail = email.toLowerCase();
  console.log('[getCachedUser] Looking up:', normalizedEmail);

  // Check cache
  const cached = emailCache.get(normalizedEmail);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[getCachedUser] Cache hit for:', normalizedEmail);
    return cached.user;
  }

  // Check JSON for admins first
  const adminFromJson = getAdminFromJson(normalizedEmail);
  if (adminFromJson) {
    console.log('[getCachedUser] Found admin in JSON:', normalizedEmail);
    const adminUser = {
      email: adminFromJson.email,
      name: adminFromJson.name,
      role: adminFromJson.role,
      permissions: adminFromJson.permissions || [],
      active: adminFromJson.active !== false
    };
    emailCache.set(normalizedEmail, { user: adminUser, timestamp: Date.now() });
    return adminUser;
  }

  // If not admin, check database for students
  console.log('[getCachedUser] Not in JSON, checking database for student:', normalizedEmail);
  try {
    await connectToDatabase();
    console.log('[getCachedUser] Database connected');

    const user = await User.findOne({ email: normalizedEmail, active: true }).lean();
    console.log('[getCachedUser] Database query result:', user ? `Found user with role: ${(user as any).role}` : 'No user found');

    // Update cache
    if (user) {
      emailCache.set(normalizedEmail, { user, timestamp: Date.now() });
      console.log('[getCachedUser] User cached');
    }

    return user;
  } catch (error) {
    console.error('[getCachedUser] Database error:', error);
    throw error;
  }
}

/**
 * Check if an email is authorized (admin or student)
 */
export async function isEmailAuthorized(email: string): Promise<boolean> {
  console.log('[isEmailAuthorized] Checking email:', email);
  if (!email) {
    console.log('[isEmailAuthorized] Empty email provided');
    return false;
  }

  try {
    const user = await getCachedUser(email);
    console.log('[isEmailAuthorized] User found:', !!user, user ? `(role: ${user.role})` : '');
    return !!user;
  } catch (error) {
    console.error('[isEmailAuthorized] Error checking email authorization:', error);
    return false;
  }
}

/**
 * Check if an email belongs to an admin
 */
export async function isAdminEmail(email: string): Promise<boolean> {
  console.log('[isAdminEmail] Checking email:', email);
  if (!email) {
    console.log('[isAdminEmail] Empty email provided');
    return false;
  }

  try {
    const user = await getCachedUser(email);
    const isAdmin = user && (user.role === 'super_admin' || user.role === 'admin');
    console.log('[isAdminEmail] User found:', !!user, 'Role:', user?.role, 'Is Admin:', isAdmin);
    return isAdmin;
  } catch (error) {
    console.error('[isAdminEmail] Error checking admin email:', error);
    return false;
  }
}

/**
 * Check if an email belongs to a student
 */
export async function isStudentEmail(email: string): Promise<boolean> {
  if (!email) return false;

  try {
    const user = await getCachedUser(email);
    return user && user.role === 'student';
  } catch (error) {
    console.error('Error checking student email:', error);
    return false;
  }
}

/**
 * Get user information by email
 */
export async function getUserByEmail(email: string): Promise<any | null> {
  if (!email) return null;

  try {
    return await getCachedUser(email);
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

/**
 * Get student by student ID
 */
export async function getStudentById(studentId: string): Promise<any | null> {
  if (!studentId) return null;

  try {
    await connectToDatabase();
    const student = await User.findOne({ studentId, role: 'student', active: true }).lean();
    return student;
  } catch (error) {
    console.error('Error getting student by ID:', error);
    return null;
  }
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(email: string, permission: string): Promise<boolean> {
  try {
    const user = await getCachedUser(email);
    return user ? user.permissions.includes(permission) : false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get all authorized emails (admins from JSON + students from DB)
 */
export async function getAuthorizedEmails(): Promise<string[]> {
  try {
    // Get admins from JSON
    const adminEmails = adminsFromJson
      .filter(admin => admin.active !== false)
      .map(admin => admin.email.toLowerCase());

    // Get students from database
    await connectToDatabase();
    const students = await User.find({ role: 'student', active: true }).select('email').lean();
    const studentEmails = students.map(s => s.email);

    // Combine both
    return [...adminEmails, ...studentEmails];
  } catch (error) {
    console.error('Error getting authorized emails:', error);
    return [];
  }
}

/**
 * Get all admin emails (from JSON)
 */
export async function getAdminEmails(): Promise<string[]> {
  try {
    return adminsFromJson
      .filter(admin => admin.active !== false)
      .map(admin => admin.email.toLowerCase());
  } catch (error) {
    console.error('Error getting admin emails:', error);
    return [];
  }
}

/**
 * Get all student emails
 */
export async function getStudentEmails(): Promise<string[]> {
  try {
    await connectToDatabase();
    const students = await User.find({ role: 'student', active: true }).select('email').lean();
    return students.map(s => s.email);
  } catch (error) {
    console.error('Error getting student emails:', error);
    return [];
  }
}

/**
 * Get access control statistics
 */
export async function getAccessControlStats() {
  try {
    await connectToDatabase();

    const [totalUsers, activeAdmins, activeStudents, superAdmins, regularAdmins] = await Promise.all([
      User.countDocuments({ active: true }),
      User.countDocuments({ role: { $in: ['super_admin', 'admin'] }, active: true }),
      User.countDocuments({ role: 'student', active: true }),
      User.countDocuments({ role: 'super_admin', active: true }),
      User.countDocuments({ role: 'admin', active: true })
    ]);

    return {
      totalUsers,
      activeAdmins,
      activeStudents,
      superAdmins,
      regularAdmins,
      lastUpdated: new Date().toISOString(),
      version: '2.0.0-database',
      source: 'mongodb'
    };
  } catch (error) {
    console.error('Error getting access control stats:', error);
    return {
      totalUsers: 0,
      activeAdmins: 0,
      activeStudents: 0,
      superAdmins: 0,
      regularAdmins: 0,
      lastUpdated: new Date().toISOString(),
      version: '2.0.0-database',
      source: 'mongodb'
    };
  }
}

/**
 * Check if user has access to a specific mock
 */
export async function hasMockAccess(email: string, mockName: string): Promise<boolean> {
  if (!email || !mockName) return false;

  try {
    await connectToDatabase();
    const user = await User.findOne({ email: email.toLowerCase(), active: true });

    if (!user) return false;

    // Admins have access to all mocks
    if (user.role === 'super_admin' || user.role === 'admin') {
      return true;
    }

    // For students, check access types and individual mock access
    const normalizedMockName = mockName.toLowerCase().replace(/[- ]/g, '');
    const mockAccess = user.mockAccess;
    const accessTypes = user.accessTypes;

    switch (normalizedMockName) {
      case 'duiba':
        return mockAccess.duIba || accessTypes.IBA;
      case 'bupiba':
        return mockAccess.bupIba || accessTypes.IBA;
      case 'dufbs':
        return mockAccess.duFbs || accessTypes.FBS;
      case 'bupfbs':
        return mockAccess.bupFbs || accessTypes.FBS;
      case 'fbsdetailed':
        return mockAccess.fbsDetailed;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error checking mock access:', error);
    return false;
  }
}

/**
 * Get computed mock access for a user
 */
export async function getComputedMockAccess(email: string): Promise<any> {
  try {
    await connectToDatabase();
    const user = await User.findOne({ email: email.toLowerCase(), active: true });

    if (!user) {
      return {
        duIba: false,
        bupIba: false,
        duFbs: false,
        bupFbs: false,
        fbsDetailed: false
      };
    }

    // Admins have access to all mocks
    if (user.role === 'super_admin' || user.role === 'admin') {
      return {
        duIba: true,
        bupIba: true,
        duFbs: true,
        bupFbs: true,
        fbsDetailed: true
      };
    }

    // For students, combine access types and individual mock access
    return {
      duIba: user.mockAccess.duIba || user.accessTypes.IBA,
      bupIba: user.mockAccess.bupIba || user.accessTypes.IBA,
      duFbs: user.mockAccess.duFbs || user.accessTypes.FBS,
      bupFbs: user.mockAccess.bupFbs || user.accessTypes.FBS,
      fbsDetailed: user.mockAccess.fbsDetailed
    };
  } catch (error) {
    console.error('Error getting computed mock access:', error);
    return {
      duIba: false,
      bupIba: false,
      duFbs: false,
      bupFbs: false,
      fbsDetailed: false
    };
  }
}
