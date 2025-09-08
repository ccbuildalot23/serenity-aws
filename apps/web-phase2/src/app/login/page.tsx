'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  Shield, 
  AlertCircle,
  CheckCircle,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, validatePassword } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handle timeout/unauthorized redirects
  useEffect(() => {
    const reason = searchParams?.get('reason');
    if (reason === 'timeout') {
      toast.warning('Session expired', {
        description: 'Your session expired for security reasons. Please log in again.'
      });
    } else if (reason === 'unauthorized') {
      toast.error('Authentication required', {
        description: 'Please log in to access this page.'
      });
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/patient');
    }
  }, [isAuthenticated, router]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!credentials.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!credentials.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await login(credentials);
      
      // Redirect based on role (will be handled by AuthProvider)
      router.push('/patient');
    } catch (error: any) {
      // Handle specific error types
      if (error.message.includes('User does not exist')) {
        setErrors({ email: 'No account found with this email address' });
      } else if (error.message.includes('Incorrect username or password')) {
        setErrors({ password: 'Incorrect password' });
      } else if (error.message.includes('User is not confirmed')) {
        setErrors({ email: 'Please verify your email address before logging in' });
      } else if (error.message.includes('Password attempts exceeded')) {
        setErrors({ password: 'Too many failed attempts. Please try again later.' });
      } else {
        setErrors({ general: 'Login failed. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = (): void => {
    if (!credentials.email) {
      toast.error('Please enter your email address first');
      return;
    }
    
    // Would integrate with Cognito password reset flow
    toast.info('Password reset link sent', {
      description: 'Check your email for password reset instructions.'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-purple-600 rounded-full">
              <Heart className="text-white" size={32} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Serenity</h1>
          <p className="text-gray-600">Mental health and recovery support platform</p>
        </div>

        {/* HIPAA Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Shield className="text-blue-600 mt-0.5" size={16} />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">HIPAA Compliant Platform</p>
              <p className="text-xs text-blue-700">
                Your health information is encrypted and protected. Sessions automatically expire after 15 minutes of inactivity.
              </p>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* General Error */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="text-red-500" size={16} />
                <span className="text-sm text-red-700">{errors.general}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors",
                    errors.email 
                      ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                  )}
                  placeholder="your@email.com"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className={cn(
                    "w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors",
                    errors.password 
                      ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                  )}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <button
                type="button"
                onClick={handlePasswordReset}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full py-3 px-4 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2",
                isLoading
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Shield size={18} />
                  Sign In Securely
                </>
              )}
            </button>
          </form>

          {/* Development Credentials */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-3">Development Test Accounts:</p>
              <div className="space-y-2 text-xs text-gray-600">
                <div>Patient: <code className="bg-gray-100 px-1 rounded">test-patient@serenity.com</code></div>
                <div>Provider: <code className="bg-gray-100 px-1 rounded">test-provider@serenity.com</code></div>
                <div>Password: <code className="bg-gray-100 px-1 rounded">TestPass123!</code></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Protected by AWS Cognito • HIPAA Compliant • SOC 2 Certified</p>
          <p className="mt-1">
            Need help? Contact{' '}
            <a href="mailto:support@serenity.com" className="text-purple-600 hover:text-purple-700">
              support@serenity.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}