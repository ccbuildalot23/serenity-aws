#!/usr/bin/env node

/**
 * Deployment script for HIPAA-compliant audit log infrastructure
 * 
 * Deploys:
 * - DynamoDB table with encryption
 * - Lambda function for audit processing
 * - API Gateway endpoints
 * - KMS key for encryption
 * - CloudWatch monitoring
 */

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { RestApi, LambdaIntegration, Cors, AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { Key, KeyUsage, KeySpec } from 'aws-cdk-lib/aws-kms';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { HipaaAuditTable } from '../infrastructure/dynamodb-audit-table';

interface AuditInfrastructureProps extends StackProps {
  environment: string;
  allowedOrigins: string[];
}

class AuditInfrastructureStack extends Stack {
  public readonly auditTable: Table;
  public readonly auditFunction: Function;
  public readonly api: RestApi;
  public readonly encryptionKey: Key;

  constructor(scope: Construct, id: string, props: AuditInfrastructureProps) {
    super(scope, id, props);

    // Create KMS key for encryption
    this.encryptionKey = this.createEncryptionKey(props.environment);

    // Create DynamoDB table
    const auditTableConstruct = new HipaaAuditTable(this, 'AuditTable', {
      encryptionKey: this.encryptionKey,
      environment: props.environment,
      enableStreams: true,
      pointInTimeRecovery: true
    });
    this.auditTable = auditTableConstruct.table;

    // Create Lambda function
    this.auditFunction = this.createAuditFunction(props);

    // Create API Gateway
    this.api = this.createApiGateway(props);

    // Set up monitoring and alerts
    this.setupMonitoring();
  }

  /**
   * Create KMS key for audit log encryption
   */
  private createEncryptionKey(environment: string): Key {
    return new Key(this, 'AuditEncryptionKey', {
      description: `HIPAA audit log encryption key for ${environment}`,
      keyUsage: KeyUsage.ENCRYPT_DECRYPT,
      keySpec: KeySpec.SYMMETRIC_DEFAULT,
      enableKeyRotation: true,
      policy: {
        statements: [
          new PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: 'Allow',
            principals: [new ServicePrincipal('lambda.amazonaws.com')],
            actions: [
              'kms:Encrypt',
              'kms:Decrypt',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:DescribeKey'
            ],
            resources: ['*']
          })
        ]
      }
    });
  }

  /**
   * Create Lambda function for audit log processing
   */
  private createAuditFunction(props: AuditInfrastructureProps): Function {
    // Create IAM role for Lambda
    const lambdaRole = new Role(this, 'AuditLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        {
          managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
        }
      ],
      inlinePolicies: {
        AuditTableAccess: {
          statements: [
            new PolicyStatement({
              effect: 'Allow',
              actions: [
                'dynamodb:PutItem',
                'dynamodb:BatchWriteItem',
                'dynamodb:Query',
                'dynamodb:GetItem'
              ],
              resources: [
                this.auditTable.tableArn,
                `${this.auditTable.tableArn}/index/*`
              ]
            })
          ]
        },
        KMSAccess: {
          statements: [
            new PolicyStatement({
              effect: 'Allow',
              actions: [
                'kms:Encrypt',
                'kms:Decrypt',
                'kms:GenerateDataKey'
              ],
              resources: [this.encryptionKey.keyArn]
            })
          ]
        }
      }
    });

    // Create Lambda function
    const lambdaFunction = new Function(this, 'AuditLogHandler', {
      functionName: `audit-log-handler-${props.environment}`,
      runtime: Runtime.NODEJS_18_X,
      code: Code.fromAsset('dist/lambda'),
      handler: 'auditLogHandler.handler',
      role: lambdaRole,
      timeout: Duration.seconds(30),
      memorySize: 512,
      environment: {
        AUDIT_TABLE_NAME: this.auditTable.tableName,
        KMS_KEY_ID: this.encryptionKey.keyId,
        AWS_REGION: this.region,
        ALLOWED_ORIGINS: props.allowedOrigins.join(','),
        NODE_ENV: props.environment
      },
      description: `HIPAA-compliant audit log processing for ${props.environment}`,
      deadLetterQueue: {
        queue: new Queue(this, 'AuditDLQ', {
          queueName: `audit-dlq-${props.environment}`,
          encryption: QueueEncryption.KMS_MANAGED
        })
      }
    });

    return lambdaFunction;
  }

  /**
   * Create API Gateway for audit log endpoints
   */
  private createApiGateway(props: AuditInfrastructureProps): RestApi {
    const api = new RestApi(this, 'AuditLogApi', {
      restApiName: `audit-log-api-${props.environment}`,
      description: `HIPAA audit log API for ${props.environment}`,
      defaultCorsPreflightOptions: {
        allowOrigins: props.allowedOrigins,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ]
      },
      deployOptions: {
        stageName: props.environment,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: false, // Don't log request/response for security
        metricsEnabled: true
      }
    });

    // Lambda integration
    const lambdaIntegration = new LambdaIntegration(this.auditFunction, {
      requestTemplates: {
        'application/json': '{ "statusCode": "200" }'
      }
    });

    // Create audit resource
    const auditResource = api.root.addResource('audit');
    
    // Logs resource
    const logsResource = auditResource.addResource('logs');
    
    // POST /audit/logs - Submit single audit log
    logsResource.addMethod('POST', lambdaIntegration, {
      authorizationType: AuthorizationType.IAM, // Require AWS Signature V4
      requestValidator: new RequestValidator(this, 'AuditLogValidator', {
        restApi: api,
        requestValidatorName: 'audit-log-validator',
        validateRequestBody: true,
        validateRequestParameters: true
      }),
      requestModels: {
        'application/json': this.createAuditLogModel(api)
      }
    });

    // GET /audit/logs - Query audit logs
    logsResource.addMethod('GET', lambdaIntegration, {
      authorizationType: AuthorizationType.IAM,
      requestParameters: {
        'method.request.querystring.userId': false,
        'method.request.querystring.startDate': false,
        'method.request.querystring.endDate': false,
        'method.request.querystring.eventType': false,
        'method.request.querystring.phiOnly': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.lastEvaluatedKey': false
      }
    });

    // Batch resource
    const batchResource = auditResource.addResource('batch');
    
    // POST /audit/batch - Submit batch audit logs
    batchResource.addMethod('POST', lambdaIntegration, {
      authorizationType: AuthorizationType.IAM,
      requestValidator: new RequestValidator(this, 'BatchAuditLogValidator', {
        restApi: api,
        requestValidatorName: 'batch-audit-log-validator',
        validateRequestBody: true
      })
    });

    return api;
  }

  /**
   * Create JSON Schema model for audit log validation
   */
  private createAuditLogModel(api: RestApi) {
    return new Model(this, 'AuditLogModel', {
      restApi: api,
      modelName: 'AuditLogModel',
      contentType: 'application/json',
      schema: {
        type: JsonSchemaType.OBJECT,
        required: ['id', 'timestamp', 'event', 'action'],
        properties: {
          id: { type: JsonSchemaType.STRING },
          timestamp: { type: JsonSchemaType.STRING },
          userId: { type: JsonSchemaType.STRING },
          userEmail: { type: JsonSchemaType.STRING },
          userRole: { type: JsonSchemaType.STRING },
          event: { type: JsonSchemaType.STRING },
          resource: { type: JsonSchemaType.STRING },
          resourceId: { type: JsonSchemaType.STRING },
          action: { type: JsonSchemaType.STRING },
          result: {
            type: JsonSchemaType.STRING,
            enum: ['success', 'failure', 'warning']
          },
          ipAddress: { type: JsonSchemaType.STRING },
          userAgent: { type: JsonSchemaType.STRING },
          details: { type: JsonSchemaType.OBJECT },
          phiAccessed: { type: JsonSchemaType.BOOLEAN },
          patientId: { type: JsonSchemaType.STRING },
          sessionId: { type: JsonSchemaType.STRING }
        }
      }
    });
  }

  /**
   * Set up CloudWatch monitoring and alarms
   */
  private setupMonitoring(): void {
    // Lambda function monitoring
    new Alarm(this, 'AuditLambdaErrors', {
      alarmName: `audit-lambda-errors-${props.environment}`,
      metric: this.auditFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'Audit Lambda function error rate'
    });

    new Alarm(this, 'AuditLambdaDuration', {
      alarmName: `audit-lambda-duration-${props.environment}`,
      metric: this.auditFunction.metricDuration(),
      threshold: 25000, // 25 seconds
      evaluationPeriods: 3,
      alarmDescription: 'Audit Lambda function duration'
    });

    // DynamoDB monitoring
    new Alarm(this, 'AuditTableThrottles', {
      alarmName: `audit-table-throttles-${props.environment}`,
      metric: this.auditTable.metricThrottledRequests(),
      threshold: 1,
      evaluationPeriods: 2,
      alarmDescription: 'Audit table throttling events'
    });

    // API Gateway monitoring
    new Alarm(this, 'AuditApiErrors', {
      alarmName: `audit-api-errors-${props.environment}`,
      metric: this.api.metric4xxError(),
      threshold: 10,
      evaluationPeriods: 2,
      alarmDescription: 'Audit API 4xx error rate'
    });

    console.log('CloudWatch monitoring and alarms configured');
  }
}

/**
 * Deployment function
 */
async function deploy() {
  const app = new cdk.App();
  
  // Get environment from context or default to 'dev'
  const environment = app.node.tryGetContext('environment') || 'dev';
  
  // Environment-specific configuration
  const config = {
    dev: {
      allowedOrigins: ['http://localhost:3000', 'https://dev.serenity.com'],
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1'
    },
    staging: {
      allowedOrigins: ['https://staging.serenity.com'],
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1'
    },
    prod: {
      allowedOrigins: ['https://app.serenity.com'],
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1'
    }
  };

  if (!config[environment]) {
    throw new Error(`Unknown environment: ${environment}`);
  }

  const stackConfig = config[environment];

  // Deploy the stack
  new AuditInfrastructureStack(app, `AuditInfrastructure-${environment}`, {
    environment,
    allowedOrigins: stackConfig.allowedOrigins,
    env: {
      account: stackConfig.account,
      region: stackConfig.region
    },
    stackName: `serenity-audit-logs-${environment}`,
    description: `HIPAA-compliant audit log infrastructure for ${environment}`,
    tags: {
      Environment: environment,
      Project: 'Serenity',
      Compliance: 'HIPAA',
      Owner: 'Platform Team',
      CostCenter: 'Engineering'
    }
  });

  console.log(`✅ Audit infrastructure stack configured for ${environment}`);
  console.log(`🚀 Run 'cdk deploy AuditInfrastructure-${environment}' to deploy`);
}

// Import missing types
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';
import { RequestValidator, Model, JsonSchemaType, MethodLoggingLevel } from 'aws-cdk-lib/aws-apigateway';

// Run deployment if script is executed directly
if (require.main === module) {
  deploy().catch(error => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
}

export { AuditInfrastructureStack };