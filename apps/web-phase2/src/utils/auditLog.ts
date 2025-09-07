// HIPAA Audit Logging Utility
// Tracks all PHI access and user actions for compliance

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  event: AuditEventType;
  resource?: string;
  resourceId?: string;
  action: string;
  result: 'success' | 'failure' | 'warning';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  phiAccessed?: boolean;
  patientId?: string;
}

export enum AuditEventType {
  // Authentication Events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  AUTH_ATTEMPT = 'AUTH_ATTEMPT',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  SESSION_EXTENDED = 'SESSION_EXTENDED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_CONFIRM = 'PASSWORD_RESET_CONFIRM',
  PASSWORD_CHANGE_ATTEMPT = 'PASSWORD_CHANGE_ATTEMPT',
  PASSWORD_CHANGE_SUCCESS = 'PASSWORD_CHANGE_SUCCESS',
  MFA_CHALLENGE = 'MFA_CHALLENGE',
  
  // PHI Access Events
  PHI_VIEW = 'PHI_VIEW',
  PHI_CREATE = 'PHI_CREATE',
  PHI_UPDATE = 'PHI_UPDATE',
  PHI_DELETE = 'PHI_DELETE',
  PHI_EXPORT = 'PHI_EXPORT',
  PHI_PRINT = 'PHI_PRINT',
  
  // Assessment Events
  ASSESSMENT_START = 'ASSESSMENT_START',
  ASSESSMENT_COMPLETE = 'ASSESSMENT_COMPLETE',
  ASSESSMENT_VIEW = 'ASSESSMENT_VIEW',
  
  // Crisis Events
  CRISIS_ALERT = 'CRISIS_ALERT',
  CRISIS_ACKNOWLEDGED = 'CRISIS_ACKNOWLEDGED',
  CRISIS_ESCALATED = 'CRISIS_ESCALATED',
  
  // Provider Actions
  PATIENT_ASSIGNED = 'PATIENT_ASSIGNED',
  PATIENT_DISCHARGED = 'PATIENT_DISCHARGED',
  CARE_PLAN_CREATED = 'CARE_PLAN_CREATED',
  CARE_PLAN_UPDATED = 'CARE_PLAN_UPDATED',
  
  // Security Events
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  
  // System Events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  DATA_INTEGRITY_CHECK = 'DATA_INTEGRITY_CHECK',
  BACKUP_CREATED = 'BACKUP_CREATED'
}

class AuditLogger {
  private readonly STORAGE_KEY = 'hipaa_audit_logs';
  private readonly MAX_LOCAL_LOGS = 1000;
  private readonly RETENTION_YEARS = 6; // HIPAA requirement
  
  /**
   * Log an audit event
   */
  log(entry: Partial<AuditLogEntry>): void {
    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      result: 'success',
      action: '',
      event: AuditEventType.SYSTEM_ERROR,
      ...entry,
      // Browser info
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      // Note: IP address would come from server in production
    };

    // Store locally (in production, this would go to secure backend)
    this.storeLocal(logEntry);
    
    // Send to backend (mock for now)
    this.sendToBackend(logEntry);
    
    // Check for suspicious activity
    this.checkForSuspiciousActivity(logEntry);
  }

  /**
   * Log PHI access
   */
  logPHIAccess(
    action: 'view' | 'create' | 'update' | 'delete' | 'export',
    resourceType: string,
    resourceId: string,
    patientId?: string,
    details?: Record<string, any>
  ): void {
    const eventMap = {
      view: AuditEventType.PHI_VIEW,
      create: AuditEventType.PHI_CREATE,
      update: AuditEventType.PHI_UPDATE,
      delete: AuditEventType.PHI_DELETE,
      export: AuditEventType.PHI_EXPORT
    };

    this.log({
      event: eventMap[action],
      action: `${action.toUpperCase()} ${resourceType}`,
      resource: resourceType,
      resourceId,
      phiAccessed: true,
      patientId,
      details
    });
  }

  /**
   * Log authentication events
   */
  logAuth(event: 'login' | 'logout' | 'timeout' | 'extended', userId?: string, email?: string): void {
    const eventMap = {
      login: AuditEventType.LOGIN,
      logout: AuditEventType.LOGOUT,
      timeout: AuditEventType.SESSION_TIMEOUT,
      extended: AuditEventType.SESSION_EXTENDED
    };

    this.log({
      event: eventMap[event],
      action: `User ${event}`,
      userId,
      userEmail: email
    });
  }

  /**
   * Log security events
   */
  logSecurity(
    event: 'unauthorized' | 'denied' | 'suspicious',
    resource?: string,
    details?: Record<string, any>
  ): void {
    const eventMap = {
      unauthorized: AuditEventType.UNAUTHORIZED_ACCESS,
      denied: AuditEventType.PERMISSION_DENIED,
      suspicious: AuditEventType.SUSPICIOUS_ACTIVITY
    };

    this.log({
      event: eventMap[event],
      action: `Security event: ${event}`,
      resource,
      result: 'failure',
      details
    });
  }

  /**
   * Retrieve audit logs with filtering
   */
  getLogs(filters?: {
    userId?: string;
    event?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
    phiOnly?: boolean;
  }): AuditLogEntry[] {
    const logs = this.getLocalLogs();
    
    if (!filters) return logs;
    
    return logs.filter(log => {
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.event && log.event !== filters.event) return false;
      if (filters.phiOnly && !log.phiAccessed) return false;
      
      const logDate = new Date(log.timestamp);
      if (filters.startDate && logDate < filters.startDate) return false;
      if (filters.endDate && logDate > filters.endDate) return false;
      
      return true;
    });
  }

  /**
   * Generate audit report
   */
  generateReport(startDate: Date, endDate: Date): {
    totalEvents: number;
    phiAccess: number;
    securityEvents: number;
    uniqueUsers: number;
    eventBreakdown: Record<string, number>;
  } {
    const logs = this.getLogs({ startDate, endDate });
    
    const report = {
      totalEvents: logs.length,
      phiAccess: logs.filter(l => l.phiAccessed).length,
      securityEvents: logs.filter(l => l.result === 'failure').length,
      uniqueUsers: new Set(logs.map(l => l.userId).filter(Boolean)).size,
      eventBreakdown: {} as Record<string, number>
    };
    
    // Count events by type
    logs.forEach(log => {
      report.eventBreakdown[log.event] = (report.eventBreakdown[log.event] || 0) + 1;
    });
    
    return report;
  }

  /**
   * Check for retention policy compliance
   */
  checkRetentionCompliance(): {
    compliant: boolean;
    oldestLog?: Date;
    requiresArchival: boolean;
  } {
    const logs = this.getLocalLogs();
    if (logs.length === 0) {
      return { compliant: true, requiresArchival: false };
    }
    
    const oldestLog = new Date(logs[logs.length - 1].timestamp);
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() - this.RETENTION_YEARS);
    
    return {
      compliant: oldestLog >= retentionDate,
      oldestLog,
      requiresArchival: logs.length > this.MAX_LOCAL_LOGS * 0.8
    };
  }

  // Private methods
  
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private storeLocal(entry: AuditLogEntry): void {
    try {
      const logs = this.getLocalLogs();
      logs.unshift(entry); // Add to beginning
      
      // Limit local storage size
      if (logs.length > this.MAX_LOCAL_LOGS) {
        logs.splice(this.MAX_LOCAL_LOGS);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to store audit log locally:', error);
    }
  }

  private getLocalLogs(): AuditLogEntry[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private async sendToBackend(entry: AuditLogEntry): Promise<void> {
    // In production, this would send to a secure backend
    // For MVP, we're just storing locally
    try {
      // Mock API call
      if (process.env.NODE_ENV === 'production') {
        // await apiClient.post('/audit/log', entry);
      }
    } catch (error) {
      console.error('Failed to send audit log to backend:', error);
    }
  }

  private checkForSuspiciousActivity(entry: AuditLogEntry): void {
    // Check for patterns that might indicate suspicious activity
    const recentLogs = this.getLogs({
      userId: entry.userId,
      startDate: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    });
    
    // Multiple failed attempts
    const failedAttempts = recentLogs.filter(l => l.result === 'failure').length;
    if (failedAttempts >= 3) {
      this.log({
        event: AuditEventType.SUSPICIOUS_ACTIVITY,
        action: 'Multiple failed attempts detected',
        userId: entry.userId,
        result: 'warning',
        details: { failedAttempts, timeWindow: '5 minutes' }
      });
    }
    
    // Rapid PHI access
    const phiAccess = recentLogs.filter(l => l.phiAccessed).length;
    if (phiAccess >= 10) {
      this.log({
        event: AuditEventType.SUSPICIOUS_ACTIVITY,
        action: 'Rapid PHI access detected',
        userId: entry.userId,
        result: 'warning',
        details: { phiAccessCount: phiAccess, timeWindow: '5 minutes' }
      });
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Export convenience functions
export const logPHIAccess = auditLogger.logPHIAccess.bind(auditLogger);
export const logAuth = auditLogger.logAuth.bind(auditLogger);
export const logSecurity = auditLogger.logSecurity.bind(auditLogger);
export const getAuditLogs = auditLogger.getLogs.bind(auditLogger);
export const generateAuditReport = auditLogger.generateReport.bind(auditLogger);