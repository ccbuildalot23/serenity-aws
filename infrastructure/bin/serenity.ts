#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SerenityStack } from '../lib/serenity-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'dev';

new SerenityStack(app, `SerenityStack-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: `Serenity Mental Health Platform - ${env} environment`,
  tags: {
    Environment: env,
    Project: 'Serenity',
    ManagedBy: 'CDK',
    CostCenter: 'Engineering',
    Compliance: 'HIPAA',
  },
});