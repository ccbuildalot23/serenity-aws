# AWS Cognito GetUser Attribute Mapping Patterns & JWT Validation

## Overview

This document provides production-ready patterns for AWS Cognito UserAttributes mapping, JWT token validation with 15-minute PHI compliance timeout, and comprehensive error handling for healthcare applications.

## 1. UserAttributes Mapping Patterns

### Standard Cognito Attributes Mapping

```typescript
interface CognitoAttribute {
  Name?: string;
  Value?: string;
}

interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'PATIENT' | 'PROVIDER' | 'SUPPORTER' | 'ADMIN';
  tenantId: string;
  emailVerified?: boolean;
}

/**
 * Map Cognito UserAttributes array to clean user object
 * Handles both standard and custom attributes safely
 */
function mapCognitoAttributes(
  userAttributes: CognitoAttribute[] = [],
  username?: string
): UserProfile {
  const attributeMap = new Map<string, string>();
  
  // Build efficient lookup map
  userAttributes.forEach(attr => {
    if (attr.Name && attr.Value) {
      attributeMap.set(attr.Name, attr.Value);
    }
  });

  return {
    id: username || attributeMap.get('sub') || '',
    email: attributeMap.get('email') || '',
    firstName: attributeMap.get('given_name'),
    lastName: attributeMap.get('family_name'),
    phone: attributeMap.get('phone_number'),
    role: (attributeMap.get('custom:role') as UserProfile['role']) || 'PATIENT',
    tenantId: attributeMap.get('custom:tenantId') || 'default-tenant',
    emailVerified: attributeMap.get('email_verified') === 'true',
  };
}
```

### Enhanced Attribute Mapping with Error Handling

```typescript
import { GetUserCommandOutput } from '@aws-sdk/client-cognito-identity-provider';

/**
 * Enhanced attribute mapping with validation and error handling
 */
function mapCognitoUserResponse(
  cognitoUser: GetUserCommandOutput
): { user: UserProfile; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!cognitoUser.UserAttributes) {
    warnings.push('No user attributes found in Cognito response');
  }

  if (!cognitoUser.Username) {
    warnings.push('No username found in Cognito response');
  }

  const user = mapCognitoAttributes(
    cognitoUser.UserAttributes,
    cognitoUser.Username
  );

  // Validate required fields
  if (!user.email) {
    warnings.push('Email attribute missing - potential data integrity issue');
  }

  if (!user.role || !['PATIENT', 'PROVIDER', 'SUPPORTER', 'ADMIN'].includes(user.role)) {
    warnings.push(`Invalid or missing role: ${user.role}`);
    user.role = 'PATIENT'; // Safe default
  }

  if (!user.tenantId) {
    warnings.push('TenantId missing - using default tenant');
    user.tenantId = 'default-tenant';
  }

  return { user, warnings };
}
```

## 2. Custom Attributes Handling

### Setting Custom Attributes

```typescript
/**
 * Create user with custom attributes following HIPAA compliance patterns
 */
async function createUserWithCustomAttributes(
  cognitoClient: CognitoIdentityProviderClient,
  userPool: string,
  userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    organizationId?: string;
    department?: string;
  }
) {
  const userAttributes = [
    { Name: 'email', Value: userData.email },
    { Name: 'email_verified', Value: 'true' },
    { Name: 'given_name', Value: userData.firstName },
    { Name: 'family_name', Value: userData.lastName },
    // Custom attributes for role-based access
    { Name: 'custom:role', Value: userData.role },
    { Name: 'custom:tenantId', Value: userData.tenantId },
  ];

  // Optional organizational attributes
  if (userData.organizationId) {
    userAttributes.push({ 
      Name: 'custom:organizationId', 
      Value: userData.organizationId 
    });
  }

  if (userData.department) {
    userAttributes.push({ 
      Name: 'custom:department', 
      Value: userData.department 
    });
  }

  const command = new AdminCreateUserCommand({
    UserPoolId: userPool,
    Username: userData.email,
    UserAttributes: userAttributes,
    MessageAction: 'SUPPRESS',
  });

  return await cognitoClient.send(command);
}
```

### Reading Custom Attributes with Type Safety

```typescript
/**
 * Type-safe custom attribute extraction
 */
interface CustomAttributes {
  role?: string;
  tenantId?: string;
  organizationId?: string;
  department?: string;
  lastLoginDate?: string;
  permissions?: string; // JSON string of permissions array
}

function extractCustomAttributes(userAttributes: CognitoAttribute[]): CustomAttributes {
  const customs: CustomAttributes = {};
  
  userAttributes.forEach(attr => {
    if (!attr.Name?.startsWith('custom:') || !attr.Value) return;
    
    const key = attr.Name.replace('custom:', '') as keyof CustomAttributes;
    customs[key] = attr.Value;
  });

  return customs;
}
```

## 3. JWT Token Validation with 15-Minute Timeout

### Production-Ready JWT Validation

```typescript
import jwt from 'jsonwebtoken';
import * as jwksRsa from 'jwks-rsa';
import { promisify } from 'util';

export interface PHITokenPayload {
  sub: string;
  email: string;
  'cognito:groups': string[];
  'custom:role': string;
  'custom:tenantId': string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  token_use: 'access' | 'id';
}

export enum TokenError {
  INVALID_FORMAT = 'INVALID_FORMAT',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  PHI_SESSION_EXPIRED = 'PHI_SESSION_EXPIRED',
  INVALID_ISSUER = 'INVALID_ISSUER',
  INVALID_AUDIENCE = 'INVALID_AUDIENCE',
  SIGNING_KEY_NOT_FOUND = 'SIGNING_KEY_NOT_FOUND'
}

export class TokenValidationError extends Error {
  constructor(
    public code: TokenError,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

/**
 * HIPAA-compliant JWT validation with 15-minute PHI access timeout
 */
export class PHITokenValidator {
  private jwksClient: jwksRsa.JwksClient;
  private getSigningKey: (kid: string) => Promise<jwksRsa.SigningKey>;

  constructor(
    private userPoolId: string,
    private region: string = 'us-east-1',
    private clientId?: string
  ) {
    this.jwksClient = jwksRsa({
      jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    
    this.getSigningKey = promisify(this.jwksClient.getSigningKey.bind(this.jwksClient));
  }

  /**
   * Validate JWT token with PHI compliance checks
   */
  async validateToken(token: string): Promise<PHITokenPayload> {
    // Step 1: Decode token without verification to get header
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new TokenValidationError(
        TokenError.INVALID_FORMAT,
        'Token format is invalid'
      );
    }

    try {
      // Step 2: Get signing key
      const key = await this.getSigningKey(decoded.header.kid);
      const signingKey = key.getPublicKey();

      // Step 3: Verify token signature and claims
      const payload = jwt.verify(token, signingKey, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`,
        ...(this.clientId && { audience: this.clientId }),
      }) as PHITokenPayload;

      // Step 4: PHI compliance - 15-minute session timeout
      this.validatePHISession(payload);

      return payload;

    } catch (error) {
      if (error instanceof TokenValidationError) {
        throw error;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        if (error.name === 'TokenExpiredError') {
          throw new TokenValidationError(
            TokenError.TOKEN_EXPIRED,
            'Token has expired',
            error
          );
        }
        throw new TokenValidationError(
          TokenError.SIGNATURE_INVALID,
          'Token signature is invalid',
          error
        );
      }

      throw new TokenValidationError(
        TokenError.SIGNING_KEY_NOT_FOUND,
        'Unable to verify token signature',
        error as Error
      );
    }
  }

  /**
   * HIPAA PHI access validation - 15-minute session timeout
   */
  private validatePHISession(payload: PHITokenPayload): void {
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - payload.iat;
    const PHI_SESSION_TIMEOUT = 15 * 60; // 15 minutes in seconds

    if (tokenAge > PHI_SESSION_TIMEOUT) {
      throw new TokenValidationError(
        TokenError.PHI_SESSION_EXPIRED,
        `Session exceeded 15-minute limit for PHI access (${Math.round(tokenAge / 60)} minutes old)`
      );
    }
  }

  /**
   * Check if token needs refresh for continued PHI access
   */
  needsRefresh(payload: PHITokenPayload, bufferMinutes: number = 2): boolean {
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - payload.iat;
    const refreshThreshold = (15 - bufferMinutes) * 60;

    return tokenAge > refreshThreshold;
  }
}
```

### Express Middleware Implementation

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
  tokenPayload?: PHITokenPayload;
}

/**
 * Express middleware for PHI-compliant authentication
 */
export function createPHIAuthMiddleware(
  userPoolId: string,
  region?: string,
  clientId?: string
) {
  const validator = new PHITokenValidator(userPoolId, region, clientId);

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'No valid authorization token provided',
          code: 'NO_TOKEN'
        });
      }

      const token = authHeader.substring(7);
      const payload = await validator.validateToken(token);

      // Attach user info to request
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload['custom:role'],
        tenantId: payload['custom:tenantId'],
      };
      
      req.tokenPayload = payload;

      // Warn if token needs refresh soon
      if (validator.needsRefresh(payload)) {
        res.setHeader('X-Token-Refresh-Needed', 'true');
      }

      next();

    } catch (error) {
      if (error instanceof TokenValidationError) {
        const statusCode = getStatusCodeForTokenError(error.code);
        return res.status(statusCode).json({
          error: error.message,
          code: error.code
        });
      }

      console.error('Unexpected authentication error:', error);
      return res.status(500).json({
        error: 'Authentication service unavailable',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
  };
}

/**
 * Map token error types to appropriate HTTP status codes
 */
function getStatusCodeForTokenError(errorCode: TokenError): number {
  switch (errorCode) {
    case TokenError.INVALID_FORMAT:
    case TokenError.SIGNATURE_INVALID:
    case TokenError.INVALID_ISSUER:
    case TokenError.INVALID_AUDIENCE:
      return 401; // Unauthorized - invalid token
    
    case TokenError.TOKEN_EXPIRED:
    case TokenError.PHI_SESSION_EXPIRED:
      return 401; // Unauthorized - expired token
    
    case TokenError.SIGNING_KEY_NOT_FOUND:
      return 503; // Service unavailable - infrastructure issue
    
    default:
      return 401;
  }
}
```

## 4. Error Handling Patterns

### Comprehensive Error Classification

```typescript
/**
 * Detailed error handling for different failure scenarios
 */
export class CognitoErrorHandler {
  /**
   * Handle GetUser API errors with appropriate responses
   */
  static handleGetUserError(error: any): { 
    statusCode: number; 
    message: string; 
    code: string;
    retryable: boolean;
  } {
    const errorName = error.name || error.__type;

    switch (errorName) {
      case 'NotAuthorizedException':
        return {
          statusCode: 401,
          message: 'Access token is invalid or expired',
          code: 'INVALID_TOKEN',
          retryable: false
        };

      case 'UserNotConfirmedException':
        return {
          statusCode: 403,
          message: 'User account not confirmed',
          code: 'ACCOUNT_NOT_CONFIRMED',
          retryable: false
        };

      case 'UserNotFoundException':
        return {
          statusCode: 404,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          retryable: false
        };

      case 'TooManyRequestsException':
        return {
          statusCode: 429,
          message: 'Too many requests - rate limited',
          code: 'RATE_LIMITED',
          retryable: true
        };

      case 'InternalErrorException':
        return {
          statusCode: 500,
          message: 'Cognito service temporarily unavailable',
          code: 'SERVICE_ERROR',
          retryable: true
        };

      default:
        return {
          statusCode: 500,
          message: 'Unexpected authentication error',
          code: 'UNKNOWN_ERROR',
          retryable: false
        };
    }
  }

  /**
   * Enhanced error response with security considerations
   */
  static createErrorResponse(error: any, includeDetails: boolean = false) {
    const handled = this.handleGetUserError(error);
    
    const response: any = {
      success: false,
      error: handled.message,
      code: handled.code
    };

    // Include retry information for client
    if (handled.retryable) {
      response.retryAfter = this.calculateRetryDelay(handled.code);
    }

    // Only include detailed error info in development
    if (includeDetails && process.env.NODE_ENV === 'development') {
      response.details = {
        originalError: error.message,
        stack: error.stack
      };
    }

    return { statusCode: handled.statusCode, body: response };
  }

  private static calculateRetryDelay(errorCode: string): number {
    switch (errorCode) {
      case 'RATE_LIMITED':
        return 60; // 1 minute
      case 'SERVICE_ERROR':
        return 30; // 30 seconds
      default:
        return 5; // 5 seconds
    }
  }
}
```

### Client-Side Error Handling

```typescript
/**
 * Client-side error handling for PHI session management
 */
export class PHISessionManager {
  private refreshTimer?: NodeJS.Timeout;

  async handleAuthError(error: any): Promise<'retry' | 'refresh' | 'logout'> {
    const errorCode = error.response?.data?.code;

    switch (errorCode) {
      case 'PHI_SESSION_EXPIRED':
        // Force re-authentication for PHI access
        this.clearSession();
        return 'logout';

      case 'TOKEN_EXPIRED':
        // Standard token expiration - try refresh
        return 'refresh';

      case 'INVALID_TOKEN':
      case 'SIGNATURE_INVALID':
        // Invalid token - clear and re-authenticate
        this.clearSession();
        return 'logout';

      case 'RATE_LIMITED':
        // Temporary rate limit - retry after delay
        await this.delay(error.response?.data?.retryAfter * 1000 || 5000);
        return 'retry';

      default:
        console.error('Unhandled auth error:', error);
        return 'logout';
    }
  }

  private clearSession(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    // Clear stored tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 5. Usage Examples

### Complete Authentication Flow

```typescript
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

/**
 * Complete user profile retrieval with PHI compliance
 */
export class SecureUserService {
  private cognitoClient: CognitoIdentityProviderClient;
  private validator: PHITokenValidator;

  constructor(
    private userPoolId: string,
    private region: string = 'us-east-1'
  ) {
    this.cognitoClient = new CognitoIdentityProviderClient({ region });
    this.validator = new PHITokenValidator(userPoolId, region);
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    // Step 1: Validate token for PHI access
    const tokenPayload = await this.validator.validateToken(accessToken);

    // Step 2: Get user details from Cognito
    const getUserCommand = new GetUserCommand({
      AccessToken: accessToken
    });

    try {
      const cognitoUser = await this.cognitoClient.send(getUserCommand);
      
      // Step 3: Map attributes safely
      const { user, warnings } = mapCognitoUserResponse(cognitoUser);

      // Step 4: Log warnings for monitoring
      if (warnings.length > 0) {
        console.warn('User attribute mapping warnings:', warnings);
      }

      return user;

    } catch (error) {
      const errorResponse = CognitoErrorHandler.handleGetUserError(error);
      throw new Error(`GetUser failed: ${errorResponse.message}`);
    }
  }
}

// Usage
const userService = new SecureUserService(
  process.env.COGNITO_USER_POOL_ID!,
  process.env.AWS_REGION
);

app.get('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.substring(7);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const userProfile = await userService.getUserProfile(token);
    
    res.json({
      success: true,
      user: userProfile
    });

  } catch (error) {
    const errorResponse = CognitoErrorHandler.createErrorResponse(
      error,
      process.env.NODE_ENV === 'development'
    );
    
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
});
```

## Key Takeaways

1. **Attribute Mapping**: Use Map-based lookups for efficient attribute extraction and provide sensible defaults for missing attributes.

2. **PHI Compliance**: Implement strict 15-minute session timeouts for PHI access with clear error messages.

3. **Error Classification**: Distinguish between expired tokens, invalid tokens, and service errors with appropriate HTTP status codes.

4. **Security**: Never expose sensitive error details in production and implement proper token refresh flows.

5. **Monitoring**: Log attribute mapping warnings and authentication failures for security monitoring.

6. **Client Experience**: Provide clear guidance to clients on whether to retry, refresh tokens, or re-authenticate based on error types.

This pattern ensures HIPAA compliance while providing a robust, production-ready authentication system for healthcare applications.