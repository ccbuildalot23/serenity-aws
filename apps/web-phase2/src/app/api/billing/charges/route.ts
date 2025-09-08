/**
 * Billing Charges API Endpoint
 * Handles CRUD operations for billing charges
 * Provider/Admin access only with comprehensive audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { validateChargeCreate, validateExportRequest } from '@/lib/billing/validation';
import { scrubCharge } from '@/lib/billing/scrub';
import { exportCharges } from '@/lib/billing/export';
import { auditLogger, AuditEventType } from '@/utils/auditLog';
import cognitoAuth from '@/services/cognitoAuth';

/**
 * GET /api/billing/charges
 * List charges for the authenticated provider with filtering
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract user from authentication headers/session
    const authResult = await authenticateAndAuthorize(request, ['provider', 'admin']);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, code: 'UNAUTHORIZED' },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const patientId = searchParams.get('patientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query filters (org-scoped)
    const filters: any = {
      providerId: user.role === 'admin' ? undefined : user.id, // Admin can see all
    };

    if (status) filters.status = status;
    if (patientId) filters.patientId = patientId;
    if (startDate) filters.createdAt = { ...filters.createdAt, gte: new Date(startDate) };
    if (endDate) filters.createdAt = { ...filters.createdAt, lte: new Date(endDate) };

    // TODO: Implement actual database query with Prisma
    // For MVP, return mock data
    const mockCharges = [
      {
        id: 'charge_1',
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Log PHI access
    auditLogger.logPHIAccess(
      'view',
      'charge',
      'multiple',
      undefined, // No specific patient
      { 
        filters,
        resultCount: mockCharges.length,
        userId: user.id 
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        charges: mockCharges,
        pagination: {
          limit,
          offset,
          total: mockCharges.length,
          hasMore: false
        }
      }
    });

  } catch (error) {
    console.error('Error fetching charges:', error);
    
    auditLogger.log({
      event: AuditEventType.SYSTEM_ERROR,
      action: 'fetch_charges_error',
      result: 'failure',
      details: { 
        error: error instanceof Error ? error.message : String(error),
        endpoint: '/api/billing/charges'
      }
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/charges
 * Create a new billing charge with validation and scrubbing
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate and authorize
    const authResult = await authenticateAndAuthorize(request, ['provider', 'admin']);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error, code: 'UNAUTHORIZED' },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const body = await request.json();

    // Validate request data
    let validatedData;
    try {
      validatedData = validateChargeCreate({
        ...body,
        providerId: user.id // Ensure provider can only create charges for themselves
      });
    } catch (validationError: any) {
      auditLogger.log({
        event: AuditEventType.SYSTEM_ERROR,
        userId: user.id,
        action: 'charge_validation_failed',
        result: 'failure',
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

    // Scrub the charge data for CMS-1500 compliance
    const scrubResult = scrubCharge(validatedData);
    if (!scrubResult.isValid) {
      auditLogger.log({
        event: AuditEventType.SYSTEM_ERROR,
        userId: user.id,
        action: 'charge_scrub_failed',
        result: 'failure',
        details: { 
          scrubErrors: scrubResult.errors,
          scrubWarnings: scrubResult.warnings
        }
      });

      return NextResponse.json(
        {
          error: 'Charge data failed compliance check',
          code: 'SCRUB_ERROR',
          details: {
            errors: scrubResult.errors,
            warnings: scrubResult.warnings
          }
        },
        { status: 400 }
      );
    }

    // TODO: Save to database with Prisma
    const newCharge = {
      id: `charge_${Date.now()}`,
      ...validatedData,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Log billing event
    auditLogger.log({
      event: AuditEventType.PHI_CREATE,
      userId: user.id,
      action: 'charge_created',
      result: 'success',
      resourceType: 'charge',
      resourceId: newCharge.id,
      details: {
        cptCode: validatedData.cptCode,
        chargeAmount: validatedData.chargeAmount,
        patientId: validatedData.patientId,
        scrubWarnings: scrubResult.warnings.length
      }
    });

    // Emit analytics event
    // TODO: Implement analytics service
    // analytics.track('billing_charge_created', {
    //   userId: user.id,
    //   chargeId: newCharge.id,
    //   cptCode: validatedData.cptCode,
    //   amount: validatedData.chargeAmount
    // });

    return NextResponse.json({
      success: true,
      data: {
        charge: newCharge,
        scrubResult: {
          warnings: scrubResult.warnings,
          isCompliant: true
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating charge:', error);
    
    auditLogger.log({
      event: AuditEventType.SYSTEM_ERROR,
      action: 'charge_creation_error',
      result: 'failure',
      details: { 
        error: error instanceof Error ? error.message : String(error),
        endpoint: '/api/billing/charges'
      }
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Authentication and authorization helper
 */
async function authenticateAndAuthorize(
  request: NextRequest, 
  allowedRoles: string[]
): Promise<{ success: boolean; user?: any; error?: string; status?: number }> {
  try {
    // Extract authorization header
    const headersList = headers();
    const authorization = headersList.get('authorization');
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid authorization header',
        status: 401
      };
    }

    const token = authorization.substring(7);
    
    // TODO: Validate JWT token with Cognito
    // For MVP, return mock user based on token
    const mockUser = {
      id: 'provider_123',
      email: 'test-provider@serenity.com',
      role: 'provider',
      name: 'Dr. Test Provider'
    };

    // Check role authorization
    if (!allowedRoles.includes(mockUser.role)) {
      auditLogger.logSecurity(
        'denied',
        '/api/billing/charges',
        { 
          userId: mockUser.id,
          requiredRoles: allowedRoles,
          userRole: mockUser.role 
        }
      );

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

/**
 * Extract client IP address for audit logging
 */
function getClientIP(request: NextRequest): string {
  const headersList = headers();
  return (
    headersList.get('x-forwarded-for') ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') ||
    'unknown'
  );
}