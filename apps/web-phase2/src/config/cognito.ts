// Cognito configuration for web-phase2 application
export const cognitoConfig = {
  // AWS Region
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
  
  // Cognito User Pool configuration
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
  
  // OAuth configuration for SPA with PKCE
  oauth: {
    domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
    scope: ['email', 'openid', 'profile'],
    redirectSignIn: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_SIGNIN || 
      (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'http://localhost:3000/auth/callback'),
    redirectSignOut: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_SIGNOUT || 
      (typeof window !== 'undefined' ? `${window.location.origin}/auth/logout` : 'http://localhost:3000/auth/logout'),
    responseType: 'code' as const, // PKCE flow
  },
  
  // Development mode settings
  isDevelopment: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_MOCK_AUTH === 'true',
  
  // Session configuration
  sessionTimeout: {
    // HIPAA PHI session timeout (15 minutes)
    phiTimeoutMinutes: parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES || '15'),
    // Warning before session expires (2 minutes before)
    warningTimeoutMinutes: 2,
    // Idle timeout for non-PHI operations (30 minutes)
    idleTimeoutMinutes: 30,
  },
  
  // Security settings
  security: {
    // Enable audit logging
    enableAuditLogging: process.env.NEXT_PUBLIC_ENABLE_AUDIT_LOGGING === 'true',
    // Enforce HTTPS in production
    enforceHttps: process.env.NODE_ENV === 'production',
    // Enable MFA requirement indicator
    requireMfa: process.env.NODE_ENV === 'production',
  },
  
  // API configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    timeout: 30000, // 30 seconds
  },
};

// User role mappings (matches Cognito groups)
export const userRoles = {
  PATIENT: 'PATIENT',
  PROVIDER: 'PROVIDER',
  SUPPORTER: 'SUPPORTER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = keyof typeof userRoles;

// Route permissions by role
export const routePermissions = {
  '/patient': ['PATIENT'],
  '/provider': ['PROVIDER', 'ADMIN'],
  '/supporter': ['SUPPORTER', 'ADMIN'],
  '/admin': ['ADMIN'],
  '/auth': ['PATIENT', 'PROVIDER', 'SUPPORTER', 'ADMIN'], // All authenticated users
} as const;

// PHI access routes (require recent authentication)
export const phiRoutes = [
  '/patient/check-in',
  '/patient/assessments',
  '/provider/patients',
  '/provider/analytics',
  '/supporter/alerts',
] as const;

// Development mock users (only used in development mode)
export const mockUsers = {
  patient: {
    id: 'patient-123',
    email: 'patient@serenity.dev',
    role: 'PATIENT' as const,
    tenantId: 'dev-tenant',
    firstName: 'Demo',
    lastName: 'Patient',
    groups: ['Patients'],
  },
  provider: {
    id: 'provider-123',
    email: 'provider@serenity.dev',
    role: 'PROVIDER' as const,
    tenantId: 'dev-tenant',
    firstName: 'Dr. Demo',
    lastName: 'Provider',
    groups: ['Providers'],
  },
  supporter: {
    id: 'supporter-123',
    email: 'supporter@serenity.dev',
    role: 'SUPPORTER' as const,
    tenantId: 'dev-tenant',
    firstName: 'Demo',
    lastName: 'Supporter',
    groups: ['Supporters'],
  },
  admin: {
    id: 'admin-123',
    email: 'admin@serenity.dev',
    role: 'ADMIN' as const,
    tenantId: 'dev-tenant',
    firstName: 'Demo',
    lastName: 'Admin',
    groups: ['Admins'],
  },
};

// Validation helpers
export const isValidRole = (role: string): role is UserRole => {
  return Object.values(userRoles).includes(role as UserRole);
};

export const hasRouteAccess = (userRole: UserRole, route: string): boolean => {
  // Find the most specific route match
  const routeKey = Object.keys(routePermissions).find(key => route.startsWith(key));
  if (!routeKey) return false;
  
  const allowedRoles = routePermissions[routeKey as keyof typeof routePermissions];
  return allowedRoles.includes(userRole);
};

export const isPhiRoute = (route: string): boolean => {
  return phiRoutes.some(phiRoute => route.startsWith(phiRoute));
};

// Token storage keys
export const storageKeys = {
  accessToken: 'serenity_access_token',
  refreshToken: 'serenity_refresh_token',
  idToken: 'serenity_id_token',
  user: 'serenity_user',
  sessionStart: 'serenity_session_start',
  lastActivity: 'serenity_last_activity',
} as const;

// Security headers for production
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

export default cognitoConfig;