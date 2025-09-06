'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Clock, 
  AlertTriangle,
  LogOut,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

interface SessionTimeoutProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
  onTimeout?: () => void;
  onWarning?: () => void;
  onActivity?: () => void;
}

export default function SessionTimeout({
  timeoutMinutes = 15,
  warningMinutes = 2,
  onTimeout,
  onWarning,
  onActivity
}: SessionTimeoutProps) {
  const { user, logout } = useStore();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeoutMinutes * 60);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const warningTimeoutRef = useRef<NodeJS.Timeout>();
  const sessionTimeoutRef = useRef<NodeJS.Timeout>();
  const countdownRef = useRef<NodeJS.Timeout>();

  // Convert to milliseconds
  const TIMEOUT_MS = timeoutMinutes * 60 * 1000;
  const WARNING_MS = (timeoutMinutes - warningMinutes) * 60 * 1000;

  // Reset timers on user activity
  const resetTimers = useCallback(() => {
    // Clear existing timers
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Reset state
    setShowWarning(false);
    setTimeRemaining(timeoutMinutes * 60);
    setLastActivity(Date.now());

    // Log activity for audit
    if (onActivity) onActivity();

    // Set warning timer
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      if (onWarning) onWarning();
      
      // Start countdown
      let seconds = warningMinutes * 60;
      countdownRef.current = setInterval(() => {
        seconds -= 1;
        setTimeRemaining(seconds);
        
        if (seconds <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      }, 1000);
    }, WARNING_MS);

    // Set session timeout
    sessionTimeoutRef.current = setTimeout(() => {
      handleTimeout();
    }, TIMEOUT_MS);
  }, [timeoutMinutes, warningMinutes, WARNING_MS, TIMEOUT_MS, onActivity, onWarning]);

  // Handle session timeout
  const handleTimeout = useCallback(() => {
    // Clear all timers
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Log timeout event
    const auditLog = {
      event: 'SESSION_TIMEOUT',
      timestamp: new Date().toISOString(),
      userId: user?.id,
      reason: 'Inactivity timeout after 15 minutes'
    };
    
    // Store in localStorage for now (would go to backend in production)
    const logs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
    logs.push(auditLog);
    localStorage.setItem('auditLogs', JSON.stringify(logs));

    // Callback
    if (onTimeout) onTimeout();

    // Logout user
    logout();
    
    // Redirect to login
    window.location.href = '/login?reason=timeout';
  }, [user, logout, onTimeout]);

  // Continue session
  const continueSession = useCallback(() => {
    resetTimers();
    
    // Log session extension
    const auditLog = {
      event: 'SESSION_EXTENDED',
      timestamp: new Date().toISOString(),
      userId: user?.id,
      action: 'User continued session before timeout'
    };
    
    const logs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
    logs.push(auditLog);
    localStorage.setItem('auditLogs', JSON.stringify(logs));
  }, [resetTimers, user]);

  // Monitor user activity
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      const now = Date.now();
      // Only reset if more than 1 second since last activity (debounce)
      if (now - lastActivity > 1000) {
        resetTimers();
      }
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Initial timer setup
    resetTimers();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [user, lastActivity, resetTimers]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) return null;

  return (
    <>
      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertTriangle className="text-yellow-600" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Session Timeout Warning</h2>
                <p className="text-sm text-gray-600">Your session will expire soon</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-center py-6">
                <Clock className="mx-auto text-gray-400 mb-4" size={48} />
                <div className="text-4xl font-bold text-gray-800 mb-2">
                  {formatTime(timeRemaining)}
                </div>
                <p className="text-sm text-gray-600">
                  Time remaining before automatic logout
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Shield className="text-blue-600 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      HIPAA Security Requirement
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Automatic logout protects patient data when you're away from your computer
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                For security reasons, your session will automatically end after {timeoutMinutes} minutes 
                of inactivity. This helps protect sensitive patient information.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTimeout}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={18} />
                Logout Now
              </button>
              <button
                onClick={continueSession}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Continue Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Countdown indicator (always visible in corner) */}
      {!showWarning && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
            <Shield className="text-gray-400" size={16} />
            <span className="text-xs text-gray-600">
              Session timeout: {timeoutMinutes} min
            </span>
          </div>
        </div>
      )}
    </>
  );
}