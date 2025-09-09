# AWS Cognito GetUser Attribute Mapping & JWT Validation Best Practices Summary

## Overview
This document summarizes best practices for AWS Cognito GetUser attribute mapping and JWT validation patterns with 15-minute PHI session timeouts for HIPAA-compliant applications.

## 1. AWS Cognito GetUser Attribute Mapping

### Production-Ready Attribute Mapping Pattern
```typescript
interface CognitoAttribute {
  Name?: string;
  Value?: string;
}

interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
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
    // Username → id mapping
    id: username || attributeMap.get('sub') || '',
    email: attributeMap.get('email') || '',
    
    // Standard attribute mappings
    firstName: attributeMap.get('given_name'),
    lastName: attributeMap.get('family_name'),
    
    // Custom attribute mappings
    role: (attributeMap.get('custom:role') as UserProfile['role']) || 'PATIENT',
    tenantId: attributeMap.get('custom:tenantId') || 'default-tenant',
    emailVerified: attributeMap.get('email_verified') === 'true',
  };
}
```

### Key Mapping Rules
- **Username → id**: Use `username` from GetUser response or `sub` claim
- **given_name → firstName**: Standard Cognito attribute
- **family_name → lastName**: Standard Cognito attribute
- **custom:role → role**: Custom attribute for role-based access control
- **custom:tenantId → tenantId**: Custom attribute for multi-tenancy

### Error Handling Pattern
```typescript
function mapCognitoUserResponse(
  cognitoUser: GetUserCommandOutput
): { user: UserProfile; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!cognitoUser.UserAttributes) {
    warnings.push('No user attributes found in Cognito response');
  }

  const user = mapCognitoAttributes(
    cognitoUser.UserAttributes,
    cognitoUser.Username
  );

  // Validate required fields with sensible defaults
  if (!user.role || !['PATIENT', 'PROVIDER', 'SUPPORTER', 'ADMIN'].includes(user.role)) {
    warnings.push(`Invalid or missing role: ${user.role}`);
    user.role = 'PATIENT'; // Safe default
  }

  return { user, warnings };
}
```

## 2. JWT Validation with 15-Minute PHI Session Timeout

### Production JWT Validation Pattern
```typescript
export interface PHITokenPayload {
  sub: string;
  email: string;
  'cognito:groups': string[];
  'custom:role': string;
  'custom:tenantId': string;
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
  aud: string;
  iss: string;
}

/**
 * HIPAA-compliant JWT validation with 15-minute PHI access timeout
 */
export class PHITokenValidator {
  async validateToken(token: string): Promise<PHITokenPayload> {
    // Step 1: Verify signature and standard claims
    const payload = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`,
      clockTolerance: 5 // Allow 5 seconds clock skew
    }) as PHITokenPayload;

    // Step 2: PHI compliance - 15-minute session timeout using 'iat'
    this.validatePHISession(payload);

    return payload;
  }

  /**
   * HIPAA PHI access validation - 15-minute session timeout using 'iat' claim
   */
  private validatePHISession(payload: PHITokenPayload): void {
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - payload.iat; // Calculate age using issued at timestamp
    const PHI_SESSION_TIMEOUT = 15 * 60; // 15 minutes in seconds

    if (tokenAge > PHI_SESSION_TIMEOUT) {
      throw new TokenValidationError(
        'PHI_SESSION_EXPIRED',
        `Session exceeded 15-minute limit for PHI access (${Math.round(tokenAge / 60)} minutes old)`
      );
    }
  }
}
```

### Express Middleware Implementation
```typescript
/**
 * Express middleware for PHI-compliant authentication
 */
export function createPHIAuthMiddleware(userPoolId: string, region?: string) {
  const validator = new PHITokenValidator(userPoolId, region);

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.substring(7);
      if (!token) {
        return res.status(401).json({
          error: 'No valid authorization token provided',
          code: 'NO_TOKEN'
        });
      }

      const payload = await validator.validateToken(token);

      // Map token claims to user object
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload['custom:role'],
        tenantId: payload['custom:tenantId'],
      };

      next();

    } catch (error) {
      if (error.code === 'PHI_SESSION_EXPIRED') {
        return res.status(401).json({
          error: 'Session expired for PHI access - re-authentication required',
          code: 'PHI_SESSION_EXPIRED'
        });
      }
      
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
  };
}
```

## 3. Key Implementation Insights

### AWS SDK v3 Pattern
- Use `@aws-sdk/client-cognito-identity-provider` with `CognitoIdentityProviderClient`
- GetUser requires user's access token with `aws.cognito.signin.user.admin` scope
- No IAM policies involved - purely token-based authorization

### PHI/HIPAA Compliance Guidelines
- **15-minute session timeout**: Enforced using `iat` (issued at) claim, not just `exp`
- **Minimal PII in tokens**: Avoid sensitive data in JWT payload
- **Clock tolerance**: Allow 5-second skew for distributed systems
- **Audit logging**: Log all PHI access and session timeouts

### Error Classification
```typescript
enum TokenError {
  INVALID_FORMAT = 'INVALID_FORMAT',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  PHI_SESSION_EXPIRED = 'PHI_SESSION_EXPIRED', // Special for 15-min timeout
  INVALID_ISSUER = 'INVALID_ISSUER'
}
```

### Production Considerations
1. **Token Refresh**: Implement proper refresh token flow for seamless UX
2. **Session Extension**: Allow users to extend session before timeout
3. **Monitoring**: Track session timeout events for security monitoring
4. **Client Handling**: Provide clear guidance on retry vs. re-authentication

## 4. Complete Working Example

```typescript
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

export class SecureUserService {
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    // Step 1: Validate token for PHI access (15-minute check)
    const tokenPayload = await this.validator.validateToken(accessToken);

    // Step 2: Get user details from Cognito
    const getUserCommand = new GetUserCommand({
      AccessToken: accessToken
    });

    const cognitoUser = await this.cognitoClient.send(getUserCommand);
    
    // Step 3: Map attributes safely with the established patterns
    const { user, warnings } = mapCognitoUserResponse(cognitoUser);

    if (warnings.length > 0) {
      console.warn('User attribute mapping warnings:', warnings);
    }

    return user;
  }
}
```

This approach provides a production-ready foundation for HIPAA-compliant AWS Cognito integration with proper attribute mapping and JWT validation including 15-minute PHI session timeouts.