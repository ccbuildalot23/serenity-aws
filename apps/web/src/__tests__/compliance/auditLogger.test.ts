/**
 * HIPAA Audit Logger Compliance Tests
 * Testing comprehensive audit logging for healthcare applications
 * Validates HIPAA technical safeguards requirements
 */

import { HIPAAAuditLogger, HIPAAAuditEvent, AuditEventType, ResourceType } from '../../utils/auditLogger';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock console methods
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

describe('HIPAAAuditLogger - Compliance Tests', () => {
  let auditLogger: HIPAAAuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a storage map to track data across localStorage calls
    const storageMap = new Map<string, string>();
    
    // Mock localStorage to actually store and retrieve data
    localStorageMock.getItem.mockImplementation((key) => {
      return storageMap.get(key) || null;
    });
    
    localStorageMock.setItem.mockImplementation((key, value) => {
      storageMap.set(key, value);
    });
    
    localStorageMock.removeItem.mockImplementation((key) => {
      storageMap.delete(key);
    });
    
    localStorageMock.clear.mockImplementation(() => {
      storageMap.clear();
    });

    auditLogger = new HIPAAAuditLogger({
      flushInterval: 1000, // Faster for testing
      batchSize: 3, // Smaller batch size for testing
      encryptLogs: false // Disable encryption for easier content testing
    });
  });

  afterEach(() => {
    if (auditLogger) {
      auditLogger.destroy();
    }
    HIPAAAuditLogger.clearLogs();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with HIPAA-compliant default settings', () => {
      const logger = new HIPAAAuditLogger();
      
      // Test that logger was created successfully
      expect(logger).toBeDefined();
      
      // Verify default HIPAA retention period (6 years = 2190 days)
      expect(logger['config'].retentionDays).toBe(2190);
      expect(logger['config'].encryptLogs).toBe(true); // Default is true
      expect(logger['config'].validateIntegrity).toBe(true);
      expect(logger['config'].enableRealTimeAlerts).toBe(true);
      expect(logger['config'].logSensitiveData).toBe(false);
      
      logger.destroy();
    });

    it('should accept custom configuration options', () => {
      const customConfig = {
        maxLogSize: 5000,
        retentionDays: 1095, // 3 years
        batchSize: 50,
        encryptLogs: false,
        enableRealTimeAlerts: false
      };

      const logger = new HIPAAAuditLogger(customConfig);
      
      expect(logger['config'].maxLogSize).toBe(5000);
      expect(logger['config'].retentionDays).toBe(1095);
      expect(logger['config'].batchSize).toBe(50);
      expect(logger['config'].encryptLogs).toBe(false);
      expect(logger['config'].enableRealTimeAlerts).toBe(false);
      
      logger.destroy();
    });
  });

  describe('Event Logging - HIPAA Required Fields', () => {
    it('should log complete audit events with all required HIPAA fields', async () => {
      const eventData = {
        eventType: 'data_access' as AuditEventType,
        outcome: 'success' as const,
        userId: 'user123',
        userRole: 'patient' as const,
        sessionId: 'session456',
        sourceIP: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser',
        sourceSystem: 'serenity-web',
        resourceType: 'patient_record' as ResourceType,
        resourceId: 'record789',
        phiAccessed: true,
        action: 'view_patient_record',
        description: 'Patient accessed their own medical record',
        riskLevel: 'low' as const
      };

      const eventId = await auditLogger.logEvent(eventData);
      
      expect(eventId).toMatch(/^audit_\d+_[a-z0-9]{9}$/);
      
      // Force flush to capture the logged event
      await auditLogger.flush();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs_v2',
        expect.stringContaining('user123')
      );
    });

    it('should validate required fields and reject incomplete events', async () => {
      const incompleteEvent = {
        eventType: 'data_access' as AuditEventType,
        outcome: 'success' as const,
        userId: 'user123',
        // Missing required fields
      };

      await expect(
        auditLogger.logEvent(incompleteEvent as any)
      ).rejects.toThrow('Missing required audit field');
    });

    it('should generate unique event IDs', async () => {
      const eventData = {
        eventType: 'authentication' as AuditEventType,
        outcome: 'success' as const,
        userId: 'user123',
        userRole: 'patient' as const,
        sessionId: 'session456',
        sourceIP: '192.168.1.100',
        userAgent: 'Test Browser',
        sourceSystem: 'serenity-web',
        resourceType: 'user_account' as ResourceType,
        phiAccessed: false,
        action: 'login',
        description: 'User login',
        riskLevel: 'low' as const
      };

      const eventId1 = await auditLogger.logEvent(eventData);
      const eventId2 = await auditLogger.logEvent(eventData);
      
      expect(eventId1).not.toBe(eventId2);
      expect(eventId1).toMatch(/^audit_\d+_[a-z0-9]{9}$/);
      expect(eventId2).toMatch(/^audit_\d+_[a-z0-9]{9}$/);
    });

    it('should automatically add timestamp in ISO 8601 format', async () => {
      const startTime = new Date().toISOString();
      
      await auditLogger.logEvent({
        eventType: 'data_access',
        outcome: 'success',
        userId: 'user123',
        userRole: 'patient',
        sessionId: 'session456',
        sourceIP: '192.168.1.100',
        userAgent: 'Test Browser',
        sourceSystem: 'serenity-web',
        resourceType: 'patient_record',
        phiAccessed: true,
        action: 'view',
        description: 'Test event',
        riskLevel: 'low'
      });

      await auditLogger.flush();
      
      const logs = await auditLogger.getLogs();
      expect(logs).toHaveLength(1);
      
      const timestamp = logs[0].timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(new Date(startTime).getTime());
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log authentication events with proper categorization', async () => {
      const eventId = await auditLogger.logAuthentication(
        'user123',
        'success',
        {
          sessionId: 'session456',
          sourceIP: '192.168.1.100',
          userAgent: 'Test Browser',
          userRole: 'provider'
        }
      );

      expect(eventId).toBeDefined();

      const logs = await auditLogger.getLogs();
      const authEvent = logs[0];

      expect(authEvent.eventType).toBe('authentication');
      expect(authEvent.outcome).toBe('success');
      expect(authEvent.userId).toBe('user123');
      expect(authEvent.userRole).toBe('provider');
      expect(authEvent.action).toBe('login_success');
      expect(authEvent.phiAccessed).toBe(false);
      expect(authEvent.riskLevel).toBe('low');
    });

    it('should log authentication failures with elevated risk', async () => {
      await auditLogger.logAuthentication('user123', 'failure');

      const logs = await auditLogger.getLogs();
      const failureEvent = logs[0];

      expect(failureEvent.outcome).toBe('failure');
      expect(failureEvent.action).toBe('login_failure');
      expect(failureEvent.riskLevel).toBe('medium');
    });

    it('should log PHI access events with appropriate metadata', async () => {
      const eventId = await auditLogger.logPHIAccess(
        'user123',
        'patient_record',
        'record789',
        'view_assessment',
        {
          sessionId: 'session456',
          sourceIP: '192.168.1.100',
          userRole: 'provider'
        }
      );

      const logs = await auditLogger.getLogs();
      const phiEvent = logs[0];

      expect(phiEvent.eventType).toBe('data_access');
      expect(phiEvent.resourceType).toBe('patient_record');
      expect(phiEvent.resourceId).toBe('record789');
      expect(phiEvent.phiAccessed).toBe(true);
      expect(phiEvent.action).toBe('view_assessment');
      expect(phiEvent.riskLevel).toBe('medium');
    });

    it('should log crisis events with critical risk level', async () => {
      await auditLogger.logCrisisEvent(
        'patient123',
        'crisis_alert_triggered',
        'success',
        {
          sessionId: 'session456',
          sourceIP: '192.168.1.100'
        }
      );

      const logs = await auditLogger.getLogs();
      const crisisEvent = logs[0];

      expect(crisisEvent.eventType).toBe('crisis_alert');
      expect(crisisEvent.riskLevel).toBe('critical');
      expect(crisisEvent.phiAccessed).toBe(true);
      expect(crisisEvent.resourceType).toBe('crisis_plan');
      expect(crisisEvent.userRole).toBe('patient');
    });
  });

  describe('Critical Event Handling and Real-time Alerts', () => {
    it('should trigger real-time alerts for critical events', async () => {
      await auditLogger.logEvent({
        eventType: 'security_event',
        outcome: 'failure',
        userId: 'attacker123',
        userRole: 'patient',
        sessionId: 'session456',
        sourceIP: '10.0.0.1',
        userAgent: 'Suspicious Browser',
        sourceSystem: 'serenity-web',
        resourceType: 'system_configuration',
        phiAccessed: false,
        action: 'unauthorized_access_attempt',
        description: 'Multiple failed login attempts detected',
        riskLevel: 'critical'
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'CRITICAL AUDIT EVENT:',
        expect.objectContaining({
          eventType: 'security_event',
          userId: 'attacker123',
          description: 'Multiple failed login attempts detected'
        })
      );
    });

    it('should not trigger alerts when disabled', async () => {
      const logger = new HIPAAAuditLogger({
        enableRealTimeAlerts: false
      });

      await logger.logEvent({
        eventType: 'crisis_alert',
        outcome: 'success',
        userId: 'patient123',
        userRole: 'patient',
        sessionId: 'session456',
        sourceIP: '192.168.1.100',
        userAgent: 'Test Browser',
        sourceSystem: 'serenity-web',
        resourceType: 'crisis_plan',
        phiAccessed: true,
        action: 'crisis_triggered',
        description: 'Crisis alert activated',
        riskLevel: 'critical'
      });

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      logger.destroy();
    });
  });

  describe('Log Storage and Retrieval', () => {
    beforeEach(async () => {
      // Add sample logs for testing
      await auditLogger.logAuthentication('user1', 'success', {
        sessionId: 'session1',
        sourceIP: '192.168.1.100',
        userAgent: 'Browser1'
      });

      await auditLogger.logPHIAccess('user2', 'patient_record', 'record1', 'view', {
        sessionId: 'session2',
        sourceIP: '192.168.1.101',
        userAgent: 'Browser2'
      });

      await auditLogger.logCrisisEvent('user3', 'crisis_alert', 'success', {
        sessionId: 'session3',
        sourceIP: '192.168.1.102'
      });
    });

    it('should retrieve logs with date filtering', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const recentLogs = await auditLogger.getLogs({
        startDate: oneHourAgo
      });

      expect(recentLogs.length).toBeGreaterThan(0);
      recentLogs.forEach(log => {
        expect(new Date(log.timestamp)).toBeInstanceOf(Date);
        expect(new Date(log.timestamp).getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
      });
    });

    it('should retrieve logs with user filtering', async () => {
      const user1Logs = await auditLogger.getLogs({
        userId: 'user1'
      });

      expect(user1Logs).toHaveLength(1);
      expect(user1Logs[0].userId).toBe('user1');
      expect(user1Logs[0].eventType).toBe('authentication');
    });

    it('should retrieve logs with event type filtering', async () => {
      const phiLogs = await auditLogger.getLogs({
        eventType: 'data_access'
      });

      expect(phiLogs).toHaveLength(1);
      expect(phiLogs[0].eventType).toBe('data_access');
      expect(phiLogs[0].phiAccessed).toBe(true);
    });

    it('should retrieve logs with PHI access filtering', async () => {
      const phiAccessLogs = await auditLogger.getLogs({
        phiAccessed: true
      });

      expect(phiAccessLogs).toHaveLength(2); // PHI access and crisis events
      phiAccessLogs.forEach(log => {
        expect(log.phiAccessed).toBe(true);
      });
    });

    it('should support pagination', async () => {
      const page1 = await auditLogger.getLogs({
        limit: 2,
        offset: 0
      });

      const page2 = await auditLogger.getLogs({
        limit: 2,
        offset: 2
      });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect(page1[0].eventId).not.toBe(page2[0].eventId);
    });

    it('should return logs sorted by timestamp (newest first)', async () => {
      const logs = await auditLogger.getLogs();
      
      expect(logs.length).toBeGreaterThan(1);
      
      for (let i = 1; i < logs.length; i++) {
        const currentTimestamp = new Date(logs[i].timestamp).getTime();
        const previousTimestamp = new Date(logs[i-1].timestamp).getTime();
        expect(currentTimestamp).toBeLessThanOrEqual(previousTimestamp);
      }
    });
  });

  describe('Log Statistics and Reporting', () => {
    beforeEach(async () => {
      // Create diverse log entries for statistics testing
      await auditLogger.logAuthentication('user1', 'success');
      await auditLogger.logAuthentication('user1', 'failure');
      await auditLogger.logAuthentication('user2', 'success');
      
      await auditLogger.logPHIAccess('user1', 'patient_record', 'rec1', 'view');
      await auditLogger.logPHIAccess('user2', 'assessment_data', 'ass1', 'modify');
      
      await auditLogger.logCrisisEvent('user3', 'crisis_alert', 'success');
    });

    it('should generate accurate statistics', async () => {
      const stats = await auditLogger.getStatistics();

      expect(stats.totalEvents).toBe(6);
      expect(stats.eventsByType.authentication).toBe(3);
      expect(stats.eventsByType.data_access).toBe(2);
      expect(stats.eventsByType.crisis_alert).toBe(1);
      expect(stats.phiAccessCount).toBe(3); // 2 data_access + 1 crisis
      expect(stats.failureCount).toBe(1);
      expect(stats.uniqueUsers).toBe(3);
    });

    it('should filter statistics by date range', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 60 * 1000);

      const stats = await auditLogger.getStatistics(now, futureDate);

      expect(stats.totalEvents).toBe(0); // No events in future range
    });

    it('should count events by risk level', async () => {
      const stats = await auditLogger.getStatistics();

      expect(stats.eventsByRiskLevel.low).toBe(2); // successful auth events
      expect(stats.eventsByRiskLevel.medium).toBe(3); // failed auth + PHI access events
      expect(stats.eventsByRiskLevel.critical).toBe(1); // crisis event
    });
  });

  describe('Data Retention and Cleanup', () => {
    it('should cleanup logs older than retention period', async () => {
      // Create a logger with short retention for testing
      const shortRetentionLogger = new HIPAAAuditLogger({
        retentionDays: 1
      });

      // Mock old logs
      const oldLog: HIPAAAuditEvent = {
        eventId: 'old_event',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        eventType: 'authentication',
        outcome: 'success',
        userId: 'olduser',
        userRole: 'patient',
        sessionId: 'oldsession',
        sourceIP: '192.168.1.1',
        userAgent: 'Old Browser',
        sourceSystem: 'serenity-web',
        resourceType: 'user_account',
        phiAccessed: false,
        action: 'login',
        description: 'Old login',
        riskLevel: 'low'
      };

      // Store the old log in our mocked localStorage
      localStorageMock.setItem('hipaa_audit_logs_v2', JSON.stringify([oldLog]));

      const deletedCount = await shortRetentionLogger.cleanupOldLogs();

      expect(deletedCount).toBe(1);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hipaa_audit_logs_v2',
        expect.any(String)
      );

      shortRetentionLogger.destroy();
    });

    it('should enforce maximum log size', async () => {
      const smallLogger = new HIPAAAuditLogger({
        maxLogSize: 2,
        batchSize: 1
      });

      // Add 3 logs, should only keep the last 2
      await smallLogger.logAuthentication('user1', 'success');
      await smallLogger.logAuthentication('user2', 'success'); 
      await smallLogger.logAuthentication('user3', 'success');

      await smallLogger.flush();

      const logs = await smallLogger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(2);

      smallLogger.destroy();
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should validate log integrity', async () => {
      await auditLogger.logAuthentication('user1', 'success');
      await auditLogger.logPHIAccess('user2', 'patient_record', 'rec1', 'view');

      const integrityResult = await auditLogger.validateIntegrity();

      expect(integrityResult.isValid).toBe(true);
      expect(integrityResult.errors).toHaveLength(0);
      expect(integrityResult.totalLogs).toBeGreaterThan(0);
    });

    it('should detect corrupted log entries', async () => {
      // Mock corrupted logs in storage
      const corruptedLog = {
        eventId: 'corrupt',
        // Missing required fields
      };

      localStorageMock.getItem.mockImplementation(() => JSON.stringify([corruptedLog]));

      const integrityResult = await auditLogger.validateIntegrity();

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.errors.length).toBeGreaterThan(0);
      expect(integrityResult.errors[0]).toContain('Missing required audit field');
    });

    it('should validate timestamp formats', async () => {
      const invalidTimestampLog = {
        eventId: 'invalid_ts',
        timestamp: 'invalid-timestamp',
        eventType: 'authentication',
        outcome: 'success',
        userId: 'user1',
        userRole: 'patient',
        sessionId: 'session1',
        sourceIP: '192.168.1.1',
        userAgent: 'Browser',
        sourceSystem: 'serenity-web',
        resourceType: 'user_account',
        phiAccessed: false,
        action: 'login',
        description: 'Test',
        riskLevel: 'low'
      };

      localStorageMock.getItem.mockImplementation(() => JSON.stringify([invalidTimestampLog]));

      const integrityResult = await auditLogger.validateIntegrity();

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.errors[0]).toContain('Invalid timestamp format');
    });

    it('should validate enum values', async () => {
      const invalidEnumLog = {
        eventId: 'invalid_enum',
        timestamp: new Date().toISOString(),
        eventType: 'invalid_event_type',
        outcome: 'success',
        userId: 'user1',
        userRole: 'patient',
        sessionId: 'session1',
        sourceIP: '192.168.1.1',
        userAgent: 'Browser',
        sourceSystem: 'serenity-web',
        resourceType: 'user_account',
        phiAccessed: false,
        action: 'login',
        description: 'Test',
        riskLevel: 'low'
      };

      localStorageMock.getItem.mockImplementation(() => JSON.stringify([invalidEnumLog]));

      const integrityResult = await auditLogger.validateIntegrity();

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.errors[0]).toContain('Invalid event type');
    });
  });

  describe('Performance and Batch Processing', () => {
    it('should auto-flush when batch size is reached', async () => {
      const batchLogger = new HIPAAAuditLogger({
        batchSize: 2,
        flushInterval: 10000 // Long interval to test batch flushing
      });

      await batchLogger.logAuthentication('user1', 'success');
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      await batchLogger.logAuthentication('user2', 'success');
      
      // Should auto-flush after reaching batch size
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      batchLogger.destroy();
    });

    it('should handle storage errors gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      await expect(
        auditLogger.logAuthentication('user1', 'success')
      ).resolves.toBeDefined(); // Should not throw

      // Should attempt to flush and handle error
      await expect(auditLogger.flush()).rejects.toThrow('Failed to persist audit logs');
    });

    it('should auto-flush on timer interval', async () => {
      const timerLogger = new HIPAAAuditLogger({
        flushInterval: 100, // Very short for testing
        batchSize: 10 // Large batch to test timer flush
      });

      await timerLogger.logAuthentication('user1', 'success');
      
      // Wait for auto-flush timer
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      timerLogger.destroy();
    });
  });

  describe('Resource Cleanup and Memory Management', () => {
    it('should cleanup timers and flush logs on destroy', async () => {
      await auditLogger.logAuthentication('user1', 'success');
      
      // Should not have flushed yet
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      
      auditLogger.destroy();
      
      // Allow async flush to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls safely', () => {
      expect(() => {
        auditLogger.destroy();
        auditLogger.destroy();
        auditLogger.destroy();
      }).not.toThrow();
    });
  });

  describe('HIPAA Compliance Validation', () => {
    it('should maintain 6-year log retention by default', () => {
      const defaultLogger = new HIPAAAuditLogger();
      
      expect(defaultLogger['config'].retentionDays).toBe(2190); // 6 years * 365 days
      
      defaultLogger.destroy();
    });

    it('should encrypt logs by default for HIPAA compliance', () => {
      const defaultLogger = new HIPAAAuditLogger();
      
      expect(defaultLogger['config'].encryptLogs).toBe(true);
      
      defaultLogger.destroy();
    });

    it('should not log sensitive data by default', () => {
      const defaultLogger = new HIPAAAuditLogger();
      
      expect(defaultLogger['config'].logSensitiveData).toBe(false);
      
      defaultLogger.destroy();
    });

    it('should enable integrity validation for compliance', () => {
      const defaultLogger = new HIPAAAuditLogger();
      
      expect(defaultLogger['config'].validateIntegrity).toBe(true);
      
      defaultLogger.destroy();
    });

    it('should track all required HIPAA audit elements', async () => {
      await auditLogger.logPHIAccess('provider123', 'patient_record', 'rec456', 'view_phi', {
        sessionId: 'session789',
        sourceIP: '10.0.1.100',
        userAgent: 'Chrome/91.0',
        userRole: 'provider'
      });

      const logs = await auditLogger.getLogs();
      const phiLog = logs[0];

      // Verify all HIPAA-required audit elements are present
      const requiredFields = [
        'eventId', 'timestamp', 'eventType', 'outcome',
        'userId', 'userRole', 'sessionId', 'sourceIP', 'userAgent',
        'sourceSystem', 'resourceType', 'resourceId', 'phiAccessed',
        'action', 'description', 'riskLevel'
      ];

      requiredFields.forEach(field => {
        expect(phiLog).toHaveProperty(field);
        expect(phiLog[field as keyof HIPAAAuditEvent]).toBeDefined();
      });

      // Verify PHI-specific requirements
      expect(phiLog.phiAccessed).toBe(true);
      expect(phiLog.resourceType).toBe('patient_record');
      expect(phiLog.resourceId).toBe('rec456');
      expect(phiLog.riskLevel).toBe('medium'); // PHI access should be medium risk
    });
  });
});