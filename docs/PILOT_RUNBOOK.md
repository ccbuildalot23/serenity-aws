# Serenity AWS Pilot Deployment Runbook

**Version**: 1.0  
**Last Updated**: September 9, 2025  
**Environment**: Pilot Production  
**Compliance Level**: HIPAA Technical Safeguards Complete

## Overview

This runbook provides step-by-step procedures for deploying, monitoring, and maintaining the Serenity AWS pilot environment. It includes emergency procedures, rollback processes, and compliance verification steps.

## Prerequisites

### Required Access
- [ ] AWS CLI configured with appropriate permissions
- [ ] GitHub Actions access with deployment secrets
- [ ] Slack webhook access for notifications
- [ ] Emergency contact information for Dr. Colston

### Required Tools
- [ ] AWS CLI v2.x
- [ ] Node.js 20.x
- [ ] CDK CLI v2.x
- [ ] Git access to serenity-aws repository

## Pre-Deployment Checklist

### 1. Environment Verification
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check deployment environment
echo $DEPLOYMENT_ENV

# Verify secrets are configured
aws secretsmanager list-secrets --region us-east-1
```

### 2. Security Pre-Checks
- [ ] All secrets properly stored in AWS Secrets Manager
- [ ] No hardcoded credentials in code
- [ ] Security audit passed (see CI pipeline)
- [ ] HIPAA compliance verified

### 3. Infrastructure Readiness
```bash
# Validate CDK synthesis
cd infrastructure
npm run synth:pilot

# Check for breaking changes
npm run diff:pilot
```

### 4. Application Readiness
- [ ] API tests passing (87/87 tests, 75.42% coverage)
- [ ] Web-phase2 auth tests passing (18/18 tests)
- [ ] Build artifacts generated successfully

## Deployment Procedures

### 1. Infrastructure Deployment

```bash
# Navigate to infrastructure directory
cd infrastructure

# Deploy infrastructure stack
npm run deploy:pilot

# Capture stack outputs
aws cloudformation describe-stacks \
  --stack-name SerenityPilot-pilot \
  --query 'Stacks[0].Outputs' \
  --output table
```

**Expected Outputs:**
- UserPoolId: Cognito User Pool ID
- WebClientId: SPA Client ID  
- ServerClientId: Server Client ID
- ApiUrl: ECS API Load Balancer URL
- CloudFrontUrl: Web Application URL
- EncryptionKeyId: KMS Key for PHI encryption

### 2. Application Deployment

```bash
# Trigger deployment pipeline
gh workflow run pilot-deployment.yml \
  --field environment=pilot

# Monitor deployment progress
gh run list --workflow=pilot-deployment.yml
```

### 3. Post-Deployment Verification

```bash
# Health checks
curl -f https://api.serenityhealth.io/health
curl -f https://app.serenityhealth.io

# Authentication verification
curl -X POST https://api.serenityhealth.io/api/auth/verify-session
# Should return 401 (expected without token)

# HIPAA compliance check
curl -I https://api.serenityhealth.io/health | grep -i security
```

## Monitoring & Alerting

### 1. CloudWatch Dashboards
- **API Metrics**: Response times, error rates, throughput
- **ECS Metrics**: CPU, memory, task count
- **Database Metrics**: Connections, query performance
- **Security Metrics**: Failed auth attempts, suspicious activity

### 2. Alert Thresholds
- API response time > 2 seconds
- Error rate > 1%
- CPU utilization > 80%
- Failed authentication attempts > 10/minute
- PHI session violations

### 3. Monitoring URLs
- CloudWatch: https://console.aws.amazon.com/cloudwatch/
- ECS Console: https://console.aws.amazon.com/ecs/
- Cognito Console: https://console.aws.amazon.com/cognito/

## Emergency Procedures

### 1. Service Outage Response

**Immediate Actions (0-5 minutes):**
1. Check service health status
2. Review CloudWatch alarms
3. Notify Dr. Colston via emergency contact
4. Document incident start time

**Investigation Phase (5-15 minutes):**
```bash
# Check API service status
aws ecs describe-services \
  --cluster serenity-pilot-cluster \
  --services serenity-pilot-api

# Check recent CloudTrail events
aws logs filter-log-events \
  --log-group-name /aws/cloudtrail/serenity-pilot \
  --start-time $(date -d '1 hour ago' +%s)000
```

**Resolution Phase (15+ minutes):**
- Execute appropriate runbook procedure
- Monitor service recovery
- Document resolution steps

### 2. Security Incident Response

**Immediate Actions:**
1. **DO NOT** disable services (maintain audit trail)
2. Capture current system state
3. Review audit logs for unauthorized access
4. Contact HIPAA compliance team immediately

```bash
# Review recent authentication attempts
aws logs filter-log-events \
  --log-group-name /aws/ecs/serenity-pilot-api \
  --filter-pattern "authentication failed" \
  --start-time $(date -d '24 hours ago' +%s)000

# Check for PHI access violations
aws logs filter-log-events \
  --log-group-name /aws/ecs/serenity-pilot-api \
  --filter-pattern "PHI access" \
  --start-time $(date -d '24 hours ago' +%s)000
```

### 3. Data Breach Response

**CRITICAL:** Any suspected PHI breach requires immediate notification:
1. **Dr. Colston**: [emergency-contact]
2. **HIPAA Officer**: [compliance-contact]
3. **Legal Team**: [legal-contact]

**Do NOT:**
- Delete logs or audit trails
- Restart services without approval
- Communicate externally without legal review

## Rollback Procedures

### 1. Application Rollback

```bash
# Rollback to previous ECS service version
aws ecs update-service \
  --cluster serenity-pilot-cluster \
  --service serenity-pilot-api \
  --task-definition serenity-pilot-api:PREVIOUS_REVISION

# Rollback web application
aws s3 sync s3://serenity-pilot-backup-bucket/previous-version/ \
  s3://serenity-pilot-web-assets/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890123 \
  --paths "/*"
```

### 2. Infrastructure Rollback

```bash
# Revert to previous CDK version
git checkout PREVIOUS_COMMIT

# Deploy previous infrastructure
cd infrastructure
npm run deploy:pilot
```

### 3. Database Rollback

```bash
# Restore from backup (if needed)
aws rds restore-db-instance-from-db-snapshot \
  --source-db-snapshot-identifier serenity-pilot-backup-YYYYMMDD \
  --target-db-instance-identifier serenity-pilot-db-restored \
  --db-instance-class db.t3.medium
```

## Backup & Recovery

### 1. Automated Backups
- **DynamoDB**: Point-in-time recovery enabled
- **ECS**: Application images stored in ECR
- **S3**: Versioning enabled with lifecycle rules
- **CloudFormation**: Stack templates in Git

### 2. Manual Backup Procedures

```bash
# Create manual DynamoDB backup
aws dynamodb create-backup \
  --table-name serenity-pilot-sessions \
  --backup-name manual-backup-$(date +%Y%m%d-%H%M%S)

# Export user data
aws cognito-idp list-users \
  --user-pool-id us-east-1_XXXXXXXXX \
  --output json > users-backup-$(date +%Y%m%d).json
```

### 3. Recovery Verification

```bash
# Test restored services
curl -f https://api.serenityhealth.io/health

# Verify data integrity
aws dynamodb scan \
  --table-name serenity-pilot-sessions \
  --select COUNT
```

## Compliance Procedures

### 1. Daily HIPAA Checks
- [ ] Verify encryption at rest (DynamoDB, S3, logs)
- [ ] Confirm 15-minute PHI session timeout
- [ ] Review audit logs for unauthorized access
- [ ] Check security headers on all endpoints

### 2. Weekly Compliance Review
- [ ] Review user access patterns
- [ ] Audit new user registrations
- [ ] Check backup completeness
- [ ] Verify certificate expiration dates

### 3. Monthly Compliance Report
- [ ] Generate access report from CloudTrail
- [ ] Review security incident log
- [ ] Update risk assessment
- [ ] Validate business associate agreements

## Troubleshooting Guide

### Common Issues

#### 1. API Service Won't Start
**Symptoms**: ECS tasks failing to start
**Investigation**:
```bash
aws ecs describe-services --cluster serenity-pilot-cluster --services serenity-pilot-api
aws logs tail /aws/ecs/serenity-pilot-api --follow
```
**Common Causes**: Missing environment variables, insufficient IAM permissions, image pull failures

#### 2. Authentication Failures
**Symptoms**: Users can't log in
**Investigation**:
```bash
aws cognito-idp admin-get-user --user-pool-id POOL_ID --username USER_EMAIL
aws logs filter-log-events --log-group-name /aws/ecs/serenity-pilot-api --filter-pattern "authentication"
```
**Common Causes**: Cognito configuration, JWT token issues, network connectivity

#### 3. Database Connection Issues
**Symptoms**: API returns database errors
**Investigation**:
```bash
aws rds describe-db-instances --db-instance-identifier serenity-pilot-db
aws ec2 describe-security-groups --filters "Name=group-name,Values=serenity-pilot-db-sg"
```
**Common Causes**: Security group rules, VPC configuration, database availability

## Contact Information

### Emergency Contacts
- **Primary**: Dr. Colston - [phone] / [email]
- **Technical Lead**: [name] - [phone] / [email]
- **HIPAA Officer**: [name] - [phone] / [email]

### Support Channels
- **Slack**: #serenity-ops
- **Email**: ops@serenityhealth.io
- **On-call**: [pagerduty-link]

### Vendor Contacts
- **AWS Support**: [support-case-link]
- **GitHub Support**: [support-link]

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|---------|
| 2025-09-09 | 1.0 | Initial pilot runbook | Claude Code |

---

**Document Classification**: Internal Use - HIPAA Sensitive  
**Review Frequency**: Monthly  
**Next Review Date**: 2025-10-09