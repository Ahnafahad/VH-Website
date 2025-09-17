# VH Website Deployment and Maintenance Guide

## Overview

This guide covers the deployment process, environment configuration, maintenance procedures, and troubleshooting for the VH Website. The application is deployed on Vercel with automated CI/CD integration.

## Production Deployment

### 1. Vercel Deployment Setup

#### Platform Configuration
- **Hosting Platform**: Vercel
- **Framework**: Next.js 15 (automatically detected)
- **Build Command**: `npm run build`
- **Install Command**: `npm install`
- **Output Directory**: `.next` (automatic)

#### Repository Integration
```bash
# Connect GitHub repository to Vercel
1. Import repository from GitHub
2. Configure project settings
3. Set up environment variables
4. Enable automatic deployments
```

#### Build Configuration (`vercel.json`)
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### 2. Environment Variables

#### Production Environment Configuration
```env
# Authentication
NEXTAUTH_URL=https://vh-website.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret-here
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vh-website?retryWrites=true&w=majority

# External APIs
GOOGLE_GEMINI_API_KEY=your-gemini-api-key-here
EMAILJS_SERVICE_ID=your-emailjs-service-id
EMAILJS_TEMPLATE_ID=your-emailjs-template-id
EMAILJS_PUBLIC_KEY=your-emailjs-public-key

# Environment
NODE_ENV=production
```

#### Environment Variable Security
- **Sensitive Data**: Never commit secrets to repository
- **Vercel Dashboard**: Configure all environment variables in project settings
- **Variable Scoping**: Use different values for preview/production environments
- **Access Control**: Limit access to environment variables in team settings

### 3. Build Process

#### Pre-build Steps
```json
{
  "scripts": {
    "prebuild": "npm run generate:access-control",
    "generate:access-control": "node scripts/generate-access-control.js",
    "build": "next build",
    "start": "next start"
  }
}
```

#### Build Optimization
```typescript
// Next.js configuration (next.config.js)
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react']
  },
  images: {
    domains: ['lh3.googleusercontent.com'],
    formats: ['image/webp', 'image/avif']
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
};
```

#### Build-Time Access Control Generation
```javascript
// scripts/generate-access-control.js
const fs = require('fs');
const path = require('path');

function generateAccessControl() {
  const configPath = path.join(process.cwd(), 'access-control.json');
  const outputPath = path.join(process.cwd(), 'src/lib/generated-access-control.ts');

  if (!fs.existsSync(configPath)) {
    console.error('access-control.json not found');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // Generate TypeScript file with optimized data structures
  const tsContent = generateTypeScriptContent(config);

  fs.writeFileSync(outputPath, tsContent);
  console.log('✅ Access control generated successfully');
}

generateAccessControl();
```

## Development Workflow

### 1. Local Development Setup

#### Prerequisites
```bash
# Required software
Node.js 18+
npm or yarn
Git
```

#### Initial Setup
```bash
# Clone repository
git clone https://github.com/your-username/vh-website.git
cd vh-website

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Generate access control
npm run generate:access-control

# Start development server
npm run dev
```

#### Development Environment Variables (`.env.local`)
```env
# Local development configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-development-secret
MONGODB_URI=mongodb+srv://dev-cluster-connection
GOOGLE_CLIENT_ID=dev-oauth-client-id
GOOGLE_CLIENT_SECRET=dev-oauth-client-secret
GOOGLE_GEMINI_API_KEY=dev-gemini-api-key
```

### 2. Development Best Practices

#### Code Quality
```json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

#### Pre-commit Hooks (`.husky/pre-commit`)
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run lint
npm run type-check
npm run generate:access-control
```

#### Testing Strategy
```bash
# Run tests before deployment
npm run test           # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:coverage # Coverage report
```

## Database Management

### 1. MongoDB Atlas Configuration

#### Production Database
- **Cluster**: Production-grade cluster (M10 or higher)
- **Region**: Closest to primary user base
- **Backup**: Automated daily backups enabled
- **Monitoring**: Atlas monitoring and alerts configured

#### Connection Security
```typescript
// Database connection with retry logic
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI!, {
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};
```

#### Database Indexes
```javascript
// Ensure optimal query performance
VocabScoreSchema.index({ questionsAnswered: -1, playedAt: -1 });
VocabScoreSchema.index({ playerEmail: 1, questionsAnswered: -1 });
VocabScoreSchema.index({ isAdmin: 1, questionsAnswered: -1 });

MathScoreSchema.index({ score: -1, playedAt: -1 });
MathScoreSchema.index({ playerEmail: 1, score: -1 });
MathScoreSchema.index({ isAdmin: 1, score: -1 });
```

### 2. Data Migration and Backup

#### Backup Strategy
```bash
# Manual backup (for critical updates)
mongodump --uri="mongodb+srv://..." --out=backup-$(date +%Y%m%d)

# Automated backup verification
mongorestore --uri="mongodb+srv://..." --dry-run backup-folder/
```

#### Migration Scripts
```javascript
// Database migration example
async function migrateScoreData() {
  const scores = await VocabScore.find({ accuracy: { $exists: false } });

  for (const score of scores) {
    score.accuracy = (score.questionsCorrect / score.questionsAnswered) * 100;
    await score.save();
  }

  console.log(`Migrated ${scores.length} score records`);
}
```

## Monitoring and Analytics

### 1. Performance Monitoring

#### Vercel Analytics
```typescript
// pages/_app.tsx or app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function App({ children }) {
  return (
    <>
      {children}
      <Analytics />
    </>
  );
}
```

#### Custom Error Tracking
```typescript
// lib/error-tracking.ts
export function trackError(error: Error, context?: any) {
  console.error('Application Error:', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    url: window?.location?.href,
    userAgent: navigator?.userAgent
  });

  // Send to monitoring service in production
  if (process.env.NODE_ENV === 'production') {
    // Integrate with Sentry, LogRocket, etc.
  }
}
```

#### Database Performance Monitoring
```typescript
// Monitor slow queries
mongoose.set('debug', (collectionName, method, query, doc) => {
  console.log(`${collectionName}.${method}`, JSON.stringify(query), doc);
});

// Connection monitoring
mongoose.connection.on('connected', () => {
  console.log('Database connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('Database connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Database disconnected');
});
```

### 2. Application Metrics

#### Key Performance Indicators (KPIs)
- **Page Load Times** - Core Web Vitals tracking
- **API Response Times** - Database query performance
- **Error Rates** - Application stability metrics
- **User Engagement** - Game completion rates
- **Authentication Success** - OAuth conversion rates

#### Custom Metrics Collection
```typescript
// lib/metrics.ts
export function trackMetric(name: string, value: number, tags?: Record<string, string>) {
  const metric = {
    name,
    value,
    tags: {
      environment: process.env.NODE_ENV,
      ...tags
    },
    timestamp: new Date().toISOString()
  };

  // Log locally in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Metric:', metric);
  }

  // Send to analytics service in production
  // Implementation depends on chosen service
}
```

## Security and Maintenance

### 1. Security Best Practices

#### Regular Security Updates
```bash
# Check for security vulnerabilities
npm audit

# Fix automatic vulnerabilities
npm audit fix

# Check for outdated dependencies
npm outdated

# Update dependencies
npm update
```

#### Environment Security
```typescript
// Validate required environment variables
const requiredEnvVars = [
  'NEXTAUTH_SECRET',
  'MONGODB_URI',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_GEMINI_API_KEY'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});
```

#### Access Control Maintenance
```bash
# Regularly update access-control.json
# Remove inactive users
# Add new authorized users
# Verify admin permissions

# Regenerate access control after changes
npm run generate:access-control
```

### 2. Maintenance Procedures

#### Weekly Maintenance Tasks
1. **Database Cleanup** - Remove old session data
2. **Performance Review** - Check Vercel analytics
3. **Error Log Review** - Identify and fix recurring issues
4. **Dependency Updates** - Update non-breaking changes

#### Monthly Maintenance Tasks
1. **Security Audit** - Review access control lists
2. **Performance Optimization** - Database query analysis
3. **Backup Verification** - Test restore procedures
4. **Feature Usage Analysis** - Review game engagement metrics

#### Quarterly Maintenance Tasks
1. **Major Dependency Updates** - Update Next.js, React, etc.
2. **Security Penetration Testing** - Third-party security audit
3. **Performance Baseline Review** - Compare against historical data
4. **Infrastructure Cost Analysis** - Optimize resource usage

## Troubleshooting Common Issues

### 1. Deployment Issues

#### Build Failures
```bash
# Common build error solutions

# Problem: Out of memory during build
# Solution: Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Problem: TypeScript compilation errors
# Solution: Fix type errors before deployment
npm run type-check

# Problem: Missing environment variables
# Solution: Verify all required variables are set in Vercel dashboard
```

#### Runtime Errors
```typescript
// API route error handling
export async function POST(request: NextRequest) {
  try {
    // Main logic here
  } catch (error) {
    console.error('API Error:', error);

    // Return appropriate error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
```

### 2. Authentication Issues

#### OAuth Configuration Problems
```typescript
// Debug OAuth issues
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('Sign in attempt:', { user: user.email, account: account?.provider });
      return true; // Add debugging
    },
    async session({ session, token }) {
      console.log('Session callback:', { email: session.user?.email });
      return session;
    }
  },
  debug: process.env.NODE_ENV === 'development' // Enable debug mode
};
```

#### Access Control Issues
```typescript
// Debug access control
export function isEmailAuthorized(email: string): boolean {
  const authorized = authorizedEmails.has(email.toLowerCase());

  if (!authorized) {
    console.log('Unauthorized access attempt:', email);
    // Log to monitoring service in production
  }

  return authorized;
}
```

### 3. Database Issues

#### Connection Problems
```typescript
// Database connection troubleshooting
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', {
    message: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });

  // Attempt to reconnect
  setTimeout(() => {
    mongoose.connect(process.env.MONGODB_URI!);
  }, 5000);
});
```

#### Performance Issues
```bash
# Analyze slow queries in MongoDB Atlas
# Check query performance in Atlas Performance Advisor
# Add appropriate indexes for slow queries
# Monitor connection pool usage
```

### 4. Game-Specific Issues

#### AI API Failures
```typescript
// Gemini API error handling
async function generateQuestions(prompt: string): Promise<Question[]> {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GOOGLE_GEMINI_API_KEY!
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return parseQuestions(data);

  } catch (error) {
    console.error('Question generation failed:', error);

    // Return fallback questions or show appropriate error
    throw new Error('Question generation temporarily unavailable. Please try again.');
  }
}
```

## Contact and Support

### Emergency Contacts
- **Development Team**: [team@vh-website.com]
- **System Administrator**: [admin@vh-website.com]
- **Database Administrator**: [dba@vh-website.com]

### Escalation Procedures
1. **Level 1** - Application errors, minor issues
2. **Level 2** - Database problems, authentication failures
3. **Level 3** - Complete system outage, security breaches

### Documentation Updates
This deployment guide should be updated whenever:
- New environment variables are added
- Deployment process changes
- New monitoring tools are integrated
- Security procedures are modified

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Next Review**: April 2025