/**
 * Cognito Authentication Service
 * Handles user authentication with AWS Cognito
 */

import apiService from './apiService';
import { auditLogger } from '@/utils/auditLog';

interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
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

  constructor() {
    this.config = {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'
    };

    // Validate configuration
    if (!this.config.userPoolId || !this.config.clientId) {
      console.error('Cognito configuration missing. Authentication will use mock mode.');
    }
  }

  /**
   * Authenticate user with Cognito
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Log authentication attempt
      auditLogger.log({
        event: 'AUTH_ATTEMPT',
        userId: credentials.email,
        metadata: { timestamp: new Date().toISOString() }
      });

      // In production, this would call Cognito's authentication API
      // For development, use mock authentication
      if (!this.config.userPoolId) {
        return this.mockLogin(credentials);
      }

      // Production Cognito authentication would go here
      const response = await fetch(`https://cognito-idp.${this.config.region}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
        },
        body: JSON.stringify({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: this.config.clientId,
          AuthParameters: {
            USERNAME: credentials.email,
            PASSWORD: credentials.password
          }
        })
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      
      // Parse Cognito response
      const authResult: AuthResponse = {
        user: {
          id: data.AuthenticationResult.IdToken, // Parse from JWT
          email: credentials.email,
          role: 'patient' // Would be parsed from token claims
        },
        tokens: {
          idToken: data.AuthenticationResult.IdToken,
          accessToken: data.AuthenticationResult.AccessToken,
          refreshToken: data.AuthenticationResult.RefreshToken,
          expiresIn: data.AuthenticationResult.ExpiresIn
        }
      };

      // Store tokens in API service
      apiService.setTokens(
        authResult.tokens.idToken,
        authResult.tokens.accessToken,
        authResult.tokens.refreshToken,
        authResult.tokens.expiresIn
      );

      // Store current user
      this.currentUser = authResult.user;
      this.saveUserToStorage(authResult.user);

      // Log successful authentication
      auditLogger.log({
        event: 'AUTH_SUCCESS',
        userId: authResult.user.id,
        metadata: { role: authResult.user.role }
      });

      return authResult;
    } catch (error: any) {
      // Log failed authentication
      auditLogger.log({
        event: 'AUTH_FAILURE',
        userId: credentials.email,
        metadata: { error: error.message }
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
      event: 'AUTH_SUCCESS',
      userId: mockUser.id,
      metadata: { role: mockUser.role, mock: true }
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
        event: 'LOGOUT',
        userId: this.currentUser.id,
        metadata: { timestamp: new Date().toISOString() }
      });
    }

    // Clear tokens
    apiService.clearTokens();

    // Clear user data
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_user');
    }

    // In production, would also call Cognito's global sign out
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
   * Refresh session
   */
  async refreshSession(): Promise<boolean> {
    try {
      // This would call Cognito's refresh token API
      // For now, just check if we have a user
      return this.isAuthenticated();
    } catch (error) {
      console.error('Failed to refresh session:', error);
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
      event: 'PASSWORD_CHANGE_ATTEMPT',
      userId: this.currentUser.id,
      metadata: { timestamp: new Date().toISOString() }
    });

    // In production, this would call Cognito's change password API
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 500));

    // Log successful password change
    auditLogger.log({
      event: 'PASSWORD_CHANGE_SUCCESS',
      userId: this.currentUser.id,
      metadata: { timestamp: new Date().toISOString() }
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    // Log password reset request
    auditLogger.log({
      event: 'PASSWORD_RESET_REQUEST',
      userId: email,
      metadata: { timestamp: new Date().toISOString() }
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
      event: 'PASSWORD_RESET_CONFIRM',
      userId: email,
      metadata: { timestamp: new Date().toISOString() }
    });

    // In production, this would call Cognito's confirm forgot password API
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Create singleton instance
const cognitoAuth = new CognitoAuthService();

export default cognitoAuth;
export { type User, type AuthResponse, type LoginCredentials };