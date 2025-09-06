import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminAddUserToGroupCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as jwksRsa from 'jwks-rsa';
import { promisify } from 'util';

// Types
export interface AuthUser {
  id: string;
  email: string;
  role: 'PATIENT' | 'PROVIDER' | 'SUPPORTER' | 'ADMIN';
  tenantId: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  'cognito:groups': string[];
  'custom:tenantId': string;
  'custom:role': string;
  iat: number;
  exp: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// AWS Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// JWKS client for token verification
const jwksClient = jwksRsa.default || jwksRsa;
const jwksClientInstance = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

const getSigningKey = promisify(jwksClientInstance.getSigningKey.bind(jwksClientInstance));

export class AuthService {
  /**
   * Verify JWT token from Cognito
   */
  static async verifyToken(token: string): Promise<TokenPayload> {
    // Decode token header to get key ID
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    // Get signing key from JWKS
    const key = await getSigningKey(decoded.header.kid);
    if (!key) {
      throw new Error('Unable to find signing key');
    }
    const signingKey = key.getPublicKey();

    // Verify token
    const payload = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
    }) as TokenPayload;

    return payload;
  }

  /**
   * Create a new user in Cognito
   */
  static async createUser(email: string, password: string, role: string, tenantId: string) {
    const command = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:role', Value: role },
        { Name: 'custom:tenantId', Value: tenantId },
      ],
      TemporaryPassword: password,
      MessageAction: 'SUPPRESS', // Don't send welcome email
    });

    const response = await cognitoClient.send(command);
    
    // Set permanent password
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    });
    
    await cognitoClient.send(setPasswordCommand);

    // Add user to appropriate group
    const addToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email,
      GroupName: `${role}s`, // e.g., "Patients", "Providers"
    });
    
    await cognitoClient.send(addToGroupCommand);

    return response.User;
  }

  /**
   * Get user details from Cognito
   */
  static async getUser(username: string) {
    const command = new AdminGetUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
    });

    const response = await cognitoClient.send(command);
    return response;
  }

  /**
   * Express middleware to verify authentication
   */
  static authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.substring(7);
      const payload = await AuthService.verifyToken(token);

      // Check token expiration (15-minute session for HIPAA)
      const now = Math.floor(Date.now() / 1000);
      const tokenAge = now - payload.iat;
      const fifteenMinutes = 15 * 60;

      if (tokenAge > fifteenMinutes) {
        return res.status(401).json({ error: 'Session expired for PHI access' });
      }

      // Extract user info from token
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload['custom:role'] as AuthUser['role'],
        tenantId: payload['custom:tenantId'],
      };

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  /**
   * Express middleware to check user role
   */
  static authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  };

  /**
   * Check if session needs re-authentication for sensitive operations
   */
  static requireRecentAuth = (maxAge: number = 5 * 60) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(401).json({ error: 'Re-authentication required' });
        }

        const token = authHeader.substring(7);
        const payload = await AuthService.verifyToken(token);
        
        const now = Math.floor(Date.now() / 1000);
        const tokenAge = now - payload.iat;

        if (tokenAge > maxAge) {
          return res.status(401).json({ 
            error: 'Re-authentication required for this operation',
            code: 'REAUTH_REQUIRED' 
          });
        }

        next();
      } catch (error) {
        return res.status(401).json({ error: 'Authentication failed' });
      }
    };
  };
}