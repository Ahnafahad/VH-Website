import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Registration from '@/lib/models/Registration';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { sendRegistrationNotification } from '@/lib/email';

// POST - Create new registration (public endpoint)
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const data = await request.json();

    // Validate required fields
    const {
      name,
      email,
      phone,
      educationType,
      years,
      programMode,
      selectedMocks,
      mockIntent,
      pricing,
      selectedFullCourses,
      referral
    } = data;

    const validationErrors: string[] = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      validationErrors.push('name is required');
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      validationErrors.push('valid email is required');
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      validationErrors.push('phone is required');
    }
    if (!educationType || !['hsc', 'alevels'].includes(educationType)) {
      validationErrors.push('educationType must be either hsc or alevels');
    }
    if (!years || typeof years !== 'object') {
      validationErrors.push('years information is required');
    }
    if (!programMode || !['mocks', 'full'].includes(programMode)) {
      validationErrors.push('programMode must be either mocks or full');
    }

    // Validate program-specific fields
    if (programMode === 'mocks') {
      if (!Array.isArray(selectedMocks) || selectedMocks.length === 0) {
        validationErrors.push('at least one mock program must be selected');
      }
      if (!mockIntent || !['trial', 'full'].includes(mockIntent)) {
        validationErrors.push('mockIntent must be either trial or full');
      }
    } else if (programMode === 'full') {
      if (!Array.isArray(selectedFullCourses) || selectedFullCourses.length === 0) {
        validationErrors.push('at least one full course must be selected');
      }
    }

    if (validationErrors.length > 0) {
      throw new ApiException(
        `Validation failed: ${validationErrors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    // Create new registration
    const registration = new Registration({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      educationType,
      years,
      programMode,
      selectedMocks: programMode === 'mocks' ? selectedMocks : undefined,
      mockIntent: programMode === 'mocks' ? mockIntent : undefined,
      pricing: programMode === 'mocks' ? pricing : undefined,
      selectedFullCourses: programMode === 'full' ? selectedFullCourses : undefined,
      referral: (programMode === 'mocks' && referral && referral.name && referral.institution && referral.batch) ? {
        name: referral.name.trim(),
        institution: referral.institution,
        batch: referral.batch.trim()
      } : undefined,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedRegistration = await registration.save();

    // Send email notification to admins (non-blocking)
    sendRegistrationNotification({
      name: data.name,
      email: data.email,
      phone: data.phone,
      educationType: data.educationType,
      programMode: data.programMode,
      selectedMocks: data.selectedMocks,
      selectedFullCourses: data.selectedFullCourses,
      mockIntent: data.mockIntent,
      pricing: data.pricing,
      referral: data.referral
    }).catch(error => {
      // Log error but don't fail the registration
      console.error('Failed to send registration notification email:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Registration submitted successfully',
      registrationId: savedRegistration._id
    }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// GET - Fetch registrations (admin only)
export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();
    const { isAdminEmail } = await import('@/lib/db-access-control');

    if (!(await isAdminEmail(user.email))) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    await connectToDatabase();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const programMode = searchParams.get('programMode');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    const query: any = {};
    if (status) query.status = status;
    if (programMode) query.programMode = programMode;

    // Fetch registrations
    const registrations = await Registration.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Get counts by status
    const statusCounts = await Registration.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      pending: 0,
      contacted: 0,
      enrolled: 0,
      cancelled: 0
    };

    statusCounts.forEach((item: any) => {
      counts[item._id as keyof typeof counts] = item.count;
    });

    return NextResponse.json({
      success: true,
      registrations,
      counts,
      total: registrations.length
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
