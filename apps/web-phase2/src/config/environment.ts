/**
 * Environment Configuration for HIPAA-Compliant Healthcare Platform
 * 
 * Manages environment variables, encryption keys, and security settings
 * across development, staging, and production environments.
 */

import { z } from 'zod';

// Environment validation schema
const EnvironmentSchema = z.object({
  // Application Environment
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  APP_NAME: z.string().default('Serenity Health Platform'),
  APP_VERSION: z.string().default('1.0.0'),
  
  // API Configuration
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  API_PORT: z.coerce.number().default(3001),
  
  // Database Configuration
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.coerce.boolean().default(true),
  
  // AWS Configuration
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCOUNT_ID: z.string().optional(),
  
  // Cognito Authentication
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: z.string().optional(),
  NEXT_PUBLIC_COGNITO_CLIENT_ID: z.string().optional(),
  COGNITO_USER_POOL_DOMAIN: z.string().optional(),
  
  // Encryption and Security
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  KMS_KEY_ID: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  
  // Audit Logging
  AUDIT_TABLE_NAME: z.string().default('hipaa-audit-logs'),
  AUDIT_RETENTION_YEARS: z.coerce.number().default(6),
  
  // HIPAA Compliance
  HIPAA_ENCRYPTION_REQUIRED: z.coerce.boolean().default(true),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().default(15),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(3),
  PASSWORD_MIN_LENGTH: z.coerce.number().default(12),
  
  // Monitoring and Alerting
  SENTRY_DSN: z.string().optional(),
  CLOUDWATCH_LOG_GROUP: z.string().default('/aws/lambda/serenity'),
  ENABLE_PERFORMANCE_MONITORING: z.coerce.boolean().default(true),
  
  // Email and Notifications
  SES_FROM_EMAIL: z.string().email().optional(),
  SNS_CRISIS_TOPIC_ARN: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // CORS Configuration
  ALLOWED_ORIGINS: z.string().transform(str => str.split(',')).optional(),
  
  // Feature Flags
  ENABLE_CRISIS_DETECTION: z.coerce.boolean().default(true),
  ENABLE_AUDIT_LOGGING: z.coerce.boolean().default(true),
  ENABLE_COST_MONITORING: z.coerce.boolean().default(true),
  
  // Development/Testing
  MOCK_EXTERNAL_SERVICES: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_DEBUG_LOGGING: z.coerce.boolean().default(false)
});

type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Environment Configuration Class
 */
class EnvironmentConfig {
  private config: Environment;
  private isProduction: boolean;
  private isDevelopment: boolean;
  private isStaging: boolean;

  constructor() {
    this.config = this.loadAndValidateConfig();
    this.isProduction = this.config.NODE_ENV === 'production';
    this.isDevelopment = this.config.NODE_ENV === 'development';
    this.isStaging = this.config.NODE_ENV === 'staging';
    
    this.validateProductionSecurity();
  }

  /**
   * Load and validate environment configuration
   */
  private loadAndValidateConfig(): Environment {
    try {
      // Generate default encryption keys if not provided in development
      const processEnv = {
        ...process.env,
        ...this.generateDefaultKeys()
      };
      
      const parsed = EnvironmentSchema.parse(processEnv);
      
      console.log('✅ Environment configuration loaded successfully');
      console.log(`📦 Environment: ${parsed.NODE_ENV}`);
      console.log(`🏥 App: ${parsed.APP_NAME} v${parsed.APP_VERSION}`);
      
      return parsed;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Environment validation failed:');
        error.issues.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        throw new Error('Invalid environment configuration');
      }
      throw error;
    }
  }

  /**
   * Generate default encryption keys for development
   */
  private generateDefaultKeys(): Partial<Environment> {
    if (process.env.NODE_ENV === 'production') {
      return {}; // Never generate keys in production
    }

    const defaults: Partial<Environment> = {};

    // Generate encryption key if missing
    if (!process.env.ENCRYPTION_KEY) {
      defaults.ENCRYPTION_KEY = this.generateSecureKey(32);
      console.log('⚠️  Generated default encryption key for development');
    }

    // Generate JWT secret if missing
    if (!process.env.JWT_SECRET) {
      defaults.JWT_SECRET = this.generateSecureKey(64);
      console.log('⚠️  Generated default JWT secret for development');
    }

    return defaults;
  }

  /**
   * Generate a cryptographically secure key
   */
  private generateSecureKey(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
      }
    } else {
      // Fallback for Node.js environments
      const crypto = require('crypto');
      const buffer = crypto.randomBytes(length);
      for (let i = 0; i < length; i++) {
        result += chars[buffer[i] % chars.length];
      }
    }
    
    return result;
  }

  /**
   * Validate production security requirements
   */
  private validateProductionSecurity(): void {
    if (!this.isProduction) return;

    const requiredForProduction = [
      'ENCRYPTION_KEY',
      'JWT_SECRET',
      'KMS_KEY_ID',
      'AUDIT_TABLE_NAME',
      'AWS_ACCOUNT_ID'
    ];

    const missing = requiredForProduction.filter(
      key => !this.config[key as keyof Environment]
    );

    if (missing.length > 0) {
      throw new Error(
        `Production environment missing required variables: ${missing.join(', ')}`
      );
    }

    // Validate encryption key strength
    if (this.config.ENCRYPTION_KEY.length < 32) {
      throw new Error('Production encryption key must be at least 32 characters');
    }

    // Validate default keys are not used in production
    if (this.config.ENCRYPTION_KEY.includes('default') || 
        this.config.JWT_SECRET.includes('default')) {
      throw new Error('Cannot use default keys in production environment');
    }

    console.log('🔒 Production security validation passed');
  }

  /**
   * Get configuration value
   */
  get<K extends keyof Environment>(key: K): Environment[K] {
    return this.config[key];
  }

  /**
   * Check if in production environment
   */
  get production(): boolean {
    return this.isProduction;
  }

  /**
   * Check if in development environment
   */
  get development(): boolean {
    return this.isDevelopment;
  }

  /**
   * Check if in staging environment
   */
  get staging(): boolean {
    return this.isStaging;
  }

  /**
   * Get encryption configuration
   */
  get encryption() {
    return {
      key: this.config.ENCRYPTION_KEY,
      kmsKeyId: this.config.KMS_KEY_ID,
      required: this.config.HIPAA_ENCRYPTION_REQUIRED
    };
  }

  /**
   * Get authentication configuration
   */
  get auth() {
    return {
      userPoolId: this.config.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      clientId: this.config.NEXT_PUBLIC_COGNITO_CLIENT_ID,
      domain: this.config.COGNITO_USER_POOL_DOMAIN,
      jwtSecret: this.config.JWT_SECRET,
      sessionTimeoutMinutes: this.config.SESSION_TIMEOUT_MINUTES,
      maxLoginAttempts: this.config.MAX_LOGIN_ATTEMPTS,
      passwordMinLength: this.config.PASSWORD_MIN_LENGTH
    };
  }

  /**
   * Get AWS configuration
   */
  get aws() {
    return {
      region: this.config.AWS_REGION,
      accountId: this.config.AWS_ACCOUNT_ID,
      auditTableName: this.config.AUDIT_TABLE_NAME,
      cloudWatchLogGroup: this.config.CLOUDWATCH_LOG_GROUP
    };
  }

  /**
   * Get HIPAA compliance configuration
   */
  get hipaa() {
    return {
      encryptionRequired: this.config.HIPAA_ENCRYPTION_REQUIRED,
      sessionTimeoutMinutes: this.config.SESSION_TIMEOUT_MINUTES,
      auditRetentionYears: this.config.AUDIT_RETENTION_YEARS,
      auditLoggingEnabled: this.config.ENABLE_AUDIT_LOGGING
    };
  }

  /**
   * Get rate limiting configuration
   */
  get rateLimiting() {
    return {
      windowMs: this.config.RATE_LIMIT_WINDOW_MS,
      maxRequests: this.config.RATE_LIMIT_MAX_REQUESTS
    };
  }

  /**
   * Get notification configuration
   */
  get notifications() {
    return {
      sesFromEmail: this.config.SES_FROM_EMAIL,
      snsCrisisTopicArn: this.config.SNS_CRISIS_TOPIC_ARN,
      adminEmail: this.config.ADMIN_EMAIL
    };
  }

  /**
   * Get feature flags
   */
  get features() {
    return {
      crisisDetection: this.config.ENABLE_CRISIS_DETECTION,
      auditLogging: this.config.ENABLE_AUDIT_LOGGING,
      costMonitoring: this.config.ENABLE_COST_MONITORING,
      performanceMonitoring: this.config.ENABLE_PERFORMANCE_MONITORING
    };
  }

  /**
   * Get logging configuration
   */
  get logging() {
    return {
      level: this.config.LOG_LEVEL,
      enableDebug: this.config.ENABLE_DEBUG_LOGGING,
      sentryDsn: this.config.SENTRY_DSN
    };
  }

  /**
   * Export environment variables for deployment
   */
  exportForDeployment(): Record<string, string> {
    return {
      NODE_ENV: this.config.NODE_ENV,
      ENCRYPTION_KEY: this.config.ENCRYPTION_KEY,
      KMS_KEY_ID: this.config.KMS_KEY_ID || '',
      JWT_SECRET: this.config.JWT_SECRET,
      AUDIT_TABLE_NAME: this.config.AUDIT_TABLE_NAME,
      AWS_REGION: this.config.AWS_REGION,
      SESSION_TIMEOUT_MINUTES: this.config.SESSION_TIMEOUT_MINUTES.toString(),
      HIPAA_ENCRYPTION_REQUIRED: this.config.HIPAA_ENCRYPTION_REQUIRED.toString(),
      ENABLE_AUDIT_LOGGING: this.config.ENABLE_AUDIT_LOGGING.toString()
    };
  }

  /**
   * Validate environment for HIPAA compliance
   */
  validateHipaaCompliance(): { compliant: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.config.HIPAA_ENCRYPTION_REQUIRED) {
      issues.push('HIPAA encryption is not enabled');
    }

    if (this.config.SESSION_TIMEOUT_MINUTES > 15) {
      issues.push('Session timeout exceeds HIPAA requirement of 15 minutes');
    }

    if (!this.config.ENABLE_AUDIT_LOGGING) {
      issues.push('Audit logging is not enabled');
    }

    if (this.config.AUDIT_RETENTION_YEARS < 6) {
      issues.push('Audit retention period is less than required 6 years');
    }

    if (!this.config.KMS_KEY_ID && this.isProduction) {
      issues.push('KMS key not configured for production encryption');
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  }
}

// Create and export singleton instance
export const env = new EnvironmentConfig();

// Export types for TypeScript usage
export type { Environment };
export { EnvironmentSchema };

// Environment-specific constants
export const HIPAA_REQUIREMENTS = {
  SESSION_TIMEOUT_MAX_MINUTES: 15,
  AUDIT_RETENTION_YEARS: 6,
  PASSWORD_MIN_LENGTH: 12,
  ENCRYPTION_KEY_MIN_LENGTH: 32,
  MAX_LOGIN_ATTEMPTS: 3
} as const;

export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
} as const;