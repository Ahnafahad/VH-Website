# Database-Based Access Control System

## Overview

This document describes the new database-based access control system that replaces the previous JSON-based approach. The new system provides comprehensive user management with fine-grained access control for mock tests.

## Migration from JSON to Database

### Previous System
- Users stored in `access-control.json`
- Build-time generation of TypeScript file (`generated-access-control.ts`)
- Manual JSON editing for user management
- No mock-specific access control

### New System
- Users stored in MongoDB database
- Real-time access control via database queries
- Admin UI for user management
- Granular access control with access types and individual mock permissions

## Database Schema

### User Model (`/src/lib/models/User.ts`)

```typescript
{
  // Basic Information
  email: string (unique, required, indexed)
  name: string (required)
  role: 'super_admin' | 'admin' | 'student'

  // Role-Specific IDs
  adminId?: string (unique for admins)
  studentId?: string (unique for students, 6 digits)

  // Student Information
  class?: string
  batch?: string

  // Access Types (Broad Categories)
  accessTypes: {
    IBA: boolean    // Auto grants: DU IBA Mocks, BUP IBA Mocks
    DU: boolean     // Auto grants: DU IBA Mocks, DU FBS Mocks
    FBS: boolean    // Auto grants: DU FBS Mocks, BUP FBS Mocks
  }

  // Individual Mock Access (Fine-Grained Control)
  mockAccess: {
    duIba: boolean
    bupIba: boolean
    duFbs: boolean
    bupFbs: boolean
    fbsDetailed: boolean
  }

  // Permissions & Status
  permissions: string[]  // ['read', 'write', 'admin', 'manage_users']
  active: boolean

  // Metadata
  addedDate: Date
  createdAt: Date
  updatedAt: Date
}
```

## Access Control Logic

### Access Types
Access types provide automatic access to groups of mocks:

1. **IBA** - Grants access to:
   - DU IBA Mocks
   - BUP IBA Mocks

2. **DU** - Grants access to:
   - DU IBA Mocks
   - DU FBS Mocks

3. **FBS** - Grants access to:
   - DU FBS Mocks
   - BUP FBS Mocks

### Computed Access
The final access for any mock is computed as:
```
hasAccess = mockAccess[specific] OR accessType[category]
```

For example, a user has access to DU IBA Mocks if:
- `mockAccess.duIba === true` OR
- `accessTypes.IBA === true` OR
- `accessTypes.DU === true`

Admins (super_admin and admin roles) have access to all mocks automatically.

## API Endpoints

### `/api/admin/users`

#### GET - List all users
Query parameters:
- `role`: Filter by role (super_admin, admin, student)
- `active`: Filter by active status (true/false)
- `search`: Search in name, email, studentId

#### POST - Create a new user
Request body:
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "role": "student",
  "studentId": "123456",
  "class": "DU-FBS",
  "batch": "2025",
  "accessTypes": {
    "IBA": false,
    "DU": true,
    "FBS": true
  },
  "mockAccess": {
    "duIba": false,
    "bupIba": false,
    "duFbs": false,
    "bupFbs": false,
    "fbsDetailed": false
  },
  "permissions": ["read"],
  "active": true
}
```

#### PATCH - Update a user
Request body:
```json
{
  "userId": "user_mongodb_id",
  "email": "newemail@example.com",
  "accessTypes": {
    "IBA": true
  }
  // ... other fields to update
}
```

#### DELETE - Delete a user
Query parameters:
- `userId`: MongoDB ID of user to delete

Note: Only super admins can delete users, and super admin accounts cannot be deleted.

## Admin Interface

### User Management Page (`/app/admin/users`)

The new admin interface provides:

1. **User List** - View all users with filtering and search
2. **User Statistics** - Total users, admins, students, active users
3. **Add User** - Create new users with all access controls
4. **Edit User** - Modify user details, email, access types, and permissions
5. **Delete User** - Remove users (super admins only)

### Features

- **Search** - Filter users by name, email, or student ID
- **Role Filter** - Show only admins or students
- **Access Type Checkboxes** - Easy visual control of IBA, DU, FBS access
- **Individual Mock Access** - Fine-grained control for future use
- **Permission Management** - Assign read, write, admin, manage_users permissions
- **Status Toggle** - Activate or deactivate user accounts

## Authentication Updates

### Updated Files

1. `/src/lib/auth.ts` - Now uses database-based access control
2. `/src/lib/db-access-control.ts` - New database access control utilities
3. `/src/app/api/admin/users/route.ts` - User management API

### Functions Available

```typescript
// Check authorization
isEmailAuthorized(email: string): Promise<boolean>
isAdminEmail(email: string): Promise<boolean>
isStudentEmail(email: string): Promise<boolean>

// Get user data
getUserByEmail(email: string): Promise<User | null>
getStudentById(studentId: string): Promise<User | null>

// Check permissions
hasPermission(email: string, permission: string): Promise<boolean>
hasMockAccess(email: string, mockName: string): Promise<boolean>

// Get computed access
getComputedMockAccess(email: string): Promise<MockAccess>

// Get lists
getAuthorizedEmails(): Promise<string[]>
getAdminEmails(): Promise<string[]>
getStudentEmails(): Promise<string[]>

// Statistics
getAccessControlStats(): Promise<Stats>

// Cache management
clearAccessControlCache(): void
```

## Migration Process

### One-Time Migration

To migrate existing users from `access-control.json` to MongoDB:

1. Ensure MongoDB is running and `MONGODB_URI` is set in `.env.local`
2. Run the migration script:
   ```bash
   npm run migrate:users
   ```

The migration script will:
- Read all users from `access-control.json`
- Create corresponding database entries
- Infer access types from class field (e.g., "DU-FBS" → DU=true, FBS=true)
- Skip users that already exist in database
- Provide detailed migration summary

### Important Notes

- Keep `access-control.json` as backup until migration is verified
- The migration is idempotent (safe to run multiple times)
- Existing users won't be duplicated
- Super admin accounts are preserved

## Performance

### Caching
The system implements a 1-minute cache for user data to reduce database queries:
- Email lookups are cached
- Cache is automatically cleared on user updates
- Manual cache clear available via `clearAccessControlCache()`

### Database Indexes
Optimized indexes for fast queries:
- Email (unique, indexed)
- Student ID (sparse, unique, indexed)
- Admin ID (sparse, unique, indexed)
- Role + Active (compound index)

## Security

### Access Control Levels

1. **Super Admin**
   - Full access to all features
   - Can delete users
   - Can modify any user

2. **Admin**
   - Can view and edit users
   - Cannot delete users
   - Cannot modify super admins

3. **Student**
   - Limited to mock access based on permissions
   - Cannot access admin features

### Authentication Flow

1. User signs in with Google OAuth
2. Email checked against database (via `isEmailAuthorized`)
3. Session enhanced with user data, role, and permissions
4. JWT token includes access types and mock access
5. Subsequent requests use cached/token data

## Future Enhancements

### Planned Features

1. **Mock-Specific Access Enforcement**
   - Currently, individual mock access is stored but not enforced
   - Future: Block access to mocks based on user permissions

2. **Bulk User Import**
   - CSV/Excel upload for batch user creation
   - Template download for easier data entry

3. **Access History**
   - Track when users access specific mocks
   - Generate usage reports

4. **Expiring Access**
   - Time-limited access to mocks
   - Automatic deactivation after expiry

5. **User Groups**
   - Create groups for batch permission management
   - Assign access types to groups

## Troubleshooting

### Common Issues

**Issue**: Users can't log in after migration
- **Solution**: Ensure migration completed successfully, check database connection

**Issue**: Admin page doesn't load users
- **Solution**: Verify API route `/api/admin/users` is accessible, check MongoDB connection

**Issue**: Changes not reflected immediately
- **Solution**: Cache might be active, wait 1 minute or clear cache programmatically

**Issue**: Migration fails
- **Solution**: Check MONGODB_URI is set correctly, ensure MongoDB is accessible

## Development

### Adding New Mock Types

1. Update User model schema in `/src/lib/models/User.ts`
2. Add new field to `mockAccess` interface
3. Update access control logic in `/src/lib/db-access-control.ts`
4. Add checkbox to admin UI in `/src/app/admin/users/page.tsx`
5. Update documentation

### Testing Access Control

```typescript
// Test user access
const hasAccess = await hasMockAccess('user@example.com', 'du-iba');

// Test computed access
const access = await getComputedMockAccess('user@example.com');
// Returns: { duIba: true, bupIba: false, ... }
```

## Support

For issues or questions:
1. Check this documentation
2. Review migration logs
3. Check MongoDB connection
4. Verify environment variables
5. Contact system administrator
