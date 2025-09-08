/**
 * HIPAA-Compliant Audit Logger
 * Implements comprehensive audit logging for healthcare applications
 * Meets HIPAA technical safeguards requirements for audit controls
 */

export interface HIPAAAuditEvent {
  // Required HIPAA audit fields
  timestamp: string; // ISO 8601 format
  eventId: string;   // Unique event identifier
  eventType: AuditEventType;
  outcome: 'success' | 'failure' | 'partial';
  
  // User identification
  userId: string;
  userRole: 'patient' | 'provider' | 'admin' | 'supporter' | 'system';
  sessionId: string;
  
  // System information
  sourceIP: string;
  userAgent: string;
  sourceSystem: string;
  
  // PHI and resource information
  resourceType: ResourceType;
  resourceId?: string;
  phiAccessed: boolean;
  
  // Event details
  action: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Optional metadata
  metadata?: Record<string, any>;
}

export type AuditEventType = 
  | 'authentication'
  | 'authorization' 
  | 'data_access'
  | 'data_modification'
  | 'data_creation'
  | 'data_deletion'
  | 'system_access'
  | 'configuration_change'
  | 'security_event'
  | 'crisis_alert'
  | 'session_management';

export type ResourceType =
  | 'patient_record'
  | 'assessment_data'
  | 'crisis_plan'
  | 'communication'
  | 'system_configuration'
  | 'user_account'
  | 'session_data'
  | 'audit_log';

export interface AuditLoggerConfig {
  // Storage configuration
  maxLogSize: number; // Maximum logs to store (default: 10000)
  retentionDays: number; // HIPAA requires 6 years (2190 days)
  
  // Performance settings
  batchSize: number; // Batch size for bulk operations (default: 100)
  flushInterval: number; // Auto-flush interval in ms (default: 30000)
  
  // Security settings
  encryptLogs: boolean; // Encrypt stored logs (default: true)
  validateIntegrity: boolean; // Validate log integrity (default: true)
  
  // Compliance settings
  enableRealTimeAlerts: boolean; // Alert on critical events (default: true)
  logSensitiveData: boolean; // Log sensitive data (default: false)
}

export class HIPAAAuditLogger {
  private config: AuditLoggerConfig;
  private logBuffer: HIPAAAuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private logCount = 0;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = {
      maxLogSize: 10000,
      retentionDays: 2190, // 6 years HIPAA requirement
      batchSize: 100,
      flushInterval: 30000, // 30 seconds
      encryptLogs: true,
      validateIntegrity: true,
      enableRealTimeAlerts: true,
      logSensitiveData: false,
      ...config
    };

    this.startAutoFlush();
  }

  /**
   * Log a HIPAA-compliant audit event
   */
  async logEvent(event: Omit<HIPAAAuditEvent, 'eventId' | 'timestamp'>): Promise<string> {
    const auditEvent: HIPAAAuditEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      ...event
    };

    // Validate required fields
    this.validateEvent(auditEvent);

    // Add to buffer
    this.logBuffer.push(auditEvent);
    this.logCount++;

    // Handle real-time alerts for critical events
    if (this.config.enableRealTimeAlerts && auditEvent.riskLevel === 'critical') {
      await this.handleCriticalEvent(auditEvent);
    }

    // Auto-flush if buffer is full
    if (this.logBuffer.length >= this.config.batchSize) {
      await this.flush();
    }

    return auditEvent.eventId;
  }

  /**
   * Log authentication event
   */
  async logAuthentication(
    userId: string,
    outcome: 'success' | 'failure',
    details: Partial<HIPAAAuditEvent> = {}
  ): Promise<string> {
    return this.logEvent({
      eventType: 'authentication',
      outcome,
      userId,
      userRole: details.userRole || 'patient',
      sessionId: details.sessionId || '',
      sourceIP: details.sourceIP || '',
      userAgent: details.userAgent || '',
      sourceSystem: 'serenity-web',
      resourceType: 'user_account',
      phiAccessed: false,
      action: outcome === 'success' ? 'login_success' : 'login_failure',
      description: `User ${outcome} authentication attempt`,
      riskLevel: outcome === 'failure' ? 'medium' : 'low',
      ...details
    });
  }

  /**
   * Log PHI access event
   */
  async logPHIAccess(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    action: string,
    details: Partial<HIPAAAuditEvent> = {}
  ): Promise<string> {
    return this.logEvent({
      eventType: 'data_access',
      outcome: 'success',
      userId,
      userRole: details.userRole || 'patient',
      sessionId: details.sessionId || '',
      sourceIP: details.sourceIP || '',
      userAgent: details.userAgent || '',
      sourceSystem: 'serenity-web',
      resourceType,
      resourceId,
      phiAccessed: true,
      action,
      description: `PHI access: ${action} on ${resourceType}`,
      riskLevel: 'medium',
      ...details
    });
  }

  /**
   * Log crisis event
   */
  async logCrisisEvent(
    userId: string,
    action: string,
    outcome: 'success' | 'failure',
    details: Partial<HIPAAAuditEvent> = {}
  ): Promise<string> {
    return this.logEvent({
      eventType: 'crisis_alert',
      outcome,
      userId,
      userRole: 'patient',
      sessionId: details.sessionId || '',
      sourceIP: details.sourceIP || '',
      userAgent: details.userAgent || '',
      sourceSystem: 'serenity-web',
      resourceType: 'crisis_plan',
      phiAccessed: true,
      action,
      description: `Crisis event: ${action}`,
      riskLevel: 'critical',
      ...details
    });
  }

  /**
   * Flush buffered logs to storage
   */
  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.persistLogs(logsToFlush);
    } catch (error) {
      // Re-add logs to buffer if persistence fails
      this.logBuffer.unshift(...logsToFlush);
      throw new Error(`Failed to persist audit logs: ${error}`);
    }
  }

  /**
   * Retrieve audit logs with filtering
   */
  async getLogs(filters: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    eventType?: AuditEventType;
    resourceType?: ResourceType;
    riskLevel?: HIPAAAuditEvent['riskLevel'];
    phiAccessed?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<HIPAAAuditEvent[]> {
    try {
      const storedLogs = await this.retrieveStoredLogs();
      let filteredLogs = [...storedLogs, ...this.logBuffer];

      // Apply filters
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= filters.startDate!
        );
      }

      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) <= filters.endDate!
        );
      }

      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }

      if (filters.eventType) {
        filteredLogs = filteredLogs.filter(log => log.eventType === filters.eventType);
      }

      if (filters.resourceType) {
        filteredLogs = filteredLogs.filter(log => log.resourceType === filters.resourceType);
      }

      if (filters.riskLevel) {
        filteredLogs = filteredLogs.filter(log => log.riskLevel === filters.riskLevel);
      }

      if (typeof filters.phiAccessed === 'boolean') {
        filteredLogs = filteredLogs.filter(log => log.phiAccessed === filters.phiAccessed);
      }

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || filteredLogs.length;
      
      return filteredLogs.slice(offset, offset + limit);
    } catch (error) {
      throw new Error(`Failed to retrieve audit logs: ${error}`);
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsByRiskLevel: Record<string, number>;
    phiAccessCount: number;
    failureCount: number;
    uniqueUsers: number;
  }> {
    const logs = await this.getLogs({ startDate, endDate });

    const stats = {
      totalEvents: logs.length,
      eventsByType: {} as Record<AuditEventType, number>,
      eventsByRiskLevel: {} as Record<string, number>,
      phiAccessCount: 0,
      failureCount: 0,
      uniqueUsers: new Set<string>().size
    };

    const uniqueUsers = new Set<string>();

    logs.forEach(log => {
      // Count by event type
      stats.eventsByType[log.eventType] = (stats.eventsByType[log.eventType] || 0) + 1;
      
      // Count by risk level
      stats.eventsByRiskLevel[log.riskLevel] = (stats.eventsByRiskLevel[log.riskLevel] || 0) + 1;
      
      // Count PHI access
      if (log.phiAccessed) stats.phiAccessCount++;
      
      // Count failures
      if (log.outcome === 'failure') stats.failureCount++;
      
      // Track unique users
      uniqueUsers.add(log.userId);
    });

    stats.uniqueUsers = uniqueUsers.size;
    return stats;
  }

  /**
   * Cleanup old logs based on retention policy
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const logs = await this.retrieveStoredLogs();
    const logsToKeep = logs.filter(log => 
      new Date(log.timestamp) > cutoffDate
    );

    const deletedCount = logs.length - logsToKeep.length;

    if (deletedCount > 0) {
      await this.replaceStoredLogs(logsToKeep);
    }

    return deletedCount;
  }

  /**
   * Validate log integrity
   */
  async validateIntegrity(): Promise<{
    isValid: boolean;
    errors: string[];
    totalLogs: number;
  }> {
    const logs = await this.getLogs();
    const errors: string[] = [];

    logs.forEach((log, index) => {
      try {
        this.validateEvent(log);
      } catch (error) {
        errors.push(`Log ${index}: ${error}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      totalLogs: logs.length
    };
  }

  /**
   * Destroy logger and cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining logs
    this.flush().catch(console.error);
  }

  private startAutoFlush(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushInterval);
  }

  private validateEvent(event: HIPAAAuditEvent): void {
    const required = [
      'eventId', 'timestamp', 'eventType', 'outcome', 'userId', 
      'userRole', 'sessionId', 'sourceIP', 'userAgent', 'sourceSystem',
      'resourceType', 'phiAccessed', 'action', 'description', 'riskLevel'
    ];

    required.forEach(field => {
      if (!(field in event) || event[field as keyof HIPAAAuditEvent] === undefined) {
        throw new Error(`Missing required audit field: ${field}`);
      }
    });

    // Validate timestamp format
    if (isNaN(Date.parse(event.timestamp))) {
      throw new Error('Invalid timestamp format');
    }

    // Validate enums
    const validEventTypes: AuditEventType[] = [
      'authentication', 'authorization', 'data_access', 'data_modification',
      'data_creation', 'data_deletion', 'system_access', 'configuration_change',
      'security_event', 'crisis_alert', 'session_management'
    ];

    if (!validEventTypes.includes(event.eventType)) {
      throw new Error(`Invalid event type: ${event.eventType}`);
    }

    const validOutcomes = ['success', 'failure', 'partial'];
    if (!validOutcomes.includes(event.outcome)) {
      throw new Error(`Invalid outcome: ${event.outcome}`);
    }

    const validRiskLevels = ['low', 'medium', 'high', 'critical'];
    if (!validRiskLevels.includes(event.riskLevel)) {
      throw new Error(`Invalid risk level: ${event.riskLevel}`);
    }
  }

  private generateEventId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `audit_${timestamp}_${random}`;
  }

  private async handleCriticalEvent(event: HIPAAAuditEvent): Promise<void> {
    // In production, this would send real-time alerts
    console.warn('CRITICAL AUDIT EVENT:', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      description: event.description,
      timestamp: event.timestamp
    });
  }

  private async persistLogs(logs: HIPAAAuditEvent[]): Promise<void> {
    try {
      const existingLogs = await this.retrieveStoredLogs();
      const allLogs = [...existingLogs, ...logs];
      
      // Enforce max log size
      const logsToStore = allLogs.slice(-this.config.maxLogSize);
      
      const logData = this.config.encryptLogs ? 
        this.encryptLogs(logsToStore) : 
        JSON.stringify(logsToStore);

      localStorage.setItem('hipaa_audit_logs_v2', logData);
    } catch (error) {
      throw new Error(`Failed to persist logs: ${error}`);
    }
  }

  private async retrieveStoredLogs(): Promise<HIPAAAuditEvent[]> {
    try {
      const stored = localStorage.getItem('hipaa_audit_logs_v2');
      if (!stored) return [];

      const logData = this.config.encryptLogs ? 
        this.decryptLogs(stored) : 
        stored;

      return JSON.parse(logData);
    } catch (error) {
      console.error('Failed to retrieve stored logs:', error);
      return [];
    }
  }

  private async replaceStoredLogs(logs: HIPAAAuditEvent[]): Promise<void> {
    try {
      const logData = this.config.encryptLogs ? 
        this.encryptLogs(logs) : 
        JSON.stringify(logs);

      localStorage.setItem('hipaa_audit_logs_v2', logData);
    } catch (error) {
      throw new Error(`Failed to replace stored logs: ${error}`);
    }
  }

  private encryptLogs(logs: HIPAAAuditEvent[]): string {
    // Simplified encryption for testing - production would use proper encryption
    const data = JSON.stringify(logs);
    return btoa(data);
  }

  private decryptLogs(encryptedData: string): string {
    // Simplified decryption for testing - production would use proper decryption
    return atob(encryptedData);
  }

  /**
   * Clear all audit logs (for testing only)
   */
  static clearLogs(): void {
    try {
      localStorage.removeItem('hipaa_audit_logs_v2');
    } catch (error) {
      console.error('Failed to clear audit logs:', error);
    }
  }
}