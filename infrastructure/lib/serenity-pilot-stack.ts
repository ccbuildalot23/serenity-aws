import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import * as config from 'aws-cdk-lib/aws-config';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as events from 'aws-cdk-lib/aws-events';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class SerenityPilotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext('env') || 'pilot';
    const isProd = env === 'prod' || env === 'pilot';

    // ==================== NETWORKING ====================
    const vpc = new ec2.Vpc(this, 'SerenityVPC', {
      maxAzs: 2,
      natGateways: isProd ? 2 : 1,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // VPC Flow Logs for security monitoring
    const flowLogRole = new iam.Role(this, 'FlowLogRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    new ec2.FlowLog(this, 'VPCFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(
        new logs.LogGroup(this, 'VPCFlowLogGroup', {
          retention: logs.RetentionDays.ONE_MONTH,
        }),
        flowLogRole
      ),
    });

    // ==================== KMS ENCRYPTION ====================
    const encryptionKey = new kms.Key(this, 'SerenityEncryptionKey', {
      enableKeyRotation: true,
      description: 'KMS key for Serenity PHI encryption',
      alias: `serenity-${env}-key`,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'EnableRootAccess',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'AllowCloudTrailEncryption',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
            actions: [
              'kms:GenerateDataKey*',
              'kms:DescribeKey',
              'kms:Encrypt',
              'kms:ReEncrypt*',
              'kms:Decrypt',
            ],
            resources: ['*'],
          }),
        ],
      }),
    });

    // ==================== WAF ====================
    const webAcl = new wafv2.CfnWebACL(this, 'SerenityWAF', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsMetric',
          },
        },
        {
          name: 'RateLimitRule',
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitMetric',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'SerenityWAFMetric',
      },
    });

    // ==================== COGNITO PRODUCTION ====================
    const userPool = new cognito.UserPool(this, 'SerenityUserPool', {
      userPoolName: `serenity-${env}-users`,
      selfSignUpEnabled: false, // Controlled signup for pilot
      signInAliases: {
        email: true,
        phone: false,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      mfa: cognito.Mfa.REQUIRED, // Always required for production pilot
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      standardAttributes: {
        email: { required: true, mutable: false },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ 
          minLen: 1, 
          maxLen: 20, 
          mutable: true 
        }),
        tenantId: new cognito.StringAttribute({ 
          minLen: 1, 
          maxLen: 50, 
          mutable: false 
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(1), // Shorter for security
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Always retain for pilot
    });

    // SPA Client (PKCE for web-phase2)
    const spaClient = new cognito.UserPoolClient(this, 'SerenityWebClient', {
      userPool,
      userPoolClientName: `serenity-${env}-web-client`,
      authFlows: {
        userSrp: true,
        custom: false,
        userPassword: false, // Disable for SPA
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL, 
          cognito.OAuthScope.OPENID, 
          cognito.OAuthScope.PROFILE
        ],
        callbackUrls: isProd 
          ? ['https://app.serenityhealth.io/auth/callback']
          : ['http://localhost:3000/auth/callback'],
        logoutUrls: isProd 
          ? ['https://app.serenityhealth.io/auth/logout']
          : ['http://localhost:3000/auth/logout'],
      },
      generateSecret: false, // No secret for SPA/PKCE
      accessTokenValidity: cdk.Duration.minutes(15), // HIPAA requirement
      idTokenValidity: cdk.Duration.minutes(15),
      refreshTokenValidity: cdk.Duration.days(1), // Shorter for pilot security
      preventUserExistenceErrors: true,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    // Server Client (for API operations)
    const serverClient = new cognito.UserPoolClient(this, 'SerenityServerClient', {
      userPool,
      userPoolClientName: `serenity-${env}-server-client`,
      authFlows: {
        userSrp: true,
        custom: true,
        userPassword: true,
      },
      generateSecret: true, // Secret for server-side operations
      accessTokenValidity: cdk.Duration.minutes(15),
      idTokenValidity: cdk.Duration.minutes(15),
      refreshTokenValidity: cdk.Duration.days(7),
      preventUserExistenceErrors: true,
    });

    // User Groups with proper policies
    const patientGroup = new cognito.CfnUserPoolGroup(this, 'PatientGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Patients',
      description: 'Patient users with limited access',
      precedence: 1,
    });

    const providerGroup = new cognito.CfnUserPoolGroup(this, 'ProviderGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Providers',
      description: 'Healthcare providers with PHI access',
      precedence: 2,
    });

    const supporterGroup = new cognito.CfnUserPoolGroup(this, 'SupporterGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Supporters',
      description: 'Support network members with limited PHI access',
      precedence: 3,
    });

    // ==================== DYNAMODB (PHI-light) ====================
    const sessionTable = new dynamodb.Table(this, 'SessionTable', {
      tableName: `serenity-${env}-sessions`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const auditTable = new dynamodb.Table(this, 'AuditTable', {
      tableName: `serenity-${env}-audit`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'retentionTtl', // 7 years for HIPAA
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Always retain audit logs
    });

    // ==================== ECS CLUSTER ====================
    const cluster = new ecs.Cluster(this, 'SerenityCluster', {
      clusterName: `serenity-${env}-cluster`,
      vpc,
      containerInsights: true,
    });

    // Task execution role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Task role for application
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        SerenityTaskPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                sessionTable.tableArn,
                auditTable.tableArn,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'kms:Decrypt',
                'kms:GenerateDataKey',
              ],
              resources: [encryptionKey.keyArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:ListUsers',
              ],
              resources: [userPool.userPoolArn],
            }),
          ],
        }),
      },
    });

    // API Service
    const apiService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
      cluster,
      serviceName: `serenity-${env}-api`,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('serenity/api:latest'), // Will be updated with actual image
        containerPort: 3001,
        environment: {
          NODE_ENV: env,
          AWS_REGION: this.region,
          COGNITO_USER_POOL_ID: userPool.userPoolId,
          COGNITO_CLIENT_ID: spaClient.userPoolClientId,
          DYNAMODB_SESSION_TABLE: sessionTable.tableName,
          DYNAMODB_AUDIT_TABLE: auditTable.tableName,
        },
        executionRole: taskExecutionRole,
        taskRole,
        enableLogging: true,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'api',
          logRetention: logs.RetentionDays.ONE_MONTH,
        }),
      },
      memoryLimitMiB: 512,
      cpu: 256,
      desiredCount: isProd ? 2 : 1,
      listenerPort: 80,
      publicLoadBalancer: true
    });

    // Configure health checks
    apiService.targetGroup.configureHealthCheck({
      path: '/health',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
    });

    // ==================== S3 BUCKETS ====================
    const webAssetsBucket = new s3.Bucket(this, 'WebAssetsBucket', {
      bucketName: `serenity-${env}-web-assets-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'delete-old-versions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    const auditLogsBucket = new s3.Bucket(this, 'AuditLogsBucket', {
      bucketName: `serenity-${env}-audit-logs-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey,
      versioned: true,
      lifecycleRules: [
        {
          id: 'retain-7-years',
          expiration: cdk.Duration.days(2555), // 7 years for HIPAA
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Always retain audit logs
    });

    // CloudFront Origin Access Control
    const originAccessControl = new cloudfront.CfnOriginAccessControl(this, 'OAC', {
      originAccessControlConfig: {
        name: `serenity-${env}-oac`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // ==================== CLOUDFRONT ====================
    const distribution = new cloudfront.Distribution(this, 'SerenityDistribution', {
      webAclId: webAcl.attrArn,
      defaultBehavior: {
        origin: new origins.S3Origin(webAssetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiService.loadBalancer.loadBalancerDnsName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      domainNames: isProd ? [`app.serenityhealth.io`] : undefined,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      logBucket: auditLogsBucket,
      logFilePrefix: 'cloudfront-logs/',
      enableIpv6: true,
    });

    // ==================== CLOUDTRAIL ====================
    const cloudTrail = new cloudtrail.Trail(this, 'SerenityCloudTrail', {
      trailName: `serenity-${env}-trail`,
      bucket: auditLogsBucket,
      s3KeyPrefix: 'cloudtrail-logs/',
      encryptionKey,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      enableFileValidation: true,
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: new logs.LogGroup(this, 'CloudTrailLogGroup', {
        logGroupName: `/aws/cloudtrail/serenity-${env}-${Date.now()}`,
        retention: logs.RetentionDays.ONE_YEAR,
      }),
    });

    // ==================== CONFIG ====================
    const configRecorder = new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      roleArn: new iam.Role(this, 'ConfigRole', {
        assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWS_ConfigRole'),
        ],
      }).roleArn,
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
      },
    });

    const configDeliveryChannel = new config.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      s3BucketName: auditLogsBucket.bucketName,
      s3KeyPrefix: 'config-logs/',
    });

    // ==================== GUARDDUTY ====================
    new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true,
      dataSources: {
        s3Logs: { enable: true },
        kubernetes: { auditLogs: { enable: true } },
        malwareProtection: { scanEc2InstanceWithFindings: { ebsVolumes: true } },
      },
      findingPublishingFrequency: 'FIFTEEN_MINUTES',
    });

    // ==================== BACKUP ====================
    const backupVault = new backup.BackupVault(this, 'SerenityBackupVault', {
      backupVaultName: `serenity-${env}-backup-vault`,
      encryptionKey,
    });

    const backupPlan = new backup.BackupPlan(this, 'SerenityBackupPlan', {
      backupPlanName: `serenity-${env}-backup-plan`,
      backupVault,
      backupPlanRules: [
        new backup.BackupPlanRule({
          ruleName: 'DailyBackups',
          scheduleExpression: events.Schedule.cron({
            hour: '2',
            minute: '0',
          }),
          deleteAfter: cdk.Duration.days(35),
          moveToColdStorageAfter: cdk.Duration.days(30),
        }),
      ],
    });

    // Add DynamoDB tables to backup
    backupPlan.addSelection('DynamoDBBackup', {
      resources: [
        backup.BackupResource.fromDynamoDbTable(sessionTable),
        backup.BackupResource.fromDynamoDbTable(auditTable),
      ],
    });

    // ==================== MONITORING ====================
    const dashboard = new cloudwatch.Dashboard(this, 'SerenityDashboard', {
      dashboardName: `serenity-${env}-dashboard`,
    });

    // API Service metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Response Times',
        left: [apiService.service.metricCpuUtilization()],
        right: [apiService.service.metricMemoryUtilization()],
      }),
    );

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `serenity-${env}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'WebClientId', {
      value: spaClient.userPoolClientId,
      description: 'Cognito Web Client ID (SPA)',
      exportName: `serenity-${env}-web-client-id`,
    });

    new cdk.CfnOutput(this, 'ServerClientId', {
      value: serverClient.userPoolClientId,
      description: 'Cognito Server Client ID',
      exportName: `serenity-${env}-server-client-id`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: `https://${apiService.loadBalancer.loadBalancerDnsName}`,
      description: 'API Load Balancer URL',
      exportName: `serenity-${env}-api-url`,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
      exportName: `serenity-${env}-cloudfront-url`,
    });

    new cdk.CfnOutput(this, 'SessionTableName', {
      value: sessionTable.tableName,
      description: 'DynamoDB Sessions Table',
      exportName: `serenity-${env}-session-table`,
    });

    new cdk.CfnOutput(this, 'AuditTableName', {
      value: auditTable.tableName,
      description: 'DynamoDB Audit Table',
      exportName: `serenity-${env}-audit-table`,
    });

    new cdk.CfnOutput(this, 'EncryptionKeyId', {
      value: encryptionKey.keyId,
      description: 'KMS Encryption Key ID',
      exportName: `serenity-${env}-encryption-key`,
    });
  }
}