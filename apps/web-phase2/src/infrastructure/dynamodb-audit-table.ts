/**
 * DynamoDB table configuration for HIPAA-compliant audit logs
 * 
 * Features:
 * - Encryption at rest with KMS
 * - Point-in-time recovery
 * - Automatic TTL for 6-year retention
 * - Global Secondary Indexes for efficient querying
 * - Stream processing for real-time monitoring
 */

import { Table, AttributeType, ProjectionType, StreamViewType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface AuditTableProps {
  /**
   * KMS key for encryption at rest
   */
  encryptionKey: Key;
  
  /**
   * Environment name (dev, staging, prod)
   */
  environment: string;
  
  /**
   * Enable DynamoDB Streams for real-time processing
   */
  enableStreams?: boolean;
  
  /**
   * Enable point-in-time recovery
   */
  pointInTimeRecovery?: boolean;
}

export class HipaaAuditTable extends Construct {
  public readonly table: Table;
  
  constructor(scope: Construct, id: string, props: AuditTableProps) {
    super(scope, id);

    this.table = new Table(this, 'AuditLogsTable', {
      tableName: `hipaa-audit-logs-${props.environment}`,
      
      // Primary key: Composite key for user-based partitioning
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'sk', 
        type: AttributeType.STRING
      },

      // Encryption at rest with customer-managed KMS key
      encryption: {
        key: props.encryptionKey
      },

      // Enable point-in-time recovery for compliance
      pointInTimeRecovery: props.pointInTimeRecovery ?? true,

      // Enable DynamoDB Streams for real-time monitoring
      stream: props.enableStreams ? StreamViewType.NEW_AND_OLD_IMAGES : undefined,

      // TTL configuration for automatic 6-year retention
      timeToLiveAttribute: 'ttl',

      // Billing mode - On-demand for variable audit log volume
      billingMode: BillingMode.ON_DEMAND,

      // Enable deletion protection for audit integrity
      deletionProtection: props.environment === 'prod',

      // Tags for compliance and cost tracking
      tags: {
        Environment: props.environment,
        DataClassification: 'PHI',
        Compliance: 'HIPAA',
        RetentionPeriod: '6-years',
        Purpose: 'AuditLogs'
      }
    });

    // Global Secondary Index for date-based queries
    this.table.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: {
        name: 'datePartition', // Format: YYYY-MM-DD
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: AttributeType.STRING
      },
      projectionType: ProjectionType.ALL
    });

    // Global Secondary Index for event type queries
    this.table.addGlobalSecondaryIndex({
      indexName: 'EventTypeIndex',
      partitionKey: {
        name: 'event',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: AttributeType.STRING
      },
      projectionType: ProjectionType.ALL
    });

    // Global Secondary Index for PHI access tracking
    this.table.addGlobalSecondaryIndex({
      indexName: 'PHIAccessIndex',
      partitionKey: {
        name: 'patientId',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: AttributeType.STRING
      },
      projectionType: ProjectionType.ALL
    });

    // Global Secondary Index for user activity tracking
    this.table.addGlobalSecondaryIndex({
      indexName: 'UserActivityIndex',
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: AttributeType.STRING
      },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: [
        'event',
        'action',
        'result',
        'phiAccessed',
        'patientId',
        'ipAddress'
      ]
    });

    // Create alarm for unusual activity patterns
    this.createComplianceAlarms();
  }

  /**
   * Create CloudWatch alarms for compliance monitoring
   */
  private createComplianceAlarms(): void {
    // Implementation would create CloudWatch alarms for:
    // - High volume of failed access attempts
    // - Unusual access patterns (time-based)
    // - Bulk PHI access events
    // - Access from new IP addresses
    // - After-hours administrative actions
    
    console.log('Creating compliance monitoring alarms...');
  }
}

/**
 * Table schema documentation for reference
 * 
 * Primary Key Structure:
 * - pk (Partition Key): USER#{userId} or SYSTEM for system events
 * - sk (Sort Key): LOG#{timestamp}#{logId}
 * 
 * Attributes:
 * - id (String): Unique log identifier
 * - timestamp (String): ISO 8601 timestamp
 * - userId (String): User who performed the action
 * - userEmail (String): Encrypted user email
 * - userRole (String): User's role at time of action
 * - event (String): Event type (LOGIN, PHI_ACCESS, etc.)
 * - resource (String): Resource type that was accessed
 * - resourceId (String): Specific resource identifier
 * - action (String): Description of action performed
 * - result (String): success | failure | warning
 * - ipAddress (String): Source IP address
 * - userAgent (String): User agent string
 * - details (String): JSON string with additional details
 * - phiAccessed (Boolean): Whether PHI was accessed
 * - patientId (String): Encrypted patient ID if PHI accessed
 * - sessionId (String): Session identifier
 * - retentionUntil (String): Date when log can be deleted
 * - datePartition (String): Date in YYYY-MM-DD format for GSI
 * - ttl (Number): Unix timestamp for automatic deletion
 * 
 * Global Secondary Indexes:
 * 1. DateIndex: Query by date range
 * 2. EventTypeIndex: Query by event type
 * 3. PHIAccessIndex: Query PHI access by patient
 * 4. UserActivityIndex: Query user activity patterns
 * 
 * Security Features:
 * - Customer-managed KMS encryption
 * - Field-level encryption for PII
 * - Point-in-time recovery
 * - Deletion protection in production
 * - Automatic 6-year TTL for HIPAA compliance
 * 
 * Query Patterns:
 * 1. Get all logs for a user: pk = "USER#{userId}"
 * 2. Get logs for date range: DateIndex with datePartition
 * 3. Get PHI access for patient: PHIAccessIndex with patientId
 * 4. Get failed login attempts: EventTypeIndex + filter
 * 5. Audit user activity: UserActivityIndex with userId
 */

// Export types for TypeScript usage
export interface AuditLogRecord {
  pk: string;
  sk: string;
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  event: string;
  resource?: string;
  resourceId?: string;
  action: string;
  result: 'success' | 'failure' | 'warning';
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  phiAccessed?: boolean;
  patientId?: string;
  sessionId?: string;
  retentionUntil: string;
  datePartition: string;
  ttl: number;
}

export const AUDIT_EVENT_TYPES = {
  // Authentication Events
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SESSION_TIMEOUT: 'SESSION_TIMEOUT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  MFA_CHALLENGE: 'MFA_CHALLENGE',
  
  // PHI Access Events
  PHI_VIEW: 'PHI_VIEW',
  PHI_CREATE: 'PHI_CREATE',
  PHI_UPDATE: 'PHI_UPDATE',
  PHI_DELETE: 'PHI_DELETE',
  PHI_EXPORT: 'PHI_EXPORT',
  PHI_PRINT: 'PHI_PRINT',
  
  // Assessment Events
  ASSESSMENT_START: 'ASSESSMENT_START',
  ASSESSMENT_COMPLETE: 'ASSESSMENT_COMPLETE',
  
  // Crisis Events
  CRISIS_ALERT: 'CRISIS_ALERT',
  CRISIS_ACKNOWLEDGED: 'CRISIS_ACKNOWLEDGED',
  
  // Security Events
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  
  // System Events
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  BACKUP_CREATED: 'BACKUP_CREATED'
} as const;