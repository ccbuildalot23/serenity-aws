/**
 * SessionTimeout HIPAA Compliance Tests
 * Testing 15-minute timeout with 13-minute warning and audit logging
 */

import { SessionTimeout, SessionTimeoutOptions, AuditLogEntry } from '../../utils/sessionTimeout';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator for user agent
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Browser) HIPAA-Compliance-Test/1.0'
  }
});

describe('SessionTimeout - HIPAA Compliance Tests', () => {
  let sessionTimeout: SessionTimeout;
  let mockOnTimeout: jest.Mock;
  let mockOnWarning: jest.Mock;
  let mockOnActivity: jest.Mock;

  beforeEach(() => {
    // Use fake timers to control time passage
    jest.useFakeTimers();
    
    // Reset localStorage mock
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    
    // Create callback mocks
    mockOnTimeout = jest.fn();
    mockOnWarning = jest.fn();
    mockOnActivity = jest.fn();
    
    // Mock existing user for audit logs
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'current_user') {
        return JSON.stringify({ id: 'test-user-123' });
      }
      if (key === 'hipaa_audit_logs') {
        return JSON.stringify([]);
      }
      return null;
    });
  });

  afterEach(() => {
    if (sessionTimeout) {
      sessionTimeout.destroy();
    }
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with default HIPAA-compliant settings', () => {
      sessionTimeout = new SessionTimeout();
      
      const info = sessionTimeout.getSessionInfo();
      
      expect(info.sessionId).toMatch(/^session_\d+_[a-z0-9]{9}$/);
      expect(info.startTime).toBeDefined();
      expect(info.lastActivity).toBeDefined();
      expect(info.isActive).toBe(false); // Not started yet
    });

    it('should accept custom timeout durations', () => {
      const customOptions: SessionTimeoutOptions = {
        timeoutDuration: 10 * 60 * 1000, // 10 minutes
        warningDuration: 8 * 60 * 1000,  // 8 minutes
        onTimeout: mockOnTimeout,
        onWarning: mockOnWarning,
        onActivity: mockOnActivity,
      };
      
      sessionTimeout = new SessionTimeout(customOptions);
      sessionTimeout.start();
      
      // Advance to just before warning
      jest.advanceTimersByTime(7 * 60 * 1000 + 59 * 1000); // 7:59
      expect(mockOnWarning).not.toHaveBeenCalled();
      
      // Advance to warning time
      jest.advanceTimersByTime(1000); // 8:00
      expect(mockOnWarning).toHaveBeenCalledTimes(1);
    });

    it('should create session start audit log on initialization', () => {
      sessionTimeout = new SessionTimeout({
        enableAuditLogging: true
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs',
        expect.stringContaining('"event":"session_start"')
      );
    });
  });

  describe('Timer Management - HIPAA 15-Minute Requirement', () => {
    beforeEach(() => {
      sessionTimeout = new SessionTimeout({
        onTimeout: mockOnTimeout,
        onWarning: mockOnWarning,
        onActivity: mockOnActivity,
        enableAuditLogging: true
      });
    });

    it('should trigger warning callback at 13 minutes', () => {
      sessionTimeout.start();
      
      // Advance to just before warning (12:59)
      jest.advanceTimersByTime(12 * 60 * 1000 + 59 * 1000);
      expect(mockOnWarning).not.toHaveBeenCalled();
      
      // Advance to warning time (13:00)
      jest.advanceTimersByTime(1000);
      expect(mockOnWarning).toHaveBeenCalledTimes(1);
      
      // Should not trigger timeout yet
      expect(mockOnTimeout).not.toHaveBeenCalled();
    });

    it('should trigger timeout callback at 15 minutes', () => {
      sessionTimeout.start();
      
      // Advance to just before timeout (14:59)
      jest.advanceTimersByTime(14 * 60 * 1000 + 59 * 1000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Advance to timeout (15:00)
      jest.advanceTimersByTime(1000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    it('should create audit log entries for warning and timeout', () => {
      sessionTimeout.start();
      
      // Trigger warning
      jest.advanceTimersByTime(13 * 60 * 1000);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs',
        expect.stringContaining('"event":"session_warning"')
      );
      
      // Trigger timeout
      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs',
        expect.stringContaining('"event":"session_timeout"')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs',
        expect.stringContaining('"phiAccessed":true')
      );
    });

    it('should reset timer on user activity', () => {
      sessionTimeout.start();
      
      // Advance to near warning
      jest.advanceTimersByTime(12 * 60 * 1000);
      
      // User activity resets timer
      sessionTimeout.resetTimer();
      expect(mockOnActivity).toHaveBeenCalledTimes(1);
      
      // Warning should not trigger at original 13-minute mark
      jest.advanceTimersByTime(2 * 60 * 1000); // Total 14 minutes from original start
      expect(mockOnWarning).not.toHaveBeenCalled();
      
      // Warning should trigger 13 minutes after reset
      jest.advanceTimersByTime(11 * 60 * 1000); // 13 minutes from reset
      expect(mockOnWarning).toHaveBeenCalledTimes(1);
    });

    it('should log user activity in audit trail', () => {
      sessionTimeout.start();
      
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      sessionTimeout.resetTimer();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs',
        expect.stringContaining('"event":"user_activity"')
      );
    });
  });

  describe('Session Extension - HIPAA Compliance', () => {
    beforeEach(() => {
      sessionTimeout = new SessionTimeout({
        onTimeout: mockOnTimeout,
        onWarning: mockOnWarning,
        enableAuditLogging: true
      });
    });

    it('should extend session when explicitly requested', () => {
      sessionTimeout.start();
      
      // Advance to near timeout
      jest.advanceTimersByTime(14 * 60 * 1000);
      
      // Extend session
      sessionTimeout.extendSession();
      
      // Original timeout should not trigger
      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // New timeout should trigger after full duration
      jest.advanceTimersByTime(13 * 60 * 1000); // Total 15 minutes from extension
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    it('should log session extension in audit trail', () => {
      sessionTimeout.start();
      sessionTimeout.extendSession();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs',
        expect.stringContaining('"event":"session_extend"')
      );
    });

    it('should extend session with custom duration', () => {
      sessionTimeout.start();
      
      const customExtension = 30 * 60 * 1000; // 30 minutes
      sessionTimeout.extendSession(customExtension);
      
      // Should not timeout at normal 15-minute mark
      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Should timeout at custom 30-minute mark
      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Information and Monitoring', () => {
    beforeEach(() => {
      sessionTimeout = new SessionTimeout();
    });

    it('should provide accurate session information', () => {
      const startTime = Date.now();
      const info = sessionTimeout.getSessionInfo();
      
      expect(info.sessionId).toBeDefined();
      expect(info.startTime).toBeGreaterThanOrEqual(startTime);
      expect(info.lastActivity).toBeGreaterThanOrEqual(startTime);
      expect(typeof info.timeRemaining).toBe('number');
      expect(typeof info.isActive).toBe('boolean');
    });

    it('should calculate time remaining accurately', () => {
      sessionTimeout.start();
      
      expect(sessionTimeout.getTimeRemaining()).toBe(15 * 60 * 1000);
      
      jest.advanceTimersByTime(5 * 60 * 1000);
      sessionTimeout.resetTimer(); // Updates lastActivity
      
      expect(sessionTimeout.getTimeRemaining()).toBe(15 * 60 * 1000);
    });

    it('should return zero time remaining after timeout', () => {
      sessionTimeout.start();
      
      jest.advanceTimersByTime(16 * 60 * 1000); // Past timeout
      
      expect(sessionTimeout.getTimeRemaining()).toBe(0);
    });
  });

  describe('Audit Log Management - HIPAA Compliance', () => {
    beforeEach(() => {
      SessionTimeout.clearAuditLogs();
    });

    it('should store complete audit information', () => {
      sessionTimeout = new SessionTimeout({
        enableAuditLogging: true
      });
      
      const expectedFields = [
        'timestamp',
        'event',
        'sessionId',
        'userId',
        'userAgent',
        'phiAccessed'
      ];
      
      sessionTimeout.start();
      jest.advanceTimersByTime(13 * 60 * 1000); // Trigger warning
      
      const lastCall = localStorageMock.setItem.mock.calls.slice(-1)[0];
      const auditData = JSON.parse(lastCall[1]);
      const logEntry = auditData[auditData.length - 1];
      
      expectedFields.forEach(field => {
        expect(logEntry).toHaveProperty(field);
      });
      
      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(logEntry.event).toBe('session_warning');
      expect(logEntry.userId).toBe('test-user-123');
      expect(logEntry.userAgent).toContain('HIPAA-Compliance-Test');
    });

    it('should retrieve audit logs with filtering', () => {
      // Mock stored audit logs
      const mockLogs: AuditLogEntry[] = [
        {
          timestamp: '2024-09-07T10:00:00.000Z',
          event: 'session_start',
          sessionId: 'session_1',
          userId: 'user1',
          phiAccessed: false
        },
        {
          timestamp: '2024-09-07T10:15:00.000Z',
          event: 'session_timeout',
          sessionId: 'session_1',
          userId: 'user1',
          phiAccessed: true
        },
        {
          timestamp: '2024-09-07T11:00:00.000Z',
          event: 'session_start',
          sessionId: 'session_2',
          userId: 'user2',
          phiAccessed: false
        }
      ];
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'hipaa_audit_logs') {
          return JSON.stringify(mockLogs);
        }
        return null;
      });
      
      // Test date filtering
      const startDate = new Date('2024-09-07T10:10:00.000Z');
      const filtered = SessionTimeout.getAuditLogs(startDate);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].timestamp).toBe('2024-09-07T11:00:00.000Z');
      
      // Test event type filtering
      const timeoutLogs = SessionTimeout.getAuditLogs(undefined, undefined, 'session_timeout');
      expect(timeoutLogs).toHaveLength(1);
      expect(timeoutLogs[0].event).toBe('session_timeout');
    });

    it('should handle audit log storage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      sessionTimeout = new SessionTimeout({
        enableAuditLogging: true
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to store audit log:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Resource Cleanup and Memory Management', () => {
    beforeEach(() => {
      sessionTimeout = new SessionTimeout({
        onTimeout: mockOnTimeout,
        onWarning: mockOnWarning
      });
    });

    it('should clean up timers on destroy', () => {
      sessionTimeout.start();
      
      const info1 = sessionTimeout.getSessionInfo();
      expect(info1.isActive).toBe(true);
      
      sessionTimeout.destroy();
      
      const info2 = sessionTimeout.getSessionInfo();
      expect(info2.isActive).toBe(false);
      
      // Callbacks should not fire after destroy
      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      expect(mockOnWarning).not.toHaveBeenCalled();
    });

    it('should clear timers when resetting', () => {
      sessionTimeout.start();
      
      // Advance partway through timeout
      jest.advanceTimersByTime(10 * 60 * 1000);
      
      // Reset should cancel existing timers
      sessionTimeout.resetTimer();
      
      // Original warning at 13 minutes should not fire
      jest.advanceTimersByTime(5 * 60 * 1000); // Total 15 minutes from start
      expect(mockOnWarning).not.toHaveBeenCalled();
    });

    it('should disable audit logging when requested', () => {
      // Clear localStorage mocks for this specific test
      localStorageMock.setItem.mockClear();
      
      sessionTimeout = new SessionTimeout({
        enableAuditLogging: false,
        onTimeout: mockOnTimeout,
        onWarning: mockOnWarning,
        onActivity: mockOnActivity,
      });
      
      sessionTimeout.start();
      jest.advanceTimersByTime(13 * 60 * 1000);
      
      // Should not store any audit logs
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
        'hipaa_audit_logs',
        expect.anything()
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle localStorage unavailability', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      
      const logs = SessionTimeout.getAuditLogs();
      expect(logs).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle malformed audit log data', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'hipaa_audit_logs') {
          return 'invalid json';
        }
        return null;
      });
      
      const logs = SessionTimeout.getAuditLogs();
      expect(logs).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle multiple rapid timer resets', () => {
      sessionTimeout = new SessionTimeout({
        onTimeout: mockOnTimeout,
        onWarning: mockOnWarning
      });
      
      sessionTimeout.start();
      
      // Rapid resets should not cause issues
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(1000);
        sessionTimeout.resetTimer();
      }
      
      // Should still work normally after rapid resets
      jest.advanceTimersByTime(13 * 60 * 1000);
      expect(mockOnWarning).toHaveBeenCalledTimes(1);
    });
  });

  describe('HIPAA Compliance Validation', () => {
    it('should meet 15-minute PHI access timeout requirement', () => {
      const startTime = Date.now();
      
      sessionTimeout = new SessionTimeout({
        onTimeout: mockOnTimeout
      });
      
      sessionTimeout.start();
      
      // Verify default timeout is exactly 15 minutes
      jest.advanceTimersByTime(14 * 60 * 1000 + 59 * 1000);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
      
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBe(15 * 60 * 1000);
    });

    it('should provide 2-minute warning before timeout', () => {
      sessionTimeout = new SessionTimeout({
        onWarning: mockOnWarning,
        onTimeout: mockOnTimeout
      });
      
      sessionTimeout.start();
      
      // Warning at 13 minutes (2 minutes before 15-minute timeout)
      jest.advanceTimersByTime(13 * 60 * 1000);
      expect(mockOnWarning).toHaveBeenCalledTimes(1);
      expect(mockOnTimeout).not.toHaveBeenCalled();
      
      // Timeout at 15 minutes
      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(mockOnTimeout).toHaveBeenCalledTimes(1);
    });

    it('should maintain complete audit trail for compliance', () => {
      sessionTimeout = new SessionTimeout({
        onTimeout: mockOnTimeout,
        onWarning: mockOnWarning,
        enableAuditLogging: true
      });
      
      sessionTimeout.start();
      sessionTimeout.resetTimer();
      sessionTimeout.extendSession();
      jest.advanceTimersByTime(13 * 60 * 1000);
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // Should have logged: session_start, user_activity, session_extend, session_warning, session_timeout
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(5);
      
      const calls = localStorageMock.setItem.mock.calls;
      const events = calls.map(call => {
        const data = JSON.parse(call[1]);
        return data[data.length - 1].event;
      });
      
      expect(events).toEqual([
        'session_start',
        'user_activity', 
        'session_extend',
        'session_warning',
        'session_timeout'
      ]);
    });
  });
});