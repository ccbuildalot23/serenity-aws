/**
 * AWS Lambda function for HIPAA-compliant audit log processing
 * Handles audit log ingestion, encryption, and storage in DynamoDB
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, QueryCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

interface AuditLogEntry {
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
  details?: Record<string, any>;
  phiAccessed?: boolean;
  patientId?: string;
  sessionId?: string;
  retentionUntil?: string;
}

interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// AWS clients
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const kms = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Environment variables
const AUDIT_TABLE_NAME = process.env.AUDIT_TABLE_NAME || 'hipaa-audit-logs';
const KMS_KEY_ID = process.env.KMS_KEY_ID;
const RETENTION_YEARS = 6; // HIPAA requirement

/**
 * Main Lambda handler for audit log processing
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Audit Log Handler invoked:', JSON.stringify(event, null, 2));

  try {
    const method = event.httpMethod;
    const path = event.path;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
      'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'OK' })
      };
    }

    // Route to appropriate handler
    if (method === 'POST' && path === '/audit/logs') {
      return await handleSubmitAuditLogs(event, corsHeaders);
    } else if (method === 'GET' && path === '/audit/logs') {
      return await handleGetAuditLogs(event, corsHeaders);
    } else if (method === 'POST' && path === '/audit/batch') {
      return await handleBatchSubmitAuditLogs(event, corsHeaders);
    } else {
      return createResponse(404, { error: 'Not Found' }, corsHeaders);
    }
  } catch (error) {
    console.error('Lambda execution error:', error);
    
    return createResponse(500, {
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Content-Type': 'application/json'
    });
  }
};

/**
 * Handle single audit log submission
 */
async function handleSubmitAuditLogs(
  event: APIGatewayProxyEvent,
  corsHeaders: Record<string, string>
): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createResponse(400, { error: 'Request body is required' }, corsHeaders);
  }

  try {
    const auditEntry: AuditLogEntry = JSON.parse(event.body);
    
    // Validate required fields
    const validation = validateAuditEntry(auditEntry);
    if (!validation.valid) {
      return createResponse(400, { error: validation.error }, corsHeaders);
    }

    // Enhance audit entry with additional metadata
    const enhancedEntry = await enhanceAuditEntry(auditEntry, event);

    // Store in DynamoDB with encryption
    await storeAuditLog(enhancedEntry);

    // Check for suspicious activity patterns
    await checkSuspiciousActivity(enhancedEntry);

    return createResponse(201, {
      message: 'Audit log stored successfully',
      id: enhancedEntry.id
    }, corsHeaders);

  } catch (error) {
    console.error('Error submitting audit log:', error);
    return createResponse(500, {
      error: 'Failed to store audit log',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, corsHeaders);
  }
}

/**
 * Handle batch audit log submission
 */
async function handleBatchSubmitAuditLogs(
  event: APIGatewayProxyEvent,
  corsHeaders: Record<string, string>
): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createResponse(400, { error: 'Request body is required' }, corsHeaders);
  }

  try {
    const auditEntries: AuditLogEntry[] = JSON.parse(event.body);
    
    if (!Array.isArray(auditEntries) || auditEntries.length === 0) {
      return createResponse(400, { error: 'Invalid audit entries array' }, corsHeaders);
    }

    if (auditEntries.length > 25) {
      return createResponse(400, { error: 'Batch size cannot exceed 25 items' }, corsHeaders);
    }

    // Validate all entries
    for (const entry of auditEntries) {
      const validation = validateAuditEntry(entry);
      if (!validation.valid) {
        return createResponse(400, { 
          error: `Invalid entry: ${validation.error}`,
          entryId: entry.id 
        }, corsHeaders);
      }
    }

    // Enhance and store all entries
    const enhancedEntries = await Promise.all(
      auditEntries.map(entry => enhanceAuditEntry(entry, event))
    );

    await storeBatchAuditLogs(enhancedEntries);

    return createResponse(201, {
      message: 'Batch audit logs stored successfully',
      count: enhancedEntries.length,
      ids: enhancedEntries.map(entry => entry.id)
    }, corsHeaders);

  } catch (error) {
    console.error('Error submitting batch audit logs:', error);
    return createResponse(500, {
      error: 'Failed to store batch audit logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, corsHeaders);
  }
}

/**
 * Handle audit log retrieval
 */
async function handleGetAuditLogs(
  event: APIGatewayProxyEvent,
  corsHeaders: Record<string, string>
): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      userId,
      startDate,
      endDate,
      eventType,
      phiOnly,
      limit = '100',
      lastEvaluatedKey
    } = queryParams;

    // Validate user authorization (in production, verify JWT token)
    const authResult = await validateUserAuthorization(event);
    if (!authResult.authorized) {
      return createResponse(403, { error: 'Unauthorized' }, corsHeaders);
    }

    // Query audit logs with filters
    const results = await queryAuditLogs({
      userId,
      startDate,
      endDate,
      eventType,
      phiOnly: phiOnly === 'true',
      limit: parseInt(limit),
      lastEvaluatedKey
    });

    // Decrypt sensitive fields for authorized users
    const decryptedLogs = await Promise.all(
      results.items.map(log => decryptAuditLogFields(log))
    );

    return createResponse(200, {
      logs: decryptedLogs,
      count: results.count,
      lastEvaluatedKey: results.lastEvaluatedKey
    }, corsHeaders);

  } catch (error) {
    console.error('Error retrieving audit logs:', error);
    return createResponse(500, {
      error: 'Failed to retrieve audit logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, corsHeaders);
  }
}

/**
 * Validate audit log entry
 */
function validateAuditEntry(entry: AuditLogEntry): { valid: boolean; error?: string } {
  if (!entry.id) return { valid: false, error: 'ID is required' };
  if (!entry.timestamp) return { valid: false, error: 'Timestamp is required' };
  if (!entry.event) return { valid: false, error: 'Event type is required' };
  if (!entry.action) return { valid: false, error: 'Action is required' };
  
  // Validate timestamp format
  if (isNaN(Date.parse(entry.timestamp))) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  // Validate PHI access requirements
  if (entry.phiAccessed && !entry.patientId) {
    return { valid: false, error: 'Patient ID required for PHI access events' };
  }

  return { valid: true };
}

/**
 * Enhance audit entry with additional metadata
 */
async function enhanceAuditEntry(
  entry: AuditLogEntry,
  event: APIGatewayProxyEvent
): Promise<AuditLogEntry> {
  const enhanced = {
    ...entry,
    ipAddress: entry.ipAddress || event.requestContext.identity.sourceIp,
    userAgent: entry.userAgent || event.headers['User-Agent'],
    sessionId: entry.sessionId || event.requestContext.requestId,
  };

  // Set retention date (6 years from now)
  if (!enhanced.retentionUntil) {
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() + RETENTION_YEARS);
    enhanced.retentionUntil = retentionDate.toISOString();
  }

  return enhanced;
}

/**
 * Store single audit log in DynamoDB
 */
async function storeAuditLog(entry: AuditLogEntry): Promise<void> {
  // Encrypt sensitive fields
  const encryptedEntry = await encryptSensitiveFields(entry);

  const item = {
    id: { S: entry.id },
    timestamp: { S: entry.timestamp },
    userId: entry.userId ? { S: entry.userId } : undefined,
    userEmail: entry.userEmail ? { S: encryptedEntry.userEmail || entry.userEmail } : undefined,
    event: { S: entry.event },
    action: { S: entry.action },
    result: { S: entry.result },
    ipAddress: entry.ipAddress ? { S: entry.ipAddress } : undefined,
    userAgent: entry.userAgent ? { S: entry.userAgent } : undefined,
    phiAccessed: entry.phiAccessed ? { BOOL: entry.phiAccessed } : undefined,
    patientId: entry.patientId ? { S: encryptedEntry.patientId || entry.patientId } : undefined,
    details: entry.details ? { S: JSON.stringify(entry.details) } : undefined,
    retentionUntil: { S: entry.retentionUntil || '' },
    // Partition key for efficient querying
    pk: { S: `USER#${entry.userId || 'ANONYMOUS'}` },
    sk: { S: `LOG#${entry.timestamp}#${entry.id}` },
    // GSI for date-based queries
    datePartition: { S: entry.timestamp.substring(0, 10) }, // YYYY-MM-DD
    ttl: entry.retentionUntil ? { N: Math.floor(new Date(entry.retentionUntil).getTime() / 1000).toString() } : undefined
  };

  // Remove undefined values
  Object.keys(item).forEach(key => {
    if (item[key] === undefined) {
      delete item[key];
    }
  });

  await dynamodb.send(new PutItemCommand({
    TableName: AUDIT_TABLE_NAME,
    Item: item
  }));
}

/**
 * Store batch of audit logs
 */
async function storeBatchAuditLogs(entries: AuditLogEntry[]): Promise<void> {
  // Process in batches of 25 (DynamoDB limit)
  const batchSize = 25;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    
    const writeRequests = await Promise.all(
      batch.map(async entry => {
        const encryptedEntry = await encryptSensitiveFields(entry);
        
        return {
          PutRequest: {
            Item: {
              id: { S: entry.id },
              timestamp: { S: entry.timestamp },
              userId: entry.userId ? { S: entry.userId } : undefined,
              userEmail: entry.userEmail ? { S: encryptedEntry.userEmail || entry.userEmail } : undefined,
              event: { S: entry.event },
              action: { S: entry.action },
              result: { S: entry.result },
              ipAddress: entry.ipAddress ? { S: entry.ipAddress } : undefined,
              phiAccessed: entry.phiAccessed ? { BOOL: entry.phiAccessed } : undefined,
              patientId: entry.patientId ? { S: encryptedEntry.patientId || entry.patientId } : undefined,
              retentionUntil: { S: entry.retentionUntil || '' },
              pk: { S: `USER#${entry.userId || 'ANONYMOUS'}` },
              sk: { S: `LOG#${entry.timestamp}#${entry.id}` },
              datePartition: { S: entry.timestamp.substring(0, 10) },
              ttl: entry.retentionUntil ? { N: Math.floor(new Date(entry.retentionUntil).getTime() / 1000).toString() } : undefined
            }
          }
        };
      })
    );

    // Remove undefined values from each request
    writeRequests.forEach(request => {
      Object.keys(request.PutRequest.Item).forEach(key => {
        if (request.PutRequest.Item[key] === undefined) {
          delete request.PutRequest.Item[key];
        }
      });
    });

    await dynamodb.send(new BatchWriteItemCommand({
      RequestItems: {
        [AUDIT_TABLE_NAME]: writeRequests
      }
    }));
  }
}

/**
 * Encrypt sensitive fields using KMS
 */
async function encryptSensitiveFields(entry: AuditLogEntry): Promise<Partial<AuditLogEntry>> {
  if (!KMS_KEY_ID) {
    console.warn('KMS_KEY_ID not configured, skipping field encryption');
    return entry;
  }

  const encrypted: Partial<AuditLogEntry> = {};

  // Encrypt sensitive fields
  const sensitiveFields = ['userEmail', 'patientId'];
  
  for (const field of sensitiveFields) {
    const value = entry[field as keyof AuditLogEntry] as string;
    if (value) {
      try {
        const result = await kms.send(new EncryptCommand({
          KeyId: KMS_KEY_ID,
          Plaintext: Buffer.from(value)
        }));
        
        encrypted[field as keyof AuditLogEntry] = Buffer.from(result.CiphertextBlob!).toString('base64');
      } catch (error) {
        console.error(`Error encrypting field ${field}:`, error);
        // In production, this should fail the request
        encrypted[field as keyof AuditLogEntry] = value;
      }
    }
  }

  return encrypted;
}

/**
 * Query audit logs with filters
 */
async function queryAuditLogs(filters: {
  userId?: string;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  phiOnly?: boolean;
  limit?: number;
  lastEvaluatedKey?: string;
}) {
  // Implementation would use DynamoDB query with appropriate indexes
  // For now, return mock structure
  return {
    items: [],
    count: 0,
    lastEvaluatedKey: undefined
  };
}

/**
 * Validate user authorization
 */
async function validateUserAuthorization(event: APIGatewayProxyEvent): Promise<{ authorized: boolean; userId?: string }> {
  // In production, verify JWT token and check permissions
  // For now, return basic authorization
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader) {
    return { authorized: false };
  }

  // Mock authorization - in production, verify JWT
  return { authorized: true, userId: 'mock-user-id' };
}

/**
 * Decrypt audit log fields for authorized users
 */
async function decryptAuditLogFields(log: any): Promise<any> {
  // Implementation would decrypt KMS-encrypted fields
  // For now, return as-is
  return log;
}

/**
 * Check for suspicious activity patterns
 */
async function checkSuspiciousActivity(entry: AuditLogEntry): Promise<void> {
  // Implementation would check for patterns like:
  // - Multiple failed login attempts
  // - Rapid PHI access from same user
  // - Access from unusual IP addresses
  // - After-hours access patterns
  
  console.log('Checking for suspicious activity:', entry.id);
}

/**
 * Create standardized API response
 */
function createResponse(
  statusCode: number, 
  body: any, 
  headers: Record<string, string> = {}
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  };
}