import { NextRequest, NextResponse } from 'next/server';
import { CognitoJwtVerifier } from "aws-jwt-verify";

// Function to check if running in development without Cognito config
const isDevMode = () => !process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || !process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

// Function to get verifier instance
const getVerifier = () => {
  if (isDevMode()) return null;
  
  return CognitoJwtVerifier.create({
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
    tokenUse: "access",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
  });
};

interface CognitoPayload {
  sub: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  username: string;
  'cognito:groups'?: string[];
}

interface SessionValidationResponse {
  valid: boolean;
  reason?: string;
  expiresAt?: string;
  timeRemaining?: number;
}

/**
 * POST /api/auth/verify-session
 * Verifies session validity with 15-minute PHI timeout enforcement
 * Returns session status and remaining time
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json<SessionValidationResponse>(
        { 
          valid: false, 
          reason: 'No authorization token provided' 
        }, 
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token (or mock in development)
    let payload: CognitoPayload;
    
    if (isDevMode()) {
      // Mock verification for development
      if (token.includes('invalid') || token === 'expired-token') {
        return NextResponse.json<SessionValidationResponse>(
          { 
            valid: false, 
            reason: 'Invalid or expired token' 
          }, 
          { status: 401 }
        );
      }
      
      // Mock valid payload for development
      const now = Math.floor(Date.now() / 1000);
      payload = {
        sub: 'mock-user-123',
        aud: 'mock-audience',
        iss: 'mock-issuer', 
        iat: now - 300, // 5 minutes ago
        exp: now + 3600, // 1 hour from now
        username: 'mock-user'
      };
    } else {
      // Real Cognito verification
      try {
        const verifier = getVerifier();
        payload = await verifier!.verify(token) as CognitoPayload;
      } catch (error) {
        console.error('Token verification failed:', error);
        return NextResponse.json<SessionValidationResponse>(
          { 
            valid: false, 
            reason: 'Invalid or expired token' 
          }, 
          { status: 401 }
        );
      }

      // Verify payload has required fields
      if (!payload || !payload.iat || !payload.exp) {
        console.error('Invalid token payload:', payload);
        return NextResponse.json<SessionValidationResponse>(
          { 
            valid: false, 
            reason: 'Invalid token payload' 
          }, 
          { status: 401 }
        );
      }
    }

    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const tokenIssuedAt = payload.iat; // Token issued time in seconds
    const tokenExpiresAt = payload.exp; // Token expiration in seconds
    
    // HIPAA Compliance: 15-minute PHI session timeout
    const PHI_SESSION_TIMEOUT_SECONDS = 15 * 60; // 15 minutes
    const phiSessionExpiresAt = tokenIssuedAt + PHI_SESSION_TIMEOUT_SECONDS;
    
    // Check if PHI session has expired (15 minutes from token issue)
    if (now >= phiSessionExpiresAt) {
      return NextResponse.json<SessionValidationResponse>(
        { 
          valid: false, 
          reason: 'PHI session expired (15-minute timeout)',
          expiresAt: new Date(phiSessionExpiresAt * 1000).toISOString(),
          timeRemaining: 0
        }, 
        { status: 401 }
      );
    }
    
    // Check if underlying JWT token has expired
    if (now >= tokenExpiresAt) {
      return NextResponse.json<SessionValidationResponse>(
        { 
          valid: false, 
          reason: 'JWT token expired',
          expiresAt: new Date(tokenExpiresAt * 1000).toISOString(),
          timeRemaining: 0
        }, 
        { status: 401 }
      );
    }
    
    // Calculate remaining time (use the shorter of PHI timeout or JWT expiration)
    const phiTimeRemaining = phiSessionExpiresAt - now;
    const jwtTimeRemaining = tokenExpiresAt - now;
    const timeRemaining = Math.min(phiTimeRemaining, jwtTimeRemaining);
    
    // Session is valid
    return NextResponse.json<SessionValidationResponse>(
      { 
        valid: true,
        expiresAt: new Date(Math.min(phiSessionExpiresAt, tokenExpiresAt) * 1000).toISOString(),
        timeRemaining: timeRemaining
      }, 
      { status: 200 }
    );

  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json<SessionValidationResponse>(
      { 
        valid: false, 
        reason: 'Internal server error' 
      }, 
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/verify-session
 * Alternative endpoint for session verification (same logic)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}

/**
 * OPTIONS /api/auth/verify-session
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}