import { auditLogger, AuditEventType } from '@/utils/auditLog';

// Mock console methods to avoid noise in tests
const mockConsole = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  log: jest.spyOn(console, 'log').mockImplementation()
};

describe('AuditLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockConsole.error.mockClear();
    mockConsole.log.mockClear();
  });

  describe('log()', () => {
    it('creates audit log entry with required fields', () => {
      const event = {
        event: AuditEventType.PHI_VIEW,
        userId: 'user-123',
        resourceId: 'patient-456',
        action: 'view patient data'
      };

      auditLogger.log(event);

      // Get logs from storage
      const storedLogs = auditLogger.getLogs();
      expect(storedLogs).toHaveLength(1);
      
      const log = storedLogs[0];
      expect(log).toMatchObject({
        event: AuditEventType.PHI_VIEW,
        userId: 'user-123',
        resourceId: 'patient-456',
        action: 'view patient data'
      });
      
      // Verify auto-generated fields
      expect(log.id).toBeTruthy();
      expect(log.timestamp).toBeTruthy();
      expect(new Date(log.timestamp).getTime()).toBeCloseTo(Date.now(), -2);
    });

    it('stores logs in localStorage', () => {
      auditLogger.log({
        event: AuditEventType.LOGIN,
        userId: 'user-123',
        action: 'user login'
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs',
        expect.any(String)
      );
    });

    it('enforces maximum log size', () => {
      // Create many logs to exceed limit
      for (let i = 0; i < 1100; i++) {
        auditLogger.log({
          event: AuditEventType.SYSTEM_ERROR,
          userId: `user-${i}`,
          action: 'test event'
        });
      }

      const logs = auditLogger.getLogs();
      // Should keep only the most recent 1000 logs
      expect(logs.length).toBeLessThanOrEqual(1000);
    });

    it('handles PHI-related events', () => {
      const phiEvents = [
        AuditEventType.PHI_VIEW,
        AuditEventType.PHI_UPDATE,
        AuditEventType.PHI_DELETE,
        AuditEventType.PHI_EXPORT
      ];

      phiEvents.forEach(event => {
        auditLogger.log({
          event,
          userId: 'user-123',
          resourceId: 'patient-456',
          action: 'PHI access',
          phiAccessed: true
        });
      });

      const logs = auditLogger.getLogs();
      
      // All PHI events should be marked as PHI accessed
      logs.forEach(log => {
        if (phiEvents.includes(log.event as AuditEventType)) {
          expect(log.phiAccessed).toBe(true);
        }
      });
    });
  });

  describe('getLogs()', () => {
    it('retrieves all stored logs', () => {
      const events = [
        { event: AuditEventType.LOGIN, userId: 'user-1', action: 'login' },
        { event: AuditEventType.LOGOUT, userId: 'user-1', action: 'logout' },
        { event: AuditEventType.PHI_VIEW, userId: 'user-2', action: 'view PHI' }
      ];

      events.forEach(e => auditLogger.log(e));

      const logs = auditLogger.getLogs();
      expect(logs).toHaveLength(3);
    });

    it('returns empty array when no logs exist', () => {
      const logs = auditLogger.getLogs();
      expect(logs).toEqual([]);
    });

    it('returns logs in chronological order', () => {
      // Log events sequentially
      auditLogger.log({ event: AuditEventType.LOGIN, userId: 'user-1', action: 'first' });
      auditLogger.log({ event: AuditEventType.PHI_VIEW, userId: 'user-1', action: 'second' });
      auditLogger.log({ event: AuditEventType.LOGOUT, userId: 'user-1', action: 'third' });

      const logs = auditLogger.getLogs();
      // Logs are stored with newest first
      expect(logs[0].action).toBe('third');
      expect(logs[1].action).toBe('second');
      expect(logs[2].action).toBe('first');
    });
  });

  describe('filter()', () => {
    beforeEach(() => {
      // Add test logs
      auditLogger.log({ event: AuditEventType.LOGIN, userId: 'user-1', action: 'login' });
      auditLogger.log({ event: AuditEventType.PHI_VIEW, userId: 'user-1', resourceId: 'patient-1', action: 'view PHI' });
      auditLogger.log({ event: AuditEventType.LOGIN, userId: 'user-2', action: 'login' });
      auditLogger.log({ event: AuditEventType.PHI_VIEW, userId: 'user-2', resourceId: 'patient-2', action: 'view PHI' });
      auditLogger.log({ event: AuditEventType.LOGOUT, userId: 'user-1', action: 'logout' });
    });

    it('filters by userId', () => {
      const filtered = auditLogger.getLogs({ userId: 'user-1' });
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(log => {
        expect(log.userId).toBe('user-1');
      });
    });

    it('filters by event type', () => {
      const filtered = auditLogger.getLogs({ event: AuditEventType.PHI_VIEW });
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(log => {
        expect(log.event).toBe(AuditEventType.PHI_VIEW);
      });
    });

    it('filters by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const filtered = auditLogger.getLogs({
        startDate: yesterday,
        endDate: tomorrow
      });

      expect(filtered.length).toBeGreaterThan(0);
    });

    it('filters PHI-only events', () => {
      // Add some PHI events
      auditLogger.log({
        event: AuditEventType.PHI_VIEW,
        userId: 'user-1',
        action: 'view PHI',
        phiAccessed: true
      });

      const filtered = auditLogger.getLogs({ phiOnly: true });
      
      filtered.forEach(log => {
        expect(log.phiAccessed).toBe(true);
      });
    });

    it('returns empty array when no matches', () => {
      const filtered = auditLogger.getLogs({
        userId: 'non-existent-user'
      });

      expect(filtered).toEqual([]);
    });
  });

  describe('Convenience Methods', () => {
    it('logs PHI access events', () => {
      auditLogger.logPHIAccess('view', 'patient', 'patient-123', 'patient-123');
      
      const logs = auditLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe(AuditEventType.PHI_VIEW);
      expect(logs[0].phiAccessed).toBe(true);
    });

    it('logs authentication events', () => {
      auditLogger.logAuth('login', 'user-123', 'test@example.com');
      
      const logs = auditLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe(AuditEventType.LOGIN);
      expect(logs[0].userId).toBe('user-123');
      expect(logs[0].userEmail).toBe('test@example.com');
    });

    it('logs security events', () => {
      auditLogger.logSecurity('unauthorized', 'protected-resource');
      
      const logs = auditLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].event).toBe(AuditEventType.UNAUTHORIZED_ACCESS);
      expect(logs[0].result).toBe('failure');
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      // Add sample data for reports
      auditLogger.log({ event: AuditEventType.LOGIN, userId: 'user-1', action: 'login' });
      auditLogger.log({ event: AuditEventType.PHI_VIEW, userId: 'user-1', action: 'view PHI', phiAccessed: true });
      auditLogger.log({ event: AuditEventType.UNAUTHORIZED_ACCESS, userId: 'user-2', action: 'failed access', result: 'failure' });
    });

    it('generates comprehensive audit report', () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const report = auditLogger.generateReport(startDate, endDate);
      
      expect(report).toHaveProperty('totalEvents');
      expect(report).toHaveProperty('phiAccess');
      expect(report).toHaveProperty('securityEvents');
      expect(report).toHaveProperty('uniqueUsers');
      expect(report).toHaveProperty('eventBreakdown');
      expect(typeof report.totalEvents).toBe('number');
      expect(typeof report.uniqueUsers).toBe('number');
    });
  });

  describe('HIPAA Compliance', () => {
    it('includes required HIPAA audit fields', () => {
      auditLogger.log({
        event: AuditEventType.PHI_VIEW,
        userId: 'provider-123',
        resourceId: 'patient-456',
        action: 'view patient record',
        patientId: 'patient-456'
      });

      const logs = auditLogger.getLogs();
      const log = logs[0];

      // Verify required HIPAA audit trail fields
      expect(log.id).toBeTruthy(); // Unique identifier
      expect(log.timestamp).toBeTruthy(); // Date and time
      expect(log.userId).toBeTruthy(); // User identification
      expect(log.event).toBeTruthy(); // Type of event
      expect(log.resourceId).toBeTruthy(); // Patient/resource affected
    });

    it('tracks user agent for audit trails', () => {
      auditLogger.log({
        event: AuditEventType.PHI_VIEW,
        userId: 'user-123',
        action: 'view data'
      });

      const logs = auditLogger.getLogs();
      expect(logs[0].userAgent).toBeDefined();
    });

    it('checks retention compliance', () => {
      const compliance = auditLogger.checkRetentionCompliance();
      
      expect(compliance).toHaveProperty('compliant');
      expect(compliance).toHaveProperty('requiresArchival');
      expect(typeof compliance.compliant).toBe('boolean');
      expect(typeof compliance.requiresArchival).toBe('boolean');
    });

    it('generates unique audit IDs', () => {
      const ids = [];
      
      for (let i = 0; i < 10; i++) {
        auditLogger.log({
          event: AuditEventType.SYSTEM_ERROR,
          userId: 'user-1',
          action: 'test'
        });
      }
      
      const logs = auditLogger.getLogs();
      logs.forEach(log => ids.push(log.id));
      
      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});