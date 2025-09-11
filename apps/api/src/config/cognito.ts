import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import jwksClient from 'jwks-rsa';

// Environment configuration
export const cognitoConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID || '',
  clientId: process.env.COGNITO_CLIENT_ID || '',
  clientSecret: process.env.COGNITO_CLIENT_SECRET || '',
  
  // Development mode settings
  isDevelopment: process.env.NODE_ENV === 'development' || process.env.MOCK_AUTH === 'true',
  
  // HIPAA PHI session timeout (15 minutes)
  phiSessionTimeoutMinutes: parseInt(process.env.PHI_SESSION_TIMEOUT_MINUTES || '15'),
  
  // Token validity
  accessTokenValidityMinutes: 15,
  idTokenValidityMinutes: 15,
  refreshTokenValidityDays: 1, // Shorter for pilot security
};

// Cognito client instance
export const cognitoClient = new CognitoIdentityProviderClient({
  region: cognitoConfig.region,
});

// JWKS client for production token verification
export const jwksClientInstance = cognitoConfig.isDevelopment ? null : jwksClient({
  jwksUri: `https://cognito-idp.${cognitoConfig.region}.amazonaws.com/${cognitoConfig.userPoolId}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

// JWT issuer for token verification
export const jwtIssuer = `https://cognito-idp.${cognitoConfig.region}.amazonaws.com/${cognitoConfig.userPoolId}`;

// User pool groups mapping
export const userGroups = {
  PATIENT: 'Patients',
  PROVIDER: 'Providers',
  SUPPORTER: 'Supporters',
  ADMIN: 'Admins',
} as const;

// Role-based permissions
export const rolePermissions = {
  PATIENT: ['read:own-data', 'write:own-checkin', 'read:own-assessments'],
  PROVIDER: ['read:patient-data', 'write:assessments', 'read:phi-data', 'write:care-plans'],
  SUPPORTER: ['read:limited-patient-data', 'write:support-messages'],
  ADMIN: ['read:all-data', 'write:all-data', 'manage:users'],
} as const;

// Custom attribute mappings
export const customAttributes = {
  role: 'custom:role',
  tenantId: 'custom:tenantId',
} as const;

// Validation helpers
export const isValidRole = (role: string): role is keyof typeof userGroups => {
  return role in userGroups;
};

export const hasPermission = (userRole: string, permission: string): boolean => {
  if (!isValidRole(userRole)) return false;
  const permissions = rolePermissions[userRole];
  return (permissions as readonly string[]).includes(permission);
};

// Development mode mock configuration
export const developmentMockConfig = {
  enabled: cognitoConfig.isDevelopment,
  defaultUsers: {
    patient: {
      id: 'patient-123',
      email: 'patient@serenity.dev',
      role: 'PATIENT' as const,
      tenantId: 'dev-tenant',
      firstName: 'Demo',
      lastName: 'Patient',
    },
    provider: {
      id: 'provider-123',
      email: 'provider@serenity.dev',
      role: 'PROVIDER' as const,
      tenantId: 'dev-tenant',
      firstName: 'Dr. Demo',
      lastName: 'Provider',
    },
    supporter: {
      id: 'supporter-123',
      email: 'supporter@serenity.dev',
      role: 'SUPPORTER' as const,
      tenantId: 'dev-tenant',
      firstName: 'Demo',
      lastName: 'Supporter',
    },
  },
};

// Production security headers
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
};

export default cognitoConfig;