/**
 * SessionTimeout Utility for HIPAA-compliant session management
 * Implements 15-minute PHI access timeout with 13-minute warning
 */

export interface SessionTimeoutOptions {
  timeoutDuration?: number; // milliseconds (default: 15 minutes)
  warningDuration?: number; // milliseconds (default: 13 minutes)
  onTimeout?: () => void;
  onWarning?: () => void;
  onActivity?: () => void;
  enableAuditLogging?: boolean;
}

export interface AuditLogEntry {
  timestamp: string;
  event: 'session_start' | 'session_warning' | 'session_timeout' | 'session_extend' | 'user_activity';
  userId?: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  phiAccessed?: boolean;
}

export class SessionTimeout {
  private timeoutId: NodeJS.Timeout | null = null;
  private warningId: NodeJS.Timeout | null = null;
  private options: Required<SessionTimeoutOptions>;
  private sessionId: string;
  private startTime: number;
  private lastActivity: number;

  constructor(options: SessionTimeoutOptions = {}) {
    this.options = {
      timeoutDuration: 15 * 60 * 1000, // 15 minutes
      warningDuration: 13 * 60 * 1000, // 13 minutes  
      onTimeout: () => {},
      onWarning: () => {},
      onActivity: () => {},
      enableAuditLogging: true,
      ...options
    };

    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.lastActivity = Date.now();

    if (this.options.enableAuditLogging) {
      this.logAuditEvent('session_start');
    }
  }

  /**
   * Start the session timeout monitoring
   */
  start(): void {
    this.clearTimers();
    
    // Set warning timer
    this.warningId = setTimeout(() => {
      if (this.options.enableAuditLogging) {
        this.logAuditEvent('session_warning');
      }
      this.options.onWarning();
    }, this.options.warningDuration);

    // Set timeout timer
    this.timeoutId = setTimeout(() => {
      if (this.options.enableAuditLogging) {
        this.logAuditEvent('session_timeout', true);
      }
      this.options.onTimeout();
      this.destroy();
    }, this.options.timeoutDuration);
  }

  /**
   * Reset the session timer due to user activity
   */
  resetTimer(): void {
    this.lastActivity = Date.now();
    
    if (this.options.enableAuditLogging) {
      this.logAuditEvent('user_activity');
    }
    
    this.options.onActivity();
    this.start(); // Restart timers
  }

  /**
   * Extend the session manually (for explicit user action)
   */
  extendSession(additionalTime?: number): void {
    const extension = additionalTime || this.options.timeoutDuration;
    
    if (this.options.enableAuditLogging) {
      this.logAuditEvent('session_extend');
    }

    this.clearTimers();
    
    // Extend warning time
    this.warningId = setTimeout(() => {
      if (this.options.enableAuditLogging) {
        this.logAuditEvent('session_warning');
      }
      this.options.onWarning();
    }, this.options.warningDuration);

    // Extend timeout
    this.timeoutId = setTimeout(() => {
      if (this.options.enableAuditLogging) {
        this.logAuditEvent('session_timeout', true);
      }
      this.options.onTimeout();
      this.destroy();
    }, extension);
  }

  /**
   * Get current session information
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      lastActivity: this.lastActivity,
      timeRemaining: this.getTimeRemaining(),
      isActive: this.timeoutId !== null
    };
  }

  /**
   * Get time remaining before timeout
   */
  getTimeRemaining(): number {
    const elapsed = Date.now() - this.lastActivity;
    return Math.max(0, this.options.timeoutDuration - elapsed);
  }

  /**
   * Clean up timers and resources
   */
  destroy(): void {
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.warningId) {
      clearTimeout(this.warningId);
      this.warningId = null;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logAuditEvent(
    event: AuditLogEntry['event'], 
    phiAccessed: boolean = false
  ): void {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      event,
      sessionId: this.sessionId,
      phiAccessed,
      userId: this.getCurrentUserId(),
      ipAddress: this.getClientIP(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined
    };

    // Store in localStorage for testing, production would use secure backend
    const existingLogs = this.getStoredAuditLogs();
    existingLogs.push(auditEntry);
    
    try {
      localStorage.setItem('hipaa_audit_logs', JSON.stringify(existingLogs));
    } catch (error) {
      console.error('Failed to store audit log:', error);
    }
  }

  private getStoredAuditLogs(): AuditLogEntry[] {
    try {
      const stored = localStorage.getItem('hipaa_audit_logs');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      return [];
    }
  }

  private getCurrentUserId(): string | undefined {
    // In real implementation, get from auth context
    try {
      const user = localStorage.getItem('current_user');
      return user ? JSON.parse(user).id : undefined;
    } catch {
      return undefined;
    }
  }

  private getClientIP(): string | undefined {
    // In real implementation, get from server or auth service
    return undefined; // Would be populated server-side
  }

  /**
   * Get audit logs for compliance reporting
   */
  static getAuditLogs(
    startDate?: Date,
    endDate?: Date,
    eventType?: AuditLogEntry['event']
  ): AuditLogEntry[] {
    try {
      const stored = localStorage.getItem('hipaa_audit_logs');
      let logs: AuditLogEntry[] = stored ? JSON.parse(stored) : [];

      // Filter by date range
      if (startDate || endDate) {
        logs = logs.filter(log => {
          const logDate = new Date(log.timestamp);
          if (startDate && logDate < startDate) return false;
          if (endDate && logDate > endDate) return false;
          return true;
        });
      }

      // Filter by event type
      if (eventType) {
        logs = logs.filter(log => log.event === eventType);
      }

      return logs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      return [];
    }
  }

  /**
   * Clear audit logs (for testing only)
   */
  static clearAuditLogs(): void {
    try {
      localStorage.removeItem('hipaa_audit_logs');
    } catch (error) {
      console.error('Failed to clear audit logs:', error);
    }
  }
}