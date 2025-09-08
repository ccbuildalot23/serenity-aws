'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      // PRD: Redirect to appropriate dashboard based on user role
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
          router.push('/patient'); // Default fallback
      }
    } else {
      // Not authenticated, redirect to login
      router.push('/login');
    }
  }, [isAuthenticated, user, router]);

  // Show loading state while checking authentication
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Serenity...</p>
      </div>
    </div>
  );
}
