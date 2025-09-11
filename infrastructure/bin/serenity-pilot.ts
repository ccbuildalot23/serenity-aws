#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SerenityPilotStack } from '../lib/serenity-pilot-stack';

const app = new cdk.App();

// Get environment from context or default to pilot
const env = app.node.tryGetContext('env') || 'pilot';

// AWS environment configuration
const awsEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Deploy pilot stack
new SerenityPilotStack(app, `SerenityPilot-${env}`, {
  env: awsEnv,
  description: `Serenity Mental Health Platform - ${env} environment`,
  tags: {
    Project: 'Serenity',
    Environment: env,
    HIPAA: 'compliant',
    Owner: 'serenity-team',
    'backup-required': 'true',
  },
});

// Add stack-level tags for compliance
cdk.Tags.of(app).add('Project', 'Serenity');
cdk.Tags.of(app).add('HIPAA', 'compliant');
cdk.Tags.of(app).add('Environment', env);
cdk.Tags.of(app).add('ManagedBy', 'CDK');