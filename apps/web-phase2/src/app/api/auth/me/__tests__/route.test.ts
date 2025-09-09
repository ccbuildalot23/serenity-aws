/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../route';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

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

describe('/api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CognitoJwtVerifier.create as jest.Mock).mockReturnValue(mockVerifier);
    // Clear env vars to force dev mode for consistent test behavior
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when no authorization header is provided', async () => {
      const request = new NextRequest('http://localhost:3001/api/auth/me');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('No valid authorization token provided');
    });

    it('returns 401 when authorization header is malformed', async () => {
      const request = new NextRequest('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': 'InvalidFormat token123',
        },
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('No valid authorization token provided');
    });

    it('returns 401 when token verification fails', async () => {
      mockVerifier.verify.mockRejectedValue(new Error('Invalid token'));
      
      const request = new NextRequest('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid or expired token');
      expect(mockVerifier.verify).toHaveBeenCalledWith('invalid-token');
    });

    it('correctly maps Cognito attributes to user object', async () => {
      const mockCognitoPayload = {
        sub: 'cognito-uuid-123',
        'cognito:username': 'user123',
        email: 'test@serenity.com',
        email_verified: true,
        'custom:role': 'patient',
        'custom:tenantId': 'tenant-456',
        given_name: 'John',
        family_name: 'Doe',
        aud: 'client-id',
        iss: 'cognito-issuer',
        iat: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      mockVerifier.verify.mockResolvedValue(mockCognitoPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toEqual({
        id: 'user123', // cognito:username → id
        email: 'test@serenity.com', // email → email
        role: 'patient', // custom:role → role
        firstName: 'John', // given_name → firstName
        lastName: 'Doe', // family_name → lastName
        name: 'John Doe', // Combined name
        tenantId: 'tenant-456', // custom:tenantId → tenantId
        sessionExpiresAt: expect.any(String), // 15 minutes from token issue
        lastActivity: expect.any(String), // Current timestamp
      });

      // Verify session expiry is set correctly (15 minutes from token issue)
      const expectedExpiry = new Date(mockCognitoPayload.iat * 1000 + 15 * 60 * 1000);
      const actualExpiry = new Date(data.user.sessionExpiresAt);
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000); // Within 1 second
    });

    it('handles missing optional attributes gracefully', async () => {
      const mockCognitoPayload = {
        sub: 'cognito-uuid-123',
        'cognito:username': 'user123',
        email: 'test@serenity.com',
        email_verified: true,
        // Missing: custom:role, custom:tenantId, given_name, family_name
        aud: 'client-id',
        iss: 'cognito-issuer',
        iat: Math.floor(Date.now() / 1000) - 300,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockVerifier.verify.mockResolvedValue(mockCognitoPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user).toEqual({
        id: 'user123',
        email: 'test@serenity.com',
        role: 'patient', // Default fallback
        firstName: undefined,
        lastName: undefined,
        name: undefined,
        tenantId: undefined,
        sessionExpiresAt: expect.any(String),
        lastActivity: expect.any(String),
      });
    });

    it('falls back to sub for id when cognito:username is missing', async () => {
      const mockCognitoPayload = {
        sub: 'cognito-uuid-123',
        // Missing: cognito:username
        email: 'test@serenity.com',
        email_verified: true,
        'custom:role': 'provider',
        aud: 'client-id',
        iss: 'cognito-issuer',
        iat: Math.floor(Date.now() / 1000) - 300,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockVerifier.verify.mockResolvedValue(mockCognitoPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user.id).toBe('cognito-uuid-123'); // Falls back to sub
      expect(data.user.role).toBe('provider');
    });

    it('handles different user roles correctly', async () => {
      const roles = ['patient', 'provider', 'supporter', 'admin'];
      
      for (const role of roles) {
        const mockCognitoPayload = {
          sub: 'cognito-uuid-123',
          'cognito:username': 'user123',
          email: 'test@serenity.com',
          email_verified: true,
          'custom:role': role,
          aud: 'client-id',
          iss: 'cognito-issuer',
          iat: Math.floor(Date.now() / 1000) - 300,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        mockVerifier.verify.mockResolvedValue(mockCognitoPayload);
        
        const request = new NextRequest('http://localhost:3001/api/auth/me', {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        });
        
        const response = await GET(request);
        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.user.role).toBe(role);
      }
    });

    it('handles malformed payload gracefully', async () => {
      // Mock a payload missing required fields
      const malformedPayload = {
        sub: 'cognito-uuid-123',
        // Missing required iat and exp fields
        email: 'test@serenity.com',
      };

      mockVerifier.verify.mockResolvedValue(malformedPayload);
      
      const request = new NextRequest('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': 'Bearer malformed-payload-token',
        },
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid token payload');
    });
  });
});