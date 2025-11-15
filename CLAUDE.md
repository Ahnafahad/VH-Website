# CLAUDE.md - AI Assistant Developer Guide

> **Version**: 1.0.0
> **Last Updated**: 2025-11-15
> **Purpose**: Comprehensive guide for AI assistants working on the VH Website codebase

This document provides AI assistants with essential context about the VH Website project structure, development patterns, and conventions to follow when making changes.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Repository Structure](#repository-structure)
4. [Development Workflow](#development-workflow)
5. [Key Conventions](#key-conventions)
6. [Authentication & Access Control](#authentication--access-control)
7. [Database Patterns](#database-patterns)
8. [API Patterns](#api-patterns)
9. [Frontend Patterns](#frontend-patterns)
10. [Testing & Quality](#testing--quality)
11. [Deployment](#deployment)
12. [Common Tasks](#common-tasks)
13. [Troubleshooting](#troubleshooting)

---

## Project Overview

**VH Beyond the Horizons** is a comprehensive Next.js educational platform designed for university admission preparation in Bangladesh. The platform features:

- **AI-powered educational games** (Vocabulary Quiz, Mental Math Trainer)
- **University admission tools** (Eligibility Checker for IBA, BUP, DU, BUET)
- **Secure authentication** with role-based access control
- **Performance tracking** with leaderboards and analytics
- **Course registration system** with email notifications

### Key Statistics
- **26 Total Users**: 2 admins, 24 students
- **Success Rate**: 46.7% (14/30 students in IBA admissions)
- **10 Vocabulary Sections**: 1000+ words
- **4 Math Difficulty Levels**: Easy to extreme
- **5 Universities Supported**: IBA, BUP, DU Science, DU FBS, BUET

---

## Tech Stack

### Core Framework
- **Next.js 15.4.6** - React framework with App Router
- **TypeScript 5.9.3** - Type-safe JavaScript
- **React 19.1.0** - UI library

### Styling
- **Tailwind CSS v4** - Utility-first CSS framework
- **Custom VH Brand Colors** - Defined in `globals.css`
- **Geist Font Family** - Modern sans-serif and mono fonts

### Authentication & Database
- **NextAuth.js 4.24.11** - Authentication for Next.js
- **Google OAuth** - Primary authentication provider
- **MongoDB** - Primary database (via MongoDB Atlas)
- **Mongoose 8.18.1** - MongoDB ODM

### AI & Services
- **Google Gemini API** - AI-powered question generation
- **EmailJS** - Client-side email service
- **Resend** - Server-side email notifications
- **Vercel Analytics** - Usage analytics

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Turbopack** - Fast bundler (dev mode)

---

## Repository Structure

```
/home/user/VH-Website/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── api/                      # API routes
│   │   │   ├── auth/                 # Authentication endpoints
│   │   │   │   ├── [...nextauth]/   # NextAuth handler
│   │   │   │   └── check-admin/     # Admin verification
│   │   │   ├── admin/                # Admin-only endpoints
│   │   │   │   ├── users/           # User management
│   │   │   │   ├── students/        # Student management
│   │   │   │   └── grant-access/    # Access control
│   │   │   ├── vocab-quiz/          # Vocabulary quiz API
│   │   │   │   ├── scores/          # Score submission
│   │   │   │   └── leaderboard/     # Leaderboard data
│   │   │   ├── mental-math/         # Mental math API
│   │   │   │   ├── scores/          # Score submission
│   │   │   │   └── leaderboard/     # Leaderboard data
│   │   │   ├── registrations/       # Course registration
│   │   │   ├── generate-questions/  # AI question generation
│   │   │   ├── health/              # Health check
│   │   │   └── user/access/         # User access info
│   │   ├── games/                    # Protected game pages
│   │   │   ├── vocab-quiz/          # Vocabulary quiz game
│   │   │   └── mental-math/         # Mental math trainer
│   │   ├── admin/                    # Admin dashboard pages
│   │   │   ├── users/               # User management UI
│   │   │   └── registrations/       # Registration management
│   │   ├── auth/                     # Authentication pages
│   │   │   ├── signin/              # Sign-in page
│   │   │   └── error/               # Error page
│   │   ├── results/                  # Results pages
│   │   │   ├── admin/               # Admin results view
│   │   │   ├── test/[testName]/     # Individual test results
│   │   │   └── components/          # Results charts
│   │   ├── eligibility-checker/     # University eligibility tool
│   │   ├── registration/            # Course registration
│   │   ├── du-fbs-course/           # DU FBS course info
│   │   ├── layout.tsx               # Root layout with Header/Footer
│   │   ├── page.tsx                 # Landing page
│   │   └── globals.css              # Global styles + Tailwind config
│   ├── components/                   # Reusable UI components
│   │   ├── Header.tsx               # Navigation header
│   │   ├── Footer.tsx               # Site footer
│   │   ├── AuthProvider.tsx         # NextAuth session provider
│   │   ├── ProtectedRoute.tsx       # Route protection wrapper
│   │   ├── LoginButton.tsx          # OAuth login button
│   │   ├── EligibilityChecker.tsx   # Eligibility calculator
│   │   └── ThresholdResultCard.tsx  # Result display card
│   ├── lib/                          # Utility libraries
│   │   ├── auth.ts                  # NextAuth configuration
│   │   ├── mongodb.ts               # MongoDB client singleton
│   │   ├── db.ts                    # Database utilities
│   │   ├── db-access-control.ts     # Access control from DB
│   │   ├── api-utils.ts             # API helper functions
│   │   ├── email.ts                 # Email utilities
│   │   ├── generated-access-control.ts  # Generated from JSON
│   │   └── models/                  # Mongoose schemas
│   │       ├── User.ts              # User model
│   │       ├── VocabScore.ts        # Vocabulary scores
│   │       ├── MathScore.ts         # Math scores
│   │       └── Registration.ts      # Course registrations
│   ├── data/                         # Static data files
│   │   └── authorizedEmails.ts      # Email authorization list
│   └── types/                        # TypeScript type definitions
│       ├── next-auth.d.ts           # NextAuth type extensions
│       └── results.ts               # Results data types
├── public/                           # Static assets
│   └── data/                         # JSON data files
│       ├── metadata.json            # Test metadata
│       ├── students.json            # Student data
│       ├── mock-tests.json          # IBA mock tests
│       ├── fbs-mock-tests.json      # FBS mock tests
│       ├── simple-tests.json        # Simple test data
│       └── full-tests.json          # Full test data
├── scripts/                          # Build & maintenance scripts
│   ├── generate-access-control.js   # Generate TS from JSON
│   ├── migrate-access-control-to-db.js  # Migrate to MongoDB
│   ├── excel-processor.js           # Process Excel results
│   ├── process-fbs-mocks.js         # Process FBS mock data
│   └── [30+ other utility scripts]
├── docs/                             # Documentation
├── Results/                          # Test result files
├── Sample Mock/                      # Sample mock tests
├── logs/                             # Application logs
├── .claude/                          # Claude Code settings
├── access-control.json              # Source of truth for users
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── next.config.ts                   # Next.js configuration
├── eslint.config.mjs                # ESLint configuration
├── postcss.config.mjs               # PostCSS configuration
├── vercel.json                      # Vercel deployment config
└── .env.local                       # Environment variables (gitignored)
```

---

## Development Workflow

### Initial Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/Ahnafahad/VH-Website.git
   cd VH-Website
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with actual credentials
   ```

3. **Generate access control:**
   ```bash
   npm run generate:access-control
   ```

4. **Start development server:**
   ```bash
   npm run dev
   # Server runs on http://localhost:6960
   ```

### Development Server

- **Port**: 6960 (configured in package.json)
- **Turbopack enabled**: Faster development builds
- **Hot reload**: Automatic page refresh on changes

### Available Scripts

```bash
# Development
npm run dev                           # Start dev server on port 6960

# Production Build
npm run generate:access-control       # Generate TS from access-control.json
npm run build                         # Build for production (runs generate first)
npm run build:next                    # Build without generating access control
npm run start                         # Start production server

# Code Quality
npm run lint                          # Run ESLint

# Database
npm run migrate:users                 # Migrate access control to MongoDB
```

### Build Process

The build process follows this sequence:

1. **Pre-build**: `generate:access-control` script runs automatically
2. **Generation**: Reads `access-control.json` → generates `src/lib/generated-access-control.ts`
3. **Build**: Next.js builds the application
4. **Output**: Static and server files in `.next/` directory

**CRITICAL**: Always run `npm run generate:access-control` after modifying `access-control.json`

### Git Workflow

- **Main branch**: Production-ready code
- **Feature branches**: Named `claude/description-sessionid`
- **Commit messages**: Clear, descriptive (see recent commits for style)
- **Pre-commit**: Ensure tests pass and build succeeds

---

## Key Conventions

### File Naming

- **React components**: PascalCase (e.g., `Header.tsx`, `ProtectedRoute.tsx`)
- **Utilities/libraries**: camelCase (e.g., `api-utils.ts`, `db-access-control.ts`)
- **API routes**: lowercase with hyphens (e.g., `generate-questions/route.ts`)
- **Type definitions**: camelCase with `.d.ts` suffix (e.g., `next-auth.d.ts`)

### Code Style

- **TypeScript**: Strict mode enabled
- **Imports**: Use `@/` alias for src imports
- **Async/await**: Preferred over promises
- **Error handling**: Use try/catch with ApiException
- **Logging**: Use console.log with emoji prefixes (✅, ❌, 🔧, etc.)

### Component Patterns

```typescript
// Standard component structure
import { ComponentType } from 'react'
import { useSession } from 'next-auth/react'

export default function ComponentName() {
  // Hooks first
  const { data: session } = useSession()

  // State
  const [state, setState] = useState()

  // Effects
  useEffect(() => {
    // ...
  }, [])

  // Handlers
  const handleAction = () => {
    // ...
  }

  // Render
  return (
    <div className="container">
      {/* Content */}
    </div>
  )
}
```

### API Route Patterns

```typescript
// Standard API route structure (route.ts)
import { NextRequest, NextResponse } from 'next/server'
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils'
import { connectToDatabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await validateAuth()

    // 2. Connect to database
    await connectToDatabase()

    // 3. Parse and validate request
    const data = await request.json()

    // 4. Business logic
    // ...

    // 5. Return success response
    return NextResponse.json({
      success: true,
      message: 'Operation successful'
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
```

### Styling Conventions

```typescript
// VH Brand colors (defined in globals.css)
const colors = {
  'vh-red': '#760F13',        // Primary brand color
  'vh-beige': '#D4B094',      // Light accent
  'vh-dark-beige': '#A86E58', // Dark accent
  'vh-light-red': '#9A1B20',  // Light variant
  'vh-dark-red': '#5A0B0F'    // Dark variant
}

// Usage in components
<button className="bg-vh-red text-white hover:bg-vh-dark-red">
  Click me
</button>
```

---

## Authentication & Access Control

### Overview

The platform uses a **dual-layer access control system**:

1. **Build-time static generation** (from `access-control.json`)
2. **Runtime database checks** (from MongoDB User collection)

### Access Control Flow

```
User Sign-in Attempt
    ↓
Google OAuth (NextAuth)
    ↓
Check email in generated-access-control.ts
    ↓
If authorized → Create/update session
    ↓
Enhance session with role, permissions, studentId
    ↓
Grant access to protected routes/APIs
```

### access-control.json Structure

**Location**: `/access-control.json` (root directory)

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-09-17T00:00:00.000Z",
  "admins": [
    {
      "id": "admin_001",
      "name": "Ahnaf Ahad",
      "email": "ahnaf816@gmail.com",
      "role": "super_admin",
      "permissions": ["read", "write", "admin", "manage_users"],
      "addedDate": "2025-09-17",
      "active": true
    }
  ],
  "students": [
    {
      "studentId": "757516",
      "name": "Student Name",
      "email": "student@example.com",
      "role": "student",
      "permissions": ["read"],
      "addedDate": "2025-09-17",
      "active": true,
      "class": "DU-FBS",
      "batch": "2025"
    }
  ]
}
```

### User Roles

| Role | Permissions | Access Level |
|------|-------------|--------------|
| **super_admin** | read, write, admin, manage_users | Full system access + user management |
| **admin** | read, write, admin | Full system access |
| **student** | read | Games, results, registration |

### Adding New Users

**IMPORTANT**: Follow this process exactly:

1. **Edit `access-control.json`**
   - Add user to `admins` or `students` array
   - Set `active: true`
   - Assign appropriate role and permissions

2. **Generate TypeScript file**
   ```bash
   npm run generate:access-control
   ```
   - Creates `src/lib/generated-access-control.ts`
   - Generates email lookup maps for O(1) performance

3. **Restart development server** (if running)
   ```bash
   npm run dev
   ```

4. **For production deployment**
   - Commit changes to `access-control.json`
   - Push to repository
   - Vercel automatically runs `generate:access-control` during build

### Authentication Utilities

**File**: `src/lib/db-access-control.ts`

```typescript
// Check if email is authorized
await isEmailAuthorized('user@example.com') // boolean

// Check if email is admin
await isAdminEmail('admin@example.com') // boolean

// Get user data by email
await getUserByEmail('user@example.com') // User object or null

// Check specific permission
await hasPermission('user@example.com', 'write') // boolean
```

### Protected Routes

Use `ProtectedRoute` component for client-side protection:

```typescript
import ProtectedRoute from '@/components/ProtectedRoute'

export default function GamePage() {
  return (
    <ProtectedRoute>
      <GameContent />
    </ProtectedRoute>
  )
}
```

### Protected API Routes

Use `validateAuth()` utility for server-side protection:

```typescript
import { validateAuth } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const user = await validateAuth() // Throws ApiException if unauthorized
    // ... proceed with authorized logic
  } catch (error) {
    return createErrorResponse(error)
  }
}
```

### Session Enhancement

NextAuth sessions are enhanced with additional fields:

```typescript
// Available in session.user
{
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'student'
  isAdmin: boolean
  permissions: string[]
  studentId?: string  // For students
  class?: string      // For students
  batch?: string      // For students
  adminId?: string    // For admins
  accessTypes?: { IBA: boolean, FBS: boolean }
  mockAccess?: { duIba: boolean, bupIba: boolean, ... }
}
```

---

## Database Patterns

### Connection Management

**File**: `src/lib/mongodb.ts`

```typescript
import clientPromise from '@/lib/mongodb'

// Get MongoDB client
const client = await clientPromise
const db = client.db('database-name')
```

**Key Features**:
- Singleton pattern prevents multiple connections
- Development: Uses global variable to preserve connection across HMR
- Production: Creates single connection
- Automatic connection pooling

### Database Connection Utility

**File**: `src/lib/db.ts`

```typescript
import { connectToDatabase } from '@/lib/db'

// Connect to database with error handling
await connectToDatabase()
```

### Mongoose Models

All models are located in `src/lib/models/`

#### User Model

**File**: `src/lib/models/User.ts`

```typescript
import User from '@/lib/models/User'

// Find user by email
const user = await User.findOne({ email: 'user@example.com' })

// Create new user
const newUser = new User({
  email: 'user@example.com',
  name: 'User Name',
  role: 'student',
  permissions: ['read']
})
await newUser.save()

// Check mock access
if (user.hasMockAccess('duIba')) {
  // Grant access
}
```

**Schema Features**:
- Email uniqueness and indexing
- Role-based permissions
- Student ID validation (6 digits)
- Role numbers (6-7 digits)
- Access types (IBA, FBS)
- Mock access (duIba, bupIba, duFbs, bupFbs, fbsDetailed)
- Automatic updatedAt timestamps
- Computed mock access (combines accessTypes + mockAccess)

#### VocabScore Model

**File**: `src/lib/models/VocabScore.ts`

```typescript
import VocabScore from '@/lib/models/VocabScore'

// Save vocabulary quiz score
const score = new VocabScore({
  playerEmail: 'student@example.com',
  playerName: 'Student Name',
  questionsAnswered: 20,
  questionsCorrect: 18,
  totalSections: 10,
  selectedSections: [1, 2, 3],
  difficulty: 'medium',
  isAdmin: false
})
await score.save()

// Get leaderboard
const leaderboard = await VocabScore.find({ isAdmin: false })
  .sort({ questionsCorrect: -1 })
  .limit(10)
```

#### MathScore Model

**File**: `src/lib/models/MathScore.ts`

```typescript
import MathScore from '@/lib/models/MathScore'

// Save mental math score
const score = new MathScore({
  playerEmail: 'student@example.com',
  playerName: 'Student Name',
  score: 850,
  difficulty: 'hard',
  operation: 'mixed',
  questionsAnswered: 10,
  questionsCorrect: 9,
  avgResponseTime: 4.5,
  isAdmin: false
})
await score.save()
```

#### Registration Model

**File**: `src/lib/models/Registration.ts`

```typescript
import Registration from '@/lib/models/Registration'

// Create course registration
const registration = new Registration({
  name: 'Student Name',
  email: 'student@example.com',
  phone: '+8801712345678',
  course: 'IBA Preparation',
  message: 'Interested in joining'
})
await registration.save()
```

### Database Indexes

Indexes are defined in model schemas for performance:

```typescript
// User indexes
UserSchema.index({ email: 1, active: 1 })
UserSchema.index({ studentId: 1 }, { sparse: true })
UserSchema.index({ role: 1, active: 1 })

// Score indexes (typical pattern)
ScoreSchema.index({ playerEmail: 1 })
ScoreSchema.index({ playedAt: -1 })
ScoreSchema.index({ isAdmin: 1 })
```

---

## API Patterns

### Standard API Structure

All API routes follow this pattern:

1. **Authentication**: Validate user session
2. **Database connection**: Ensure DB is connected
3. **Request validation**: Parse and validate input
4. **Business logic**: Perform operations
5. **Response**: Return success or error

### Error Handling

**File**: `src/lib/api-utils.ts`

```typescript
// Custom API exception
throw new ApiException('Error message', 400, 'ERROR_CODE')

// Error response handler
return createErrorResponse(error)
```

**Error Response Format**:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common API Endpoints

#### Authentication

- **POST** `/api/auth/[...nextauth]` - NextAuth handler
- **GET** `/api/auth/check-admin` - Check if user is admin

#### User Management (Admin only)

- **GET** `/api/admin/users` - List all users
- **POST** `/api/admin/users` - Create new user
- **POST** `/api/admin/grant-access` - Grant user access
- **GET** `/api/admin/students` - List all students

#### Games

- **POST** `/api/vocab-quiz/scores` - Submit vocabulary score
- **GET** `/api/vocab-quiz/leaderboard` - Get vocabulary leaderboard
- **POST** `/api/mental-math/scores` - Submit math score
- **GET** `/api/mental-math/leaderboard` - Get math leaderboard

#### AI Integration

- **POST** `/api/generate-questions` - Generate AI questions with Gemini API

#### Registrations

- **GET** `/api/registrations` - List all registrations (admin)
- **POST** `/api/registrations` - Submit new registration
- **GET** `/api/registrations/[id]` - Get specific registration

#### Utilities

- **GET** `/api/health` - Health check endpoint
- **GET** `/api/user/access` - Get current user access info

### API Response Patterns

**Success Response**:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* optional data */ }
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* optional in dev mode */ }
}
```

### Validation Patterns

```typescript
// Request validation example
const validationErrors: string[] = []

if (typeof value !== 'number' || value < 0) {
  validationErrors.push('value must be a non-negative number')
}

if (validationErrors.length > 0) {
  throw new ApiException(
    `Validation failed: ${validationErrors.join(', ')}`,
    400,
    'VALIDATION_ERROR'
  )
}
```

---

## Frontend Patterns

### Page Structure (App Router)

```typescript
// src/app/page-name/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title - VH',
  description: 'Page description'
}

export default function PageName() {
  return (
    <main className="container mx-auto px-4 py-8">
      {/* Content */}
    </main>
  )
}
```

### Client Components

```typescript
'use client' // Required for hooks

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function ClientComponent() {
  const { data: session, status } = useSession()
  const [state, setState] = useState()

  return <div>{/* Content */}</div>
}
```

### Protected Pages

```typescript
import ProtectedRoute from '@/components/ProtectedRoute'

export default function ProtectedPage() {
  return (
    <ProtectedRoute>
      <ProtectedContent />
    </ProtectedRoute>
  )
}
```

### Data Fetching

```typescript
// Client-side fetch
const fetchData = async () => {
  const response = await fetch('/api/endpoint')
  const data = await response.json()
  return data
}

// With error handling
try {
  const data = await fetchData()
} catch (error) {
  console.error('Failed to fetch data:', error)
}
```

### Form Handling

```typescript
const [formData, setFormData] = useState({
  name: '',
  email: ''
})

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    const result = await response.json()

    if (result.success) {
      // Handle success
    }
  } catch (error) {
    // Handle error
  }
}
```

### Styling with Tailwind

```typescript
// Container pattern
<div className="container mx-auto px-4 py-8">

// Card pattern
<div className="bg-white rounded-lg shadow-md p-6">

// Button patterns
<button className="bg-vh-red text-white px-6 py-2 rounded hover:bg-vh-dark-red transition">

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Flex patterns
<div className="flex items-center justify-between">
```

### Loading States

```typescript
const [loading, setLoading] = useState(false)

const handleAction = async () => {
  setLoading(true)
  try {
    // Perform action
  } finally {
    setLoading(false)
  }
}

return (
  <button disabled={loading}>
    {loading ? 'Loading...' : 'Submit'}
  </button>
)
```

---

## Testing & Quality

### Type Checking

```bash
# Run TypeScript compiler check
npx tsc --noEmit
```

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

### Environment Variables Validation

The codebase validates required environment variables at runtime:

```typescript
// In API routes, validateEnvironment() checks:
- MONGODB_URI
- NEXTAUTH_SECRET
```

### Common Type Issues

**Fix**: Always use type assertions for userResponse status checks

```typescript
// Correct
if ((userResponse as { status?: number }).status === 404) {
  // Handle 404
}

// Incorrect (will cause TypeScript error)
if (userResponse.status === 404) {
  // Error: Property 'status' does not exist
}
```

---

## Deployment

### Vercel Deployment

**Configuration**: `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### Build Process on Vercel

1. **Install dependencies**: `npm install`
2. **Generate access control**: `npm run generate:access-control` (via prebuild)
3. **Build Next.js**: `next build`
4. **Deploy**: Vercel handles deployment

### Environment Variables

**Required in Vercel**:

```bash
# Authentication
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
MONGODB_URI=your-mongodb-connection-string

# AI Integration
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Email Services
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your-emailjs-service-id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your-emailjs-template-id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your-emailjs-public-key
RESEND_API_KEY=your-resend-api-key

# Environment
NODE_ENV=production
```

### Deployment Checklist

- [ ] Update `access-control.json` with production users
- [ ] Set all environment variables in Vercel
- [ ] Test Google OAuth redirect URIs
- [ ] Verify MongoDB IP whitelist includes Vercel IPs (or use 0.0.0.0/0)
- [ ] Test email services (EmailJS and Resend)
- [ ] Verify Gemini API key quota
- [ ] Check analytics are tracking

---

## Common Tasks

### Adding a New User

1. Edit `access-control.json`:
   ```json
   {
     "students": [
       {
         "studentId": "123456",
         "name": "New Student",
         "email": "student@example.com",
         "role": "student",
         "permissions": ["read"],
         "addedDate": "2025-11-15",
         "active": true,
         "class": "IBA",
         "batch": "2026"
       }
     ]
   }
   ```

2. Generate TypeScript:
   ```bash
   npm run generate:access-control
   ```

3. Restart dev server or deploy to production

### Adding a New API Endpoint

1. Create `src/app/api/endpoint-name/route.ts`:
   ```typescript
   import { NextRequest, NextResponse } from 'next/server'
   import { validateAuth, createErrorResponse } from '@/lib/api-utils'

   export async function GET(request: NextRequest) {
     try {
       const user = await validateAuth()
       // Logic here
       return NextResponse.json({ success: true })
     } catch (error) {
       return createErrorResponse(error)
     }
   }
   ```

2. Test locally: `curl http://localhost:6960/api/endpoint-name`

### Adding a New Protected Page

1. Create `src/app/page-name/page.tsx`:
   ```typescript
   import ProtectedRoute from '@/components/ProtectedRoute'

   export default function PageName() {
     return (
       <ProtectedRoute>
         <main className="container mx-auto px-4 py-8">
           {/* Content */}
         </main>
       </ProtectedRoute>
     )
   }
   ```

### Adding a New Database Model

1. Create `src/lib/models/ModelName.ts`:
   ```typescript
   import mongoose from 'mongoose'

   export interface IModelName extends mongoose.Document {
     field1: string
     field2: number
     createdAt: Date
   }

   const ModelNameSchema = new mongoose.Schema<IModelName>({
     field1: { type: String, required: true },
     field2: { type: Number, required: true },
     createdAt: { type: Date, default: Date.now }
   })

   export default mongoose.models.ModelName ||
     mongoose.model<IModelName>('ModelName', ModelNameSchema)
   ```

2. Use in API routes:
   ```typescript
   import ModelName from '@/lib/models/ModelName'

   const item = await ModelName.findOne({ field1: 'value' })
   ```

### Updating VH Brand Colors

1. Edit `src/app/globals.css`:
   ```css
   @theme inline {
     --color-vh-red: #760F13;
     /* ... other colors ... */
   }
   ```

2. Use in components:
   ```typescript
   <div className="bg-vh-red text-white">
   ```

---

## Troubleshooting

### Build Errors

**Error**: `access-control.json not found`
- **Solution**: Ensure `access-control.json` exists in project root
- **Run**: `npm run generate:access-control`

**Error**: `Cannot find module '@/lib/generated-access-control'`
- **Solution**: Generate the file
- **Run**: `npm run generate:access-control`

**Error**: TypeScript errors on `userResponse.status`
- **Solution**: Use type assertion
- **Fix**: `(userResponse as { status?: number }).status`

### Authentication Issues

**Error**: Sign-in rejected
- **Check**: Email exists in `access-control.json` with `active: true`
- **Verify**: Generated access control is up to date
- **Test**: `npm run generate:access-control` and restart server

**Error**: Google OAuth redirect URI mismatch
- **Check**: NEXTAUTH_URL matches OAuth redirect URI in Google Console
- **Verify**: Google OAuth credentials are correct

### Database Connection Issues

**Error**: MongoDB connection timeout
- **Check**: MONGODB_URI is correct
- **Verify**: IP address is whitelisted in MongoDB Atlas
- **Test**: Use MongoDB Compass to verify connection

**Error**: Mongoose model already defined
- **Cause**: Hot Module Replacement in development
- **Solution**: The code already handles this with `mongoose.models.ModelName || ...`

### API Errors

**Error**: 401 Unauthorized
- **Check**: User is signed in
- **Verify**: Session is valid
- **Test**: Call `/api/user/access` to check session

**Error**: 403 Access Denied
- **Check**: User email is in authorized emails
- **Verify**: User has required permissions
- **Test**: Check `access-control.json`

**Error**: 500 Internal Server Error
- **Check**: Environment variables are set
- **View**: Server logs in Vercel or terminal
- **Test**: Enable development mode for detailed errors

### Development Server Issues

**Error**: Port 6960 already in use
- **Solution**: Kill existing process
- **Run**: `npx kill-port 6960` or `lsof -ti:6960 | xargs kill`

**Error**: Changes not reflecting
- **Solution**: Hard refresh browser (Ctrl+Shift+R)
- **Check**: Development server is running with Turbopack

---

## Important Notes for AI Assistants

### DO's

✅ **Always run `generate:access-control` after modifying `access-control.json`**
✅ **Use `validateAuth()` for all protected API routes**
✅ **Follow TypeScript strict mode - no `any` types**
✅ **Use `@/` import alias for src imports**
✅ **Include error handling with try/catch and ApiException**
✅ **Use emoji prefixes in console.log (✅, ❌, 🔧, 📊)**
✅ **Follow existing code patterns and conventions**
✅ **Update this CLAUDE.md when making architectural changes**
✅ **Test authentication flow after user management changes**
✅ **Verify environment variables before deployment**

### DON'Ts

❌ **Never commit `.env.local` (it's gitignored)**
❌ **Never expose API keys or secrets in code**
❌ **Never bypass authentication checks**
❌ **Never use synchronous file operations in API routes**
❌ **Never create database connections outside mongodb.ts pattern**
❌ **Never modify `generated-access-control.ts` directly (it's auto-generated)**
❌ **Never skip TypeScript type checking**
❌ **Don't use `any` type - use proper TypeScript types**
❌ **Don't create global state - use React context or database**
❌ **Don't forget to handle loading and error states in UI**

### Critical Files (DO NOT DELETE)

- `access-control.json` - Source of truth for user access
- `src/lib/auth.ts` - NextAuth configuration
- `src/lib/mongodb.ts` - Database connection singleton
- `src/lib/api-utils.ts` - Core API utilities
- `scripts/generate-access-control.js` - Access control generator
- `.env.local` - Environment variables (local only, gitignored)
- `package.json` - Dependencies and scripts

### Security Considerations

🔒 **Authentication**: All protected routes must validate user session
🔒 **Authorization**: Check user role/permissions before granting access
🔒 **Input Validation**: Always validate and sanitize user input
🔒 **Error Messages**: Don't expose sensitive information in errors
🔒 **Environment Variables**: Never commit secrets to repository
🔒 **SQL Injection**: Using MongoDB with Mongoose prevents SQL injection
🔒 **XSS Protection**: React escapes by default, but be careful with dangerouslySetInnerHTML

### Performance Best Practices

⚡ **Database Indexes**: Ensure proper indexes on frequently queried fields
⚡ **Connection Pooling**: Use mongodb.ts singleton pattern
⚡ **Static Generation**: Use Next.js SSG where possible
⚡ **Image Optimization**: Use Next.js Image component
⚡ **Code Splitting**: Next.js handles this automatically with App Router
⚡ **Caching**: Leverage Next.js caching strategies

---

## Additional Resources

### Documentation Files

- **README.md** - Project overview and setup instructions
- **ARCHITECTURE_DIAGRAM.md** - System architecture documentation
- **QUICK_START.md** - Quick start guide
- **TEST_SYSTEM.md** - Testing system documentation
- **VERCEL_DEPLOYMENT_GUIDE.md** - Vercel deployment guide
- **EMAIL_NOTIFICATION_SETUP.md** - Email configuration guide
- **SETUP_GEMINI_API.md** - Gemini API setup guide
- **SECURITY_ALERT.md** - Security guidelines
- **TEST_UPDATE_GUIDE.md** - Test update procedures
- **TESTING_CHANGES_LOG.md** - Changes log

### External Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [MongoDB Documentation](https://www.mongodb.com/docs/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vercel Documentation](https://vercel.com/docs)

### Contact

For questions or issues:
- **Email**: ahnafahad@vh-beyondthehorizons.org
- **Repository**: https://github.com/Ahnafahad/VH-Website

---

**End of CLAUDE.md**

> This document should be updated whenever significant architectural changes are made to the codebase.
> Last comprehensive update: 2025-11-15
