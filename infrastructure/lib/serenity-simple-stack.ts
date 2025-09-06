import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

export class SerenitySimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext('env') || 'dev';

    // ==================== COGNITO ====================
    const userPool = new cognito.UserPool(this, 'SerenityUserPool', {
      userPoolName: `serenity-${env}-users`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'SerenityUserPoolClient', {
      userPool,
      generateSecret: true,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
      preventUserExistenceErrors: true,
    });

    // User Groups
    new cognito.CfnUserPoolGroup(this, 'PatientGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Patients',
      description: 'Patients group',
    });

    new cognito.CfnUserPoolGroup(this, 'ProviderGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Providers',
      description: 'Healthcare providers group',
    });

    // ==================== S3 BUCKETS ====================
    const assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: `serenity-${env}-assets-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // ==================== DYNAMODB TABLES ====================
    // Simple key-value tables for MVP
    const profilesTable = new dynamodb.Table(this, 'ProfilesTable', {
      tableName: 'serenity-profiles',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const checkinsTable = new dynamodb.Table(this, 'CheckinsTable', {
      tableName: 'serenity-checkins',
      partitionKey: { name: 'checkInId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying by userId
    checkinsTable.addGlobalSecondaryIndex({
      indexName: 'userId-timestamp-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // ==================== LAMBDA ====================
    const apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: `serenity-${env}-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'cognito-handler.handler',
      code: lambda.Code.fromAsset('../apps/api'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: env,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_CLIENT_SECRET: userPoolClient.userPoolClientSecret.unsafeUnwrap(),
        S3_ASSETS_BUCKET: assetsBucket.bucketName,
        REGION: this.region,
      },
    });

    // Grant Lambda permissions
    assetsBucket.grantReadWrite(apiLambda);
    userPool.grant(apiLambda, 'cognito-idp:*');
    profilesTable.grantReadWriteData(apiLambda);
    checkinsTable.grantReadWriteData(apiLambda);

    // ==================== API GATEWAY ====================
    const api = new apigateway.RestApi(this, 'SerenityAPI', {
      restApiName: `serenity-${env}-api`,
      description: 'Serenity Mental Health API',
      deployOptions: {
        stageName: env,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(apiLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // Add proxy resource
    const proxyResource = api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', lambdaIntegration);
    api.root.addMethod('ANY', lambdaIntegration);

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientSecret', {
      value: userPoolClient.userPoolClientSecret.unsafeUnwrap() || 'N/A',
      description: 'Cognito User Pool Client Secret',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value: assetsBucket.bucketName,
      description: 'S3 Assets Bucket',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: apiLambda.functionArn,
      description: 'Lambda Function ARN',
    });
  }
}