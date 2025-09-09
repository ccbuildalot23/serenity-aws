import { NextRequest, NextResponse } from 'next/server';
import { CognitoJwtVerifier } from "aws-jwt-verify";

// Function to check if running in development without Cognito config
const isDevMode = () => !process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || !process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

// Function to get verifier instance
const getVerifier = () => {
  if (isDevMode()) return null;
  
  return CognitoJwtVerifier.create({
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
    tokenUse: "id",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
  });
};

interface CognitoUser {
  sub: string;
  email: string;
  email_verified: boolean;
  'cognito:username': string;
  'custom:role'?: string;
  'custom:tenantId'?: string;
  given_name?: string;
  family_name?: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

interface TransformedUser {
  id: string;
  email: string;
  role: 'patient' | 'provider' | 'supporter' | 'admin';
  firstName?: string;
  lastName?: string;
  name?: string;
  tenantId?: string;
  sessionExpiresAt?: Date;
  lastActivity?: Date;
}

/**
 * GET /api/auth/me
 * Returns current authenticated user information with proper attribute mapping
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No valid authorization token provided' }, 
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify and decode JWT token (or mock in development)
    let payload: CognitoUser;
    
    if (isDevMode()) {
      // Mock verification for development
      if (token.includes('invalid') || token === 'expired-token') {
        return NextResponse.json(
          { error: 'Invalid or expired token' }, 
          { status: 401 }
        );
      }
      
      // Mock valid payload for development
      const now = Math.floor(Date.now() / 1000);
      const role = token.includes('provider') ? 'provider' : 
                   token.includes('supporter') ? 'supporter' :
                   token.includes('admin') ? 'admin' : 'patient';
      
      payload = {
        sub: 'mock-user-123',
        email: `test-${role}@serenity.com`,
        email_verified: true,
        'cognito:username': `test-${role}`,
        'custom:role': role,
        'custom:tenantId': 'mock-tenant-123',
        given_name: 'Test',
        family_name: 'User',
        aud: 'mock-audience',
        iss: 'mock-issuer',
        iat: now - 300, // 5 minutes ago
        exp: now + 3600, // 1 hour from now
      };
    } else {
      // Real Cognito verification
      try {
        const verifier = getVerifier();
        payload = await verifier!.verify(token) as CognitoUser;
      } catch (error) {
        console.error('Token verification failed:', error);
        return NextResponse.json(
          { error: 'Invalid or expired token' }, 
          { status: 401 }
        );
      }

      // Verify payload has required fields
      if (!payload || !payload.iat || !payload.exp) {
        console.error('Invalid token payload:', payload);
        return NextResponse.json(
          { error: 'Invalid token payload' }, 
          { status: 401 }
        );
      }
    }

    // Map Cognito attributes to our user format
    const transformedUser: TransformedUser = {
      // Username → id (primary identifier)
      id: payload['cognito:username'] || payload.sub,
      
      // Direct email mapping  
      email: payload.email,
      
      // custom:role → role with fallback to 'patient'
      role: (payload['custom:role'] as 'patient' | 'provider' | 'supporter' | 'admin') || 'patient',
      
      // given_name → firstName
      firstName: payload.given_name,
      
      // family_name → lastName  
      lastName: payload.family_name,
      
      // Combine names if available
      name: payload.given_name && payload.family_name 
        ? `${payload.given_name} ${payload.family_name}`
        : payload.given_name || payload.family_name || undefined,
      
      // custom:tenantId → tenantId
      tenantId: payload['custom:tenantId'],
      
      // Calculate session expiration (15 minutes from token issue for PHI compliance)
      sessionExpiresAt: new Date(payload.iat * 1000 + 15 * 60 * 1000), // 15 minutes
      
      // Set current time as last activity
      lastActivity: new Date()
    };

    return NextResponse.json({ 
      user: transformedUser,
      success: true 
    });

  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/auth/me
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}