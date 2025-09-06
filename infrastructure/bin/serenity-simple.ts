#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SerenitySimpleStack } from '../lib/serenity-simple-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'dev';

new SerenitySimpleStack(app, `SerenitySimple-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '662658456049',
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: `Serenity Mental Health Platform (Simple) - ${env} environment`,
  tags: {
    Environment: env,
    Project: 'Serenity',
    ManagedBy: 'CDK',
    Version: 'MVP',
  },
});