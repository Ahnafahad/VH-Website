#!/usr/bin/env node

/**
 * Access Control Validator and Manager
 *
 * This script helps validate, manage, and migrate access control data
 * Usage: node scripts/access-control-validator.js [command]
 *
 * Commands:
 *   validate   - Validate the access-control.json file
 *   stats      - Show statistics about users
 *   migrate    - Migrate from CSV to JSON format
 *   add-user   - Add a new user (interactive)
 *   help       - Show this help message
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG_PATH = path.join(process.cwd(), 'access-control.json');
const CSV_PATH = path.join(process.cwd(), 'Accessmain.csv');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Validate access control configuration
 */
function validateConfig() {
  log('\n🔍 Validating access-control.json...', 'cyan');

  if (!fs.existsSync(CONFIG_PATH)) {
    logError('access-control.json not found!');
    return false;
  }

  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configContent);

    // Check required fields
    const requiredFields = ['version', 'admins', 'students', 'settings', 'validation'];
    for (const field of requiredFields) {
      if (!config[field]) {
        logError(`Missing required field: ${field}`);
        return false;
      }
    }

    // Validate structure
    if (!Array.isArray(config.admins)) {
      logError('admins must be an array');
      return false;
    }

    if (!Array.isArray(config.students)) {
      logError('students must be an array');
      return false;
    }

    // Check for duplicate emails
    const allEmails = new Set();
    const duplicateEmails = [];

    [...config.admins, ...config.students].forEach(user => {
      if (user.email) {
        const email = user.email.toLowerCase();
        if (allEmails.has(email)) {
          duplicateEmails.push(email);
        } else {
          allEmails.add(email);
        }
      }
    });

    if (duplicateEmails.length > 0) {
      logError(`Duplicate emails found: ${duplicateEmails.join(', ')}`);
      return false;
    }

    // Check for duplicate student IDs
    const allStudentIds = new Set();
    const duplicateStudentIds = [];

    config.students.forEach(student => {
      if (student.studentId) {
        if (allStudentIds.has(student.studentId)) {
          duplicateStudentIds.push(student.studentId);
        } else {
          allStudentIds.add(student.studentId);
        }
      }
    });

    if (duplicateStudentIds.length > 0) {
      logError(`Duplicate student IDs found: ${duplicateStudentIds.join(', ')}`);
      return false;
    }

    // Validate email formats
    const emailRegex = new RegExp(config.validation.emailRegex);
    const invalidEmails = [];

    [...config.admins, ...config.students].forEach(user => {
      if (user.email && !emailRegex.test(user.email)) {
        invalidEmails.push(user.email);
      }
    });

    if (invalidEmails.length > 0) {
      logError(`Invalid email formats: ${invalidEmails.join(', ')}`);
      return false;
    }

    // Validate student ID formats
    const studentIdRegex = new RegExp(config.validation.studentIdFormat);
    const invalidStudentIds = [];

    config.students.forEach(student => {
      if (student.studentId && !studentIdRegex.test(student.studentId)) {
        invalidStudentIds.push(student.studentId);
      }
    });

    if (invalidStudentIds.length > 0) {
      logError(`Invalid student ID formats: ${invalidStudentIds.join(', ')}`);
      return false;
    }

    logSuccess('Configuration is valid!');
    return true;

  } catch (error) {
    logError(`Validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Show statistics about users
 */
function showStats() {
  log('\n📊 Access Control Statistics', 'cyan');

  if (!fs.existsSync(CONFIG_PATH)) {
    logError('access-control.json not found!');
    return;
  }

  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configContent);

    const activeAdmins = config.admins.filter(admin => admin.active);
    const activeStudents = config.students.filter(student => student.active);
    const inactiveUsers = [...config.admins, ...config.students].filter(user => !user.active);

    console.log(`
${colors.bright}General Statistics:${colors.reset}
  • Total active users: ${activeAdmins.length + activeStudents.length}
  • Active admins: ${activeAdmins.length}
  • Active students: ${activeStudents.length}
  • Inactive users: ${inactiveUsers.length}
  • Configuration version: ${config.version}
  • Last updated: ${config.lastUpdated}

${colors.bright}Admin Breakdown:${colors.reset}
  • Super admins: ${activeAdmins.filter(admin => admin.role === 'super_admin').length}
  • Regular admins: ${activeAdmins.filter(admin => admin.role === 'admin').length}

${colors.bright}Student Classes:${colors.reset}`);

    // Group students by class
    const studentsByClass = {};
    activeStudents.forEach(student => {
      const className = student.class || 'Unknown';
      if (!studentsByClass[className]) {
        studentsByClass[className] = 0;
      }
      studentsByClass[className]++;
    });

    Object.entries(studentsByClass).forEach(([className, count]) => {
      console.log(`  • ${className}: ${count} students`);
    });

  } catch (error) {
    logError(`Failed to show stats: ${error.message}`);
  }
}

/**
 * Migrate from CSV to JSON format
 */
function migrateCsvToJson() {
  log('\n🔄 Migrating from CSV to JSON format...', 'cyan');

  if (!fs.existsSync(CSV_PATH)) {
    logError('Accessmain.csv not found!');
    return;
  }

  if (fs.existsSync(CONFIG_PATH)) {
    logWarning('access-control.json already exists!');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Do you want to overwrite it? (y/N): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y') {
        performMigration();
      } else {
        logInfo('Migration cancelled');
      }
    });
  } else {
    performMigration();
  }
}

function performMigration() {
  try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);

    // Skip header and process data
    const dataLines = lines.slice(1);

    const admins = [];
    const students = [];

    for (const line of dataLines) {
      const [studentId, studentName, studentEmail, , adminName, adminEmail] = line.split(',');

      // Add student if data exists
      if (studentId && studentName && studentEmail) {
        students.push({
          studentId: studentId.trim(),
          name: studentName.trim(),
          email: studentEmail.trim().toLowerCase(),
          role: 'student',
          permissions: ['read'],
          addedDate: new Date().toISOString().split('T')[0],
          active: true,
          class: 'DU-FBS',
          batch: '2025'
        });
      }

      // Add admin if data exists and not already added
      if (adminName && adminEmail) {
        const existingAdmin = admins.find(admin => admin.email === adminEmail.trim().toLowerCase());
        if (!existingAdmin) {
          admins.push({
            id: `admin_${String(admins.length + 1).padStart(3, '0')}`,
            name: adminName.trim(),
            email: adminEmail.trim().toLowerCase(),
            role: admins.length === 0 ? 'super_admin' : 'admin',
            permissions: admins.length === 0 ? ['read', 'write', 'admin', 'manage_users'] : ['read', 'write', 'admin'],
            addedDate: new Date().toISOString().split('T')[0],
            active: true
          });
        }
      }
    }

    const config = {
      "$schema": "https://json-schema.org/draft-07/schema#",
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      description: "Access control configuration for VH Website authentication system",
      admins,
      students,
      settings: {
        requireEmailVerification: true,
        allowSelfRegistration: false,
        sessionTimeout: 86400,
        maxFailedAttempts: 5,
        autoDeactivateAfterDays: 365
      },
      validation: {
        emailRegex: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        studentIdFormat: "^[0-9]{6}$",
        allowedEmailDomains: ["gmail.com", "outlook.com", "yahoo.com"],
        requiredFields: ["email", "name", "role"]
      }
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    logSuccess(`Migration completed! Added ${admins.length} admins and ${students.length} students`);

  } catch (error) {
    logError(`Migration failed: ${error.message}`);
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${colors.bright}Access Control Validator and Manager${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node scripts/access-control-validator.js [command]

${colors.cyan}Commands:${colors.reset}
  ${colors.green}validate${colors.reset}   - Validate the access-control.json file
  ${colors.green}stats${colors.reset}      - Show statistics about users
  ${colors.green}migrate${colors.reset}    - Migrate from CSV to JSON format
  ${colors.green}help${colors.reset}       - Show this help message

${colors.cyan}Examples:${colors.reset}
  node scripts/access-control-validator.js validate
  node scripts/access-control-validator.js stats
  node scripts/access-control-validator.js migrate
`);
}

// Main execution
function main() {
  const command = process.argv[2];

  switch (command) {
    case 'validate':
      validateConfig();
      break;
    case 'stats':
      showStats();
      break;
    case 'migrate':
      migrateCsvToJson();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      if (command) {
        logError(`Unknown command: ${command}`);
      }
      showHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateConfig,
  showStats,
  migrateCsvToJson
};