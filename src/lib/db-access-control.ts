/**
 * Database-based Access Control
 *
 * This module provides access control functions using MongoDB instead of JSON files.
 * It replaces the old generated-access-control.ts with database-backed functionality.
 */

import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';

// Cache for frequently accessed data (with TTL)
const emailCache: Map<string, { user: any; timestamp: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Clear the cache (useful after user updates)
 */
export function clearAccessControlCache() {
  emailCache.clear();
}

/**
 * Get user from cache or database
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

  // Fetch from database
  console.log('[getCachedUser] Cache miss, querying database for:', normalizedEmail);
  try {
    await connectToDatabase();
    console.log('[getCachedUser] Database connected');

    const user = await User.findOne({ email: normalizedEmail, active: true }).lean();
    console.log('[getCachedUser] Database query result:', user ? `Found user with role: ${user.role}` : 'No user found');

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
 * Get all authorized emails
 */
export async function getAuthorizedEmails(): Promise<string[]> {
  try {
    await connectToDatabase();
    const users = await User.find({ active: true }).select('email').lean();
    return users.map(u => u.email);
  } catch (error) {
    console.error('Error getting authorized emails:', error);
    return [];
  }
}

/**
 * Get all admin emails
 */
export async function getAdminEmails(): Promise<string[]> {
  try {
    await connectToDatabase();
    const admins = await User.find({
      role: { $in: ['super_admin', 'admin'] },
      active: true
    }).select('email').lean();
    return admins.map(a => a.email);
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
        return mockAccess.duIba || accessTypes.IBA || accessTypes.DU;
      case 'bupiba':
        return mockAccess.bupIba || accessTypes.IBA;
      case 'dufbs':
        return mockAccess.duFbs || accessTypes.FBS || accessTypes.DU;
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
      duIba: user.mockAccess.duIba || user.accessTypes.IBA || user.accessTypes.DU,
      bupIba: user.mockAccess.bupIba || user.accessTypes.IBA,
      duFbs: user.mockAccess.duFbs || user.accessTypes.FBS || user.accessTypes.DU,
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
