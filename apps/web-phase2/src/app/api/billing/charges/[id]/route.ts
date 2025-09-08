/**
 * Billing Charge Update API Endpoint
 * Handles individual charge operations (GET, PUT, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { validateChargeUpdate } from '@/lib/billing/validation';
import { scrubCharge } from '@/lib/billing/scrub';
import { auditLogger, AuditEventType } from '@/utils/auditLog';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/billing/charges/[id]
 * Retrieve a specific charge by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const authResult = await authenticateAndAuthorize(request, ['provider', 'admin']);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, code: 'UNAUTHORIZED' },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { id } = params;

    // TODO: Fetch from database with Prisma
    // Ensure org-scoped access (provider can only see their charges)
    const mockCharge = {
      id: id,
      providerId: user.id,
      patientId: 'patient_1',
      cptCode: '90834',
      modifiers: [],
      diagnosisPointers: ['A'],
      diagnosisCodes: ['F32.9'],
      units: 1,
      chargeAmount: 150.00,
      posCode: '11',
      status: 'DRAFT',
      renderingProviderNPI: '1234567890',
      billingProviderNPI: '1234567890',
      billingTIN: '12-3456789',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Verify access (provider can only access their own charges)
    if (user.role !== 'admin' && mockCharge.providerId !== user.id) {
      auditLogger.logSecurity(
        'unauthorized',
        'charge',
        { 
          userId: user.id,
          attemptedResource: id,
          resourceOwner: mockCharge.providerId
        }
      );

      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Log PHI access
    auditLogger.logPHIAccess(
      'view',
      'charge',
      id,
      mockCharge.patientId,
      { 
        userId: user.id,
        cptCode: mockCharge.cptCode,
        amount: mockCharge.chargeAmount
      }
    );

    return NextResponse.json({
      success: true,
      data: { charge: mockCharge }
    });

  } catch (error) {
    console.error('Error fetching charge:', error);
    
    auditLogger.log({
      event: AuditEventType.SYSTEM_ERROR,
      action: 'fetch_charge_error',
      result: 'failure',
      resourceId: params.id,
      details: { 
        error: error instanceof Error ? error.message : String(error),
        endpoint: `/api/billing/charges/${params.id}`
      }
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/billing/charges/[id]
 * Update an existing charge
 */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const authResult = await authenticateAndAuthorize(request, ['provider', 'admin']);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, code: 'UNAUTHORIZED' },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { id } = params;
    const body = await request.json();

    // TODO: Fetch existing charge from database
    const existingCharge = {
      id: id,
      providerId: user.id,
      patientId: 'patient_1',
      status: 'DRAFT'
    };

    // Verify access and editability
    if (user.role !== 'admin' && existingCharge.providerId !== user.id) {
      auditLogger.logSecurity(
        'unauthorized',
        'charge',
        { 
          userId: user.id,
          attemptedResource: id,
          resourceOwner: existingCharge.providerId,
          action: 'update'
        }
      );

      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Check if charge can be edited (only DRAFT charges)
    if (existingCharge.status !== 'DRAFT') {
      return NextResponse.json(
        { 
          error: 'Cannot edit submitted charges', 
          code: 'CHARGE_NOT_EDITABLE',
          details: { currentStatus: existingCharge.status }
        },
        { status: 409 }
      );
    }

    // Validate update data
    let validatedData;
    try {
      validatedData = validateChargeUpdate({
        ...body,
        id: id,
        providerId: user.id // Ensure provider can only update their own charges
      });
    } catch (validationError: any) {
      auditLogger.log({
        event: AuditEventType.SYSTEM_ERROR,
        userId: user.id,
        action: 'charge_update_validation_failed',
        result: 'failure',
        resourceId: id,
        details: { 
          validationErrors: validationError.errors || [validationError.message],
          submittedData: body
        }
      });

      return NextResponse.json(
        { 
          error: 'Validation failed', 
          code: 'VALIDATION_ERROR',
          details: validationError.errors || [validationError.message]
        },
        { status: 400 }
      );
    }

    // Scrub the updated charge data
    const scrubResult = scrubCharge(validatedData);
    if (!scrubResult.isValid) {
      auditLogger.log({
        event: AuditEventType.SYSTEM_ERROR,
        userId: user.id,
        action: 'charge_update_scrub_failed',
        result: 'failure',
        resourceId: id,
        details: { 
          scrubErrors: scrubResult.errors,
          scrubWarnings: scrubResult.warnings
        }
      });

      return NextResponse.json(
        {
          error: 'Updated charge data failed compliance check',
          code: 'SCRUB_ERROR',
          details: {
            errors: scrubResult.errors,
            warnings: scrubResult.warnings
          }
        },
        { status: 400 }
      );
    }

    // TODO: Update in database with Prisma
    const updatedCharge = {
      ...existingCharge,
      ...validatedData,
      updatedAt: new Date().toISOString()
    };

    // Log PHI update
    auditLogger.logPHIAccess(
      'update',
      'charge',
      id,
      existingCharge.patientId,
      { 
        userId: user.id,
        updatedFields: Object.keys(body),
        scrubWarnings: scrubResult.warnings.length
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        charge: updatedCharge,
        scrubResult: {
          warnings: scrubResult.warnings,
          isCompliant: true
        }
      }
    });

  } catch (error) {
    console.error('Error updating charge:', error);
    
    auditLogger.log({
      event: AuditEventType.SYSTEM_ERROR,
      action: 'charge_update_error',
      result: 'failure',
      resourceId: params.id,
      details: { 
        error: error instanceof Error ? error.message : String(error),
        endpoint: `/api/billing/charges/${params.id}`
      }
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/billing/charges/[id]
 * Delete a charge (only DRAFT charges can be deleted)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const authResult = await authenticateAndAuthorize(request, ['provider', 'admin']);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, code: 'UNAUTHORIZED' },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { id } = params;

    // TODO: Fetch existing charge from database
    const existingCharge = {
      id: id,
      providerId: user.id,
      patientId: 'patient_1',
      status: 'DRAFT'
    };

    // Verify access
    if (user.role !== 'admin' && existingCharge.providerId !== user.id) {
      auditLogger.logSecurity(
        'unauthorized',
        'charge',
        { 
          userId: user.id,
          attemptedResource: id,
          resourceOwner: existingCharge.providerId,
          action: 'delete'
        }
      );

      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Check if charge can be deleted (only DRAFT charges)
    if (existingCharge.status !== 'DRAFT') {
      return NextResponse.json(
        { 
          error: 'Cannot delete submitted charges', 
          code: 'CHARGE_NOT_DELETABLE',
          details: { currentStatus: existingCharge.status }
        },
        { status: 409 }
      );
    }

    // TODO: Delete from database with Prisma
    // await prisma.charge.delete({ where: { id } });

    // Log PHI deletion
    auditLogger.logPHIAccess(
      'delete',
      'charge',
      id,
      existingCharge.patientId,
      { 
        userId: user.id,
        reason: 'User requested deletion'
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Charge deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting charge:', error);
    
    auditLogger.log({
      event: AuditEventType.SYSTEM_ERROR,
      action: 'charge_delete_error',
      result: 'failure',
      resourceId: params.id,
      details: { 
        error: error instanceof Error ? error.message : String(error),
        endpoint: `/api/billing/charges/${params.id}`
      }
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Authentication and authorization helper (shared with main charges route)
 */
async function authenticateAndAuthorize(
  request: NextRequest, 
  allowedRoles: string[]
): Promise<{ success: boolean; user?: any; error?: string; status?: number }> {
  try {
    const headersList = headers();
    const authorization = headersList.get('authorization');
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid authorization header',
        status: 401
      };
    }

    // TODO: Validate JWT token with Cognito
    const mockUser = {
      id: 'provider_123',
      email: 'test-provider@serenity.com',
      role: 'provider',
      name: 'Dr. Test Provider'
    };

    if (!allowedRoles.includes(mockUser.role)) {
      return {
        success: false,
        error: 'Insufficient permissions',
        status: 403
      };
    }

    return {
      success: true,
      user: mockUser
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 401
    };
  }
}