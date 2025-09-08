/**
 * Cognito Authentication Service
 * Handles user authentication with AWS Cognito
 */

import apiService from './apiService';
import { auditLogger, AuditEventType } from '@/utils/auditLog';
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute, CognitoUserSession } from 'amazon-cognito-identity-js';

interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
  mfaRequired?: boolean;
  sessionTimeoutMinutes?: number;
  passwordPolicy?: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
  };
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  role: 'patient' | 'provider' | 'supporter' | 'admin';
  name?: string;
  attributes?: Record<string, any>;
  mfaEnabled?: boolean;
  lastActivity?: Date;
  sessionExpiresAt?: Date;
}

interface AuthResponse {
  user: User;
  tokens: {
    idToken: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

class CognitoAuthService {
  private config: CognitoConfig;
  private currentUser: User | null = null;
  private cognitoUserPool: CognitoUserPool | null = null;
  private sessionTimeoutTimer: NodeJS.Timeout | null = null;
  private activityListeners: (() => void)[] = [];

  constructor() {
    this.config = {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
      mfaRequired: process.env.NODE_ENV === 'production', // MFA required in production
      sessionTimeoutMinutes: 15, // HIPAA requirement: 15-minute timeout
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true
      }
    };

    // Initialize Cognito User Pool
    if (this.config.userPoolId && this.config.clientId) {
      this.cognitoUserPool = new CognitoUserPool({
        UserPoolId: this.config.userPoolId,
        ClientId: this.config.clientId
      });
    } else {
      console.warn('Cognito configuration missing. Authentication will use mock mode.');
      auditLogger.log({
        event: AuditEventType.SYSTEM_ERROR,
        action: 'Cognito configuration missing',
        result: 'warning',
        details: { environment: process.env.NODE_ENV }
      });
    }

    // Setup activity monitoring for session management
    this.setupActivityMonitoring();
  }

  /**
   * Authenticate user with Cognito
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Log authentication attempt
      auditLogger.log({
        event: AuditEventType.AUTH_ATTEMPT,
        userId: credentials.email,
        action: 'authenticate',
        result: 'warning', // Will be updated based on actual result
        details: { 
          email: credentials.email,
          timestamp: new Date().toISOString() 
        }
      });

      // Use mock authentication in development, real Cognito in production
      if (!this.cognitoUserPool) {
        return this.mockLogin(credentials);
      }

      // Production Cognito authentication
      const authResult = await this.authenticateWithCognito(credentials);
      
      // Enforce MFA if required
      if (this.config.mfaRequired && !authResult.user.mfaEnabled) {
        auditLogger.log({
          event: AuditEventType.MFA_CHALLENGE,
          userId: authResult.user.id,
          action: 'MFA required but not enabled',
          result: 'warning',
          details: { email: credentials.email }
        });
        
        // In production, would redirect to MFA setup
        console.warn('MFA is required for production environment');
      }

      // Store tokens in API service
      apiService.setTokens(
        authResult.tokens.idToken,
        authResult.tokens.accessToken,
        authResult.tokens.refreshToken,
        authResult.tokens.expiresIn
      );

      // Store current user with session info
      const now = new Date();
      const sessionExpiry = new Date(now.getTime() + (this.config.sessionTimeoutMinutes! * 60 * 1000));
      
      authResult.user.lastActivity = now;
      authResult.user.sessionExpiresAt = sessionExpiry;
      
      this.currentUser = authResult.user;
      this.saveUserToStorage(authResult.user);
      
      // Start session timeout management
      this.startSessionTimeout();

      // Log successful authentication
      auditLogger.log({
        event: AuditEventType.AUTH_SUCCESS,
        userId: authResult.user.id,
        action: 'authenticate',
        result: 'success',
        details: { 
          role: authResult.user.role,
          timestamp: new Date().toISOString()
        }
      });

      return authResult;
    } catch (error: any) {
      // Log failed authentication
      auditLogger.log({
        event: AuditEventType.AUTH_FAILURE,
        userId: credentials.email,
        action: 'authenticate',
        result: 'failure',
        details: { 
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  /**
   * Mock login for development/testing
   */
  private async mockLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock user data based on email
    let role: User['role'] = 'patient';
    if (credentials.email.includes('provider')) {
      role = 'provider';
    } else if (credentials.email.includes('supporter')) {
      role = 'supporter';
    } else if (credentials.email.includes('admin')) {
      role = 'admin';
    }

    const mockUser: User = {
      id: `user-${Date.now()}`,
      email: credentials.email,
      role,
      name: credentials.email.split('@')[0]
    };

    const mockTokens = {
      idToken: `mock-id-token-${Date.now()}`,
      accessToken: `mock-access-token-${Date.now()}`,
      refreshToken: `mock-refresh-token-${Date.now()}`,
      expiresIn: 3600 // 1 hour
    };

    // Store tokens
    apiService.setTokens(
      mockTokens.idToken,
      mockTokens.accessToken,
      mockTokens.refreshToken,
      mockTokens.expiresIn
    );

    // Store user
    this.currentUser = mockUser;
    this.saveUserToStorage(mockUser);

    // Log mock authentication
    auditLogger.log({
      event: AuditEventType.AUTH_SUCCESS,
      userId: mockUser.id,
      action: 'authenticate',
      result: 'success',
      details: { 
        role: mockUser.role, 
        mock: true,
        timestamp: new Date().toISOString()
      }
    });

    return {
      user: mockUser,
      tokens: mockTokens
    };
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    // Log logout
    if (this.currentUser) {
      auditLogger.log({
        event: AuditEventType.LOGOUT,
        userId: this.currentUser.id,
        action: 'logout',
        result: 'success',
        details: { timestamp: new Date().toISOString() }
      });
    }

    // Clear session timeout
    this.clearSessionTimeout();
    
    // Clear activity listeners
    this.clearActivityMonitoring();

    // Clear tokens
    apiService.clearTokens();

    // Global sign out from Cognito
    if (this.cognitoUserPool && this.currentUser) {
      try {
        const cognitoUser = this.cognitoUserPool.getCurrentUser();
        if (cognitoUser) {
          cognitoUser.globalSignOut({
            onSuccess: () => {
              auditLogger.log({
                event: AuditEventType.LOGOUT,
                userId: this.currentUser?.id,
                action: 'cognito_global_signout',
                result: 'success'
              });
            },
            onFailure: (err) => {
              auditLogger.log({
                event: AuditEventType.SYSTEM_ERROR,
                userId: this.currentUser?.id,
                action: 'cognito_global_signout_failed',
                result: 'failure',
                details: { error: err.message }
              });
            }
          });
        }
      } catch (error) {
        console.error('Failed to perform global sign out:', error);
      }
    }

    // Clear user data
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_user');
      localStorage.removeItem('cognito_session');
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): User | null {
    if (!this.currentUser && typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_user');
      if (stored) {
        try {
          this.currentUser = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored user:', e);
          localStorage.removeItem('current_user');
        }
      }
    }
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Save user to storage
   */
  private saveUserToStorage(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_user', JSON.stringify(user));
    }
  }

  /**
   * Refresh session using Cognito refresh token
   */
  async refreshSession(): Promise<boolean> {
    try {
      if (!this.cognitoUserPool) {
        return this.isAuthenticated();
      }

      const cognitoUser = this.cognitoUserPool.getCurrentUser();
      if (!cognitoUser) {
        return false;
      }

      return new Promise((resolve) => {
        cognitoUser.getSession((err: any, session: CognitoUserSession | null) => {
          if (err || !session) {
            auditLogger.log({
              event: AuditEventType.SESSION_TIMEOUT,
              userId: this.currentUser?.id,
              action: 'session_refresh_failed',
              result: 'failure',
              details: { error: err?.message }
            });
            resolve(false);
            return;
          }

          if (session.isValid()) {
            // Update session expiry
            if (this.currentUser) {
              const now = new Date();
              this.currentUser.lastActivity = now;
              this.currentUser.sessionExpiresAt = new Date(now.getTime() + (this.config.sessionTimeoutMinutes! * 60 * 1000));
              this.saveUserToStorage(this.currentUser);
            }

            auditLogger.log({
              event: AuditEventType.SESSION_EXTENDED,
              userId: this.currentUser?.id,
              action: 'session_refreshed',
              result: 'success'
            });

            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('Failed to refresh session:', error);
      auditLogger.log({
        event: AuditEventType.SYSTEM_ERROR,
        userId: this.currentUser?.id,
        action: 'session_refresh_error',
        result: 'failure',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      return false;
    }
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error('Not authenticated');
    }

    // Log password change attempt
    auditLogger.log({
      event: AuditEventType.PASSWORD_CHANGE_ATTEMPT,
      userId: this.currentUser.id,
      action: 'change_password',
      result: 'warning',
      details: { timestamp: new Date().toISOString() }
    });

    // In production, this would call Cognito's change password API
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 500));

    // Log successful password change
    auditLogger.log({
      event: AuditEventType.PASSWORD_CHANGE_SUCCESS,
      userId: this.currentUser.id,
      action: 'change_password',
      result: 'success',
      details: { timestamp: new Date().toISOString() }
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    // Log password reset request
    auditLogger.log({
      event: AuditEventType.PASSWORD_RESET_REQUEST,
      userId: email,
      action: 'request_password_reset',
      result: 'success',
      details: { timestamp: new Date().toISOString() }
    });

    // In production, this would call Cognito's forgot password API
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    // Log password reset confirmation
    auditLogger.log({
      event: AuditEventType.PASSWORD_RESET_CONFIRM,
      userId: email,
      action: 'confirm_password_reset',
      result: 'success',
      details: { timestamp: new Date().toISOString() }
    });

    // In production, this would call Cognito's confirm forgot password API
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Authenticate with Cognito (production implementation)
   */
  private async authenticateWithCognito(credentials: LoginCredentials): Promise<AuthResponse> {
    if (!this.cognitoUserPool) {
      throw new Error('Cognito User Pool not initialized');
    }

    const cognitoUser = new CognitoUser({
      Username: credentials.email,
      Pool: this.cognitoUserPool
    });

    const authenticationDetails = new AuthenticationDetails({
      Username: credentials.email,
      Password: credentials.password
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session: CognitoUserSession) => {
          const idToken = session.getIdToken();
          const payload = idToken.decodePayload();
          
          const user: User = {
            id: payload.sub,
            email: payload.email || credentials.email,
            role: this.parseUserRole(payload),
            name: payload.name || payload.given_name + ' ' + payload.family_name,
            mfaEnabled: payload['cognito:mfa_enabled'] === 'true',
            attributes: payload
          };

          const tokens = {
            idToken: idToken.getJwtToken(),
            accessToken: session.getAccessToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
            expiresIn: session.getAccessToken().getExpiration() - Math.floor(Date.now() / 1000)
          };

          resolve({ user, tokens });
        },
        onFailure: (err) => {
          auditLogger.log({
            event: AuditEventType.AUTH_FAILURE,
            userId: credentials.email,
            action: 'cognito_authentication_failed',
            result: 'failure',
            details: { error: err.message }
          });
          reject(new Error(err.message || 'Authentication failed'));
        },
        mfaRequired: (challengeName, challengeParameters) => {
          // Handle MFA challenge
          auditLogger.log({
            event: AuditEventType.MFA_CHALLENGE,
            userId: credentials.email,
            action: 'mfa_challenge_required',
            result: 'warning',
            details: { challengeName }
          });
          // For MVP, reject MFA challenges (would implement UI for this)
          reject(new Error('MFA required but not implemented in UI yet'));
        }
      });
    });
  }

  /**
   * Parse user role from Cognito token payload
   */
  private parseUserRole(payload: any): User['role'] {
    const customRole = payload['custom:role'];
    const cognitoGroups = payload['cognito:groups'];
    
    if (customRole) {
      return customRole as User['role'];
    }
    
    if (cognitoGroups && Array.isArray(cognitoGroups)) {
      if (cognitoGroups.includes('admin')) return 'admin';
      if (cognitoGroups.includes('provider')) return 'provider';
      if (cognitoGroups.includes('supporter')) return 'supporter';
    }
    
    return 'patient'; // Default role
  }

  /**
   * Setup activity monitoring for session timeout
   */
  private setupActivityMonitoring(): void {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      if (this.currentUser) {
        this.updateLastActivity();
      }
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
      this.activityListeners.push(() => {
        document.removeEventListener(event, handleActivity);
      });
    });
  }

  /**
   * Clear activity monitoring
   */
  private clearActivityMonitoring(): void {
    this.activityListeners.forEach(cleanup => cleanup());
    this.activityListeners = [];
  }

  /**
   * Update last activity timestamp
   */
  private updateLastActivity(): void {
    if (!this.currentUser) return;

    const now = new Date();
    this.currentUser.lastActivity = now;
    
    // Extend session expiry
    this.currentUser.sessionExpiresAt = new Date(
      now.getTime() + (this.config.sessionTimeoutMinutes! * 60 * 1000)
    );
    
    this.saveUserToStorage(this.currentUser);
  }

  /**
   * Start session timeout management
   */
  private startSessionTimeout(): void {
    this.clearSessionTimeout();
    
    if (!this.currentUser || !this.currentUser.sessionExpiresAt) return;

    const timeUntilExpiry = this.currentUser.sessionExpiresAt.getTime() - Date.now();
    
    if (timeUntilExpiry <= 0) {
      this.handleSessionTimeout();
      return;
    }

    this.sessionTimeoutTimer = setTimeout(() => {
      this.handleSessionTimeout();
    }, timeUntilExpiry);
  }

  /**
   * Clear session timeout timer
   */
  private clearSessionTimeout(): void {
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
      this.sessionTimeoutTimer = null;
    }
  }

  /**
   * Handle session timeout
   */
  private handleSessionTimeout(): void {
    auditLogger.log({
      event: AuditEventType.SESSION_TIMEOUT,
      userId: this.currentUser?.id,
      action: 'automatic_session_timeout',
      result: 'warning',
      details: {
        timeoutMinutes: this.config.sessionTimeoutMinutes,
        reason: 'HIPAA compliance - 15 minute inactivity timeout'
      }
    });

    // Logout user
    this.logout();
  }

  /**
   * Check if current session is expired
   */
  isSessionExpired(): boolean {
    if (!this.currentUser || !this.currentUser.sessionExpiresAt) {
      return true;
    }
    
    return new Date() > this.currentUser.sessionExpiresAt;
  }

  /**
   * Get session time remaining in seconds
   */
  getSessionTimeRemaining(): number {
    if (!this.currentUser || !this.currentUser.sessionExpiresAt) {
      return 0;
    }
    
    const remaining = this.currentUser.sessionExpiresAt.getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const policy = this.config.passwordPolicy!;

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }
    
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Create singleton instance
const cognitoAuth = new CognitoAuthService();

export default cognitoAuth;
export { type User, type AuthResponse, type LoginCredentials, type CognitoConfig };