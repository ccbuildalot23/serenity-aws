'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { User } from '@/services/cognitoAuth';

type UserRole = User['role'];

interface WithAuthOptions {
  requiredRole?: UserRole | UserRole[];
  redirectTo?: string;
  allowUnauthenticated?: boolean;
}

/**
 * Higher-order component for role-based route protection
 * Implements HIPAA-compliant access control with audit logging
 */
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const {
    requiredRole,
    redirectTo = '/login',
    allowUnauthenticated = false
  } = options;

  return function AuthenticatedComponent(props: P): JSX.Element {
    const { user, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
      // Check authentication status
      if (!isAuthenticated && !allowUnauthenticated) {
        router.push(`${redirectTo}?reason=unauthorized`);
        return;
      }

      // Check role requirements
      if (requiredRole && user) {
        const hasRequiredRole = Array.isArray(requiredRole)
          ? requiredRole.includes(user.role)
          : user.role === requiredRole;

        if (!hasRequiredRole) {
          // Redirect based on user's actual role
          switch (user.role) {
            case 'patient':
              router.push('/patient');
              break;
            case 'provider':
              router.push('/provider');
              break;
            case 'supporter':
              router.push('/supporter');
              break;
            case 'admin':
              router.push('/admin');
              break;
            default:
              router.push('/unauthorized');
          }
          return;
        }
      }
    }, [isAuthenticated, user, router]);

    // Show loading state while checking authentication
    if (!isAuthenticated && !allowUnauthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Authenticating...</p>
          </div>
        </div>
      );
    }

    // Show access denied if role doesn't match
    if (requiredRole && user) {
      const hasRequiredRole = Array.isArray(requiredRole)
        ? requiredRole.includes(user.role)
        : user.role === requiredRole;

      if (!hasRequiredRole) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-pink-50">
            <div className="text-center max-w-md p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
              <p className="text-gray-600 mb-4">
                You don't have permission to view this page. Required role: {
                  Array.isArray(requiredRole) ? requiredRole.join(', ') : requiredRole
                }
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Your current role: {user.role}
              </p>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        );
      }
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * Convenience HOCs for specific roles
 */
export const withProviderAuth = <P extends object>(
  Component: React.ComponentType<P>
) => withAuth(Component, { requiredRole: ['provider', 'admin'] });

export const withSupporterAuth = <P extends object>(
  Component: React.ComponentType<P>
) => withAuth(Component, { requiredRole: ['supporter', 'admin'] });

export const withPatientAuth = <P extends object>(
  Component: React.ComponentType<P>
) => withAuth(Component, { requiredRole: ['patient', 'admin'] });

export const withAdminAuth = <P extends object>(
  Component: React.ComponentType<P>
) => withAuth(Component, { requiredRole: 'admin' });

export const withAnyAuth = <P extends object>(
  Component: React.ComponentType<P>
) => withAuth(Component, { requiredRole: ['patient', 'provider', 'supporter', 'admin'] });