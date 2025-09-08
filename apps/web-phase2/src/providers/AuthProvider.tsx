'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import cognitoAuth, { User, AuthResponse, LoginCredentials } from '@/services/cognitoAuth';
import SessionTimeout from '@/components/compliance/SessionTimeout';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  isAuthenticated: boolean;
  isSessionExpired: () => boolean;
  getSessionTimeRemaining: () => number;
  validatePassword: (password: string) => { valid: boolean; errors: string[] };
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { setUser: setStoreUser, clearUser } = useStore();

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = cognitoAuth.getCurrentUser();
        
        if (currentUser && !cognitoAuth.isSessionExpired()) {
          // Check if session is still valid
          const sessionValid = await cognitoAuth.refreshSession();
          
          if (sessionValid) {
            setUser(currentUser);
            setStoreUser(currentUser);
          } else {
            // Session expired, logout
            await handleLogout();
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth state:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [setStoreUser]);

  const handleLogin = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const authResponse = await cognitoAuth.login(credentials);
      setUser(authResponse.user);
      setStoreUser(authResponse.user);
      
      toast.success('Successfully logged in', {
        description: `Welcome back, ${authResponse.user.name || authResponse.user.email}!`
      });
      
      return authResponse;
    } catch (error) {
      toast.error('Login failed', {
        description: error instanceof Error ? error.message : 'Please check your credentials and try again.'
      });
      throw error;
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await cognitoAuth.logout();
      setUser(null);
      clearUser();
      
      toast.info('Logged out successfully', {
        description: 'You have been securely logged out.'
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if Cognito call fails
      setUser(null);
      clearUser();
    }
  };

  const handleRefreshSession = async (): Promise<boolean> => {
    try {
      const success = await cognitoAuth.refreshSession();
      
      if (!success) {
        await handleLogout();
        return false;
      }
      
      // Update user state with refreshed session info
      const refreshedUser = cognitoAuth.getCurrentUser();
      if (refreshedUser) {
        setUser(refreshedUser);
        setStoreUser(refreshedUser);
      }
      
      return true;
    } catch (error) {
      console.error('Session refresh failed:', error);
      await handleLogout();
      return false;
    }
  };

  const handleSessionTimeout = async (): Promise<void> => {
    toast.error('Session expired', {
      description: 'Your session has expired for security reasons. Please log in again.',
      duration: 5000
    });
    
    await handleLogout();
    
    // Redirect to login page
    window.location.href = '/login?reason=timeout';
  };

  const handleSessionWarning = (): void => {
    toast.warning('Session expiring soon', {
      description: 'Your session will expire in 2 minutes due to inactivity.',
      duration: 4000
    });
  };

  const handleUserActivity = async (): Promise<void> => {
    // Refresh session on user activity if needed
    if (user && cognitoAuth.getSessionTimeRemaining() < 300) { // Less than 5 minutes remaining
      await handleRefreshSession();
    }
  };

  const authContextValue: AuthContextType = {
    user,
    login: handleLogin,
    logout: handleLogout,
    refreshSession: handleRefreshSession,
    isAuthenticated: !!user && !cognitoAuth.isSessionExpired(),
    isSessionExpired: cognitoAuth.isSessionExpired,
    getSessionTimeRemaining: cognitoAuth.getSessionTimeRemaining,
    validatePassword: cognitoAuth.validatePassword
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
      
      {/* HIPAA-compliant session timeout component */}
      <SessionTimeout
        timeoutMinutes={15}
        warningMinutes={2}
        onTimeout={handleSessionTimeout}
        onWarning={handleSessionWarning}
        onActivity={handleUserActivity}
      />
    </AuthContext.Provider>
  );
}

// HOC for protecting routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: User['role']
) {
  return function ProtectedComponent(props: P) {
    const { user, isAuthenticated } = useAuth();
    
    useEffect(() => {
      if (!isAuthenticated) {
        window.location.href = '/login?reason=unauthorized';
        return;
      }
      
      if (requiredRole && user?.role !== requiredRole) {
        window.location.href = '/unauthorized';
        return;
      }
    }, [isAuthenticated, user]);
    
    if (!isAuthenticated || (requiredRole && user?.role !== requiredRole)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view this page.</p>
          </div>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
}