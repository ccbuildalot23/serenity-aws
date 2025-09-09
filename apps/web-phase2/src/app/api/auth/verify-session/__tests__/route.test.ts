/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';
import { POST, GET } from '../route';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Mock NextResponse.json to return proper Response objects
const originalNextResponseJson = NextResponse.json;
NextResponse.json = jest.fn((body: any, init?: ResponseInit) => {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
}) as any;

// Mock the CognitoJwtVerifier
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(),
    })),
  },
}));

const mockVerifier = {
  verify: jest.fn(),
};

describe('/api/auth/verify-session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CognitoJwtVerifier.create as jest.Mock).mockReturnValue(mockVerifier);
    // Clear env vars to force dev mode for consistent test behavior
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  });

  describe('POST /api/auth/verify-session', () => {
    it('returns 401 when no authorization header is provided', async () => {
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('No authorization token provided');
    });

    it('returns 401 when authorization header is malformed', async () => {
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Authorization': 'InvalidFormat token123',
        },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('No authorization token provided');
    });

    it('returns 401 when token verification fails', async () => {
      mockVerifier.verify.mockRejectedValue(new Error('Invalid token'));
      
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('Invalid or expired token');
      expect(mockVerifier.verify).toHaveBeenCalledWith('invalid-token');
    });

    it('returns valid session when within 15-minute PHI timeout', async () => {
      // Dev mode uses mock payload internally based on current time
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.timeRemaining).toBeGreaterThan(0);
      expect(data.expiresAt).toBeTruthy();
    });

    it('returns 401 when PHI session has expired (15 minutes)', async () => {
      // Dev mode creates mock token with 15-min expiry, but we can't simulate expired easily
      // Instead test with mock that simulates expired token
      jest.spyOn(Date, 'now').mockReturnValue(new Date().getTime() + (20 * 60 * 1000)); // 20 min future
      
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token', // Will be expired due to mocked time
        },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('PHI session expired (15-minute timeout)');
      expect(data.timeRemaining).toBe(0);
      
      jest.restoreAllMocks();
    });

    it('returns 401 when JWT token has expired', async () => {
      const now = Math.floor(Date.now() / 1000);
      const issuedAt = now - 300; // 5 minutes ago (within PHI limit)
      const expiresAt = now - 60; // JWT expired 1 minute ago
      
      const mockCognitoPayload = {
        sub: 'cognito-uuid-123',
        username: 'user123',
        aud: 'client-id',
        iss: 'cognito-issuer',
        iat: issuedAt,
        exp: expiresAt,
      };

      mockVerifier.verify.mockResolvedValue(mockCognitoPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer expired-jwt-token',
        },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('JWT token expired');
      expect(data.timeRemaining).toBe(0);
    });

    it('uses the shorter timeout (PHI vs JWT)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const issuedAt = now - 300; // 5 minutes ago
      const expiresAt = now + 300; // JWT expires in 5 minutes (shorter than PHI 10 minutes remaining)
      
      const mockCognitoPayload = {
        sub: 'cognito-uuid-123',
        username: 'user123',
        aud: 'client-id',
        iss: 'cognito-issuer',
        iat: issuedAt,
        exp: expiresAt,
      };

      mockVerifier.verify.mockResolvedValue(mockCognitoPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      
      // Should use JWT expiry (5 minutes) instead of PHI expiry (10 minutes remaining)
      const jwtExpiry = new Date(expiresAt * 1000);
      const actualExpiry = new Date(data.expiresAt);
      expect(actualExpiry.getTime()).toBe(jwtExpiry.getTime());
      
      // Time remaining should be approximately 5 minutes (JWT expires sooner)
      expect(data.timeRemaining).toBeLessThanOrEqual(300);
      expect(data.timeRemaining).toBeGreaterThan(299); // Allow for timing variance
    });

    it('handles malformed payload gracefully', async () => {
      // Mock a payload missing required fields
      const malformedPayload = {
        sub: 'cognito-uuid-123',
        aud: 'client-id',
        iss: 'cognito-issuer',
        // Missing required iat and exp fields
        username: 'user123'
      };

      mockVerifier.verify.mockResolvedValue(malformedPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer malformed-payload-token',
        },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.valid).toBe(false);
      expect(data.reason).toBe('Invalid token payload');
    });

    it('calculates time remaining correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const issuedAt = now - 600; // 10 minutes ago
      const expiresAt = now + 3600; // 1 hour from now
      
      const mockCognitoPayload = {
        sub: 'cognito-uuid-123',
        username: 'user123',
        aud: 'client-id',
        iss: 'cognito-issuer',
        iat: issuedAt,
        exp: expiresAt,
      };

      mockVerifier.verify.mockResolvedValue(mockCognitoPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      
      // PHI expires in 5 minutes (15 minutes from issue - 10 minutes elapsed)
      expect(data.timeRemaining).toBeLessThanOrEqual(300);
      expect(data.timeRemaining).toBeGreaterThan(299);
    });
  });

  describe('GET /api/auth/verify-session', () => {
    it('works the same as POST', async () => {
      const now = Math.floor(Date.now() / 1000);
      const issuedAt = now - 300;
      const expiresAt = now + 3600;
      
      const mockCognitoPayload = {
        sub: 'cognito-uuid-123',
        username: 'user123',
        aud: 'client-id',
        iss: 'cognito-issuer',
        iat: issuedAt,
        exp: expiresAt,
      };

      mockVerifier.verify.mockResolvedValue(mockCognitoPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/verify-session', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.timeRemaining).toBeGreaterThan(0);
    });
  });
});