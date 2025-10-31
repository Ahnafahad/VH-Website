import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Registration from '@/lib/models/Registration';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail } from '@/lib/generated-access-control';

// PATCH - Update registration status or notes (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate admin authentication
    const user = await validateAuth();

    if (!isAdminEmail(user.email)) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    await connectToDatabase();

    const data = await request.json();
    const { status, notes } = data;

    // Validate status if provided
    if (status && !['pending', 'contacted', 'enrolled', 'cancelled'].includes(status)) {
      throw new ApiException(
        'Invalid status. Must be one of: pending, contacted, enrolled, cancelled',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Update fields
    const updateFields: any = {
      updatedAt: new Date()
    };
    if (status) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = notes;

    const updatedRegistration = await Registration.findByIdAndUpdate(
      params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updatedRegistration) {
      throw new ApiException('Registration not found', 404, 'NOT_FOUND');
    }

    return NextResponse.json({
      success: true,
      message: 'Registration updated successfully',
      registration: updatedRegistration
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// GET - Fetch single registration (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate admin authentication
    const user = await validateAuth();

    if (!isAdminEmail(user.email)) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    await connectToDatabase();

    const registration = await Registration.findById(params.id).lean();

    if (!registration) {
      throw new ApiException('Registration not found', 404, 'NOT_FOUND');
    }

    return NextResponse.json({
      success: true,
      registration
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
