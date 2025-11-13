import { NextResponse } from 'next/server';
import { connectToDatabase, isConnected } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isEmailAuthorized, isAdminEmail } from '@/lib/db-access-control';
import mongoose from 'mongoose';

export async function GET() {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      environment: {
        status: 'unknown',
        details: {}
      },
      database: {
        status: 'unknown',
        details: {}
      },
      authentication: {
        status: 'unknown',
        details: {}
      }
    }
  };

  // Check environment variables
  try {
    const requiredEnvVars = ['MONGODB_URI', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
    const envStatus: Record<string, boolean> = {};

    for (const envVar of requiredEnvVars) {
      envStatus[envVar] = !!process.env[envVar];
    }

    const missingVars = Object.entries(envStatus)
      .filter(([, exists]) => !exists)
      .map(([name]) => name);

    healthCheck.checks.environment.status = missingVars.length > 0 ? 'error' : 'healthy';
    healthCheck.checks.environment.details = {
      required: envStatus,
      missing: missingVars,
      nodeEnv: process.env.NODE_ENV
    };
  } catch (error) {
    healthCheck.checks.environment.status = 'error';
    healthCheck.checks.environment.details = {
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }

  // Check database connection
  try {
    await connectToDatabase();
    const connected = isConnected();

    healthCheck.checks.database.status = connected ? 'healthy' : 'error';
    healthCheck.checks.database.details = {
      connected,
      readyState: process.env.NODE_ENV === 'development' ?
        mongoose.connection.readyState : 'hidden-in-prod'
    };
  } catch (error) {
    healthCheck.checks.database.status = 'error';
    healthCheck.checks.database.details = {
      error: error instanceof Error ? error.message : 'Database connection failed'
    };
  }

  // Check authentication (only if session exists)
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.email) {
      const isAuthorized = await isEmailAuthorized(session.user.email.toLowerCase());
      const isAdmin = await isAdminEmail(session.user.email);

      healthCheck.checks.authentication.status = 'healthy';
      healthCheck.checks.authentication.details = {
        hasSession: true,
        email: session.user.email.substring(0, 3) + '***', // Partially hide email
        isAuthorized,
        isAdmin,
        name: session.user.name || 'No name'
      };
    } else {
      healthCheck.checks.authentication.status = 'warning';
      healthCheck.checks.authentication.details = {
        hasSession: false,
        message: 'No session found (this is normal for health checks)'
      };
    }
  } catch (error) {
    healthCheck.checks.authentication.status = 'error';
    healthCheck.checks.authentication.details = {
      error: error instanceof Error ? error.message : 'Auth check failed'
    };
  }

  // Determine overall status
  const hasError = Object.values(healthCheck.checks).some(check => check.status === 'error');
  if (hasError) {
    healthCheck.status = 'unhealthy';
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 500;

  return NextResponse.json(healthCheck, { status: statusCode });
}