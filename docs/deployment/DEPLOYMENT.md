# Serenity AWS Deployment Guide

## Quick Start

### 1. Prerequisites
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm
```

### 2. Configure AWS Credentials
```bash
# Configure AWS CLI
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### 3. Setup Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
# Required values:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - COGNITO_USER_POOL_ID (created by CDK)
# - COGNITO_CLIENT_ID (created by CDK)
# - DATABASE_URL (RDS endpoint from CDK)
```

## Development Deployment

### Local Development
```bash
# Install dependencies
pnpm install

# Run database migrations
cd packages/database
npx prisma migrate dev

# Start API server
cd apps/api
pnpm dev

# Start web app (in another terminal)
cd apps/web
pnpm dev
```

### Docker Development
```bash
# Build containers
docker-compose build

# Start services
docker-compose up

# API: http://localhost:3001
# Web: http://localhost:3000
```

## AWS Infrastructure Deployment

### 1. Deploy Infrastructure with CDK
```bash
# Bootstrap CDK (first time only)
cd infrastructure
npm install
npx cdk bootstrap

# Deploy development environment
npx cdk deploy SerenityStack-dev

# Deploy production environment
npx cdk deploy SerenityStack-prod --require-approval never
```

### 2. Get Infrastructure Outputs
```bash
# Get Cognito User Pool ID
aws cognito-idp list-user-pools --max-results 10 | grep serenity

# Get RDS endpoint
aws rds describe-db-instances --db-instance-identifier serenity-db-dev

# Get API Gateway URL
aws apigateway get-rest-apis | grep serenity
```

### 3. Update Environment Variables
```bash
# Update .env with CDK outputs
COGNITO_USER_POOL_ID=us-east-1_xxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxx
DATABASE_URL=postgresql://admin:password@serenity.xxxxx.rds.amazonaws.com:5432/serenity
```

## Production Deployment

### 1. Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Security scan completed
- [ ] HIPAA compliance verified
- [ ] Database backup created
- [ ] Environment variables set
- [ ] SSL certificates configured
- [ ] WAF rules configured
- [ ] CloudWatch alarms set

### 2. Deploy API to Lambda
```bash
# Build API for production
cd apps/api
pnpm build

# Package for Lambda
zip -r api.zip dist node_modules

# Deploy to Lambda
aws lambda update-function-code \
  --function-name serenity-api-prod \
  --zip-file fileb://api.zip

# Update function configuration
aws lambda update-function-configuration \
  --function-name serenity-api-prod \
  --environment Variables="{$(cat .env.production | tr '\n' ',')}"
```

### 3. Deploy Web App to S3/CloudFront
```bash
# Build web app
cd apps/web
pnpm build

# Sync to S3
aws s3 sync dist/ s3://serenity-web-prod/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --exclude "*.json"

aws s3 cp dist/index.html s3://serenity-web-prod/ \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXX \
  --paths "/*"
```

### 4. Database Migration
```bash
# Generate migration
cd packages/database
npx prisma migrate dev --name init

# Apply to production
DATABASE_URL=$PROD_DATABASE_URL npx prisma migrate deploy

# Seed initial data (if needed)
npx prisma db seed
```

## Monitoring & Maintenance

### CloudWatch Dashboards
```bash
# View API metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=serenity-api-prod \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

### Log Analysis
```bash
# View API logs
aws logs tail /aws/lambda/serenity-api-prod --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/serenity-api-prod \
  --filter-pattern "ERROR"
```

### Database Backup
```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier serenity-db-prod \
  --db-snapshot-identifier serenity-backup-$(date +%Y%m%d)

# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier serenity-db-prod
```

## Rollback Procedures

### API Rollback
```bash
# Get previous version
aws lambda list-versions-by-function \
  --function-name serenity-api-prod

# Update alias to previous version
aws lambda update-alias \
  --function-name serenity-api-prod \
  --name production \
  --function-version 5
```

### Database Rollback
```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier serenity-db-restore \
  --db-snapshot-identifier serenity-backup-20240110
```

## Security Procedures

### Rotate Secrets
```bash
# Rotate database password
aws rds modify-db-instance \
  --db-instance-identifier serenity-db-prod \
  --master-user-password NEW_PASSWORD \
  --apply-immediately

# Rotate Cognito client secret
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_xxxxx \
  --client-id xxxxx \
  --generate-secret
```

### Security Audit
```bash
# Run security scan
npm audit
pnpm audit --audit-level moderate

# Check AWS security
aws accessanalyzer list-analyzers
aws securityhub get-findings
```

## Cost Optimization

### Review Usage
```bash
# Get cost report
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Optimize Resources
```bash
# Switch to reserved instances
aws ec2 purchase-reserved-instances-offering \
  --instance-count 1 \
  --reserved-instances-offering-id xxxxxxxx

# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace lambda \
  --resource-id function:serenity-api-prod \
  --scalable-dimension lambda:function:ProvisionedConcurrency \
  --min-capacity 1 \
  --max-capacity 10
```

## Troubleshooting

### Common Issues

#### 1. Lambda Cold Starts
```bash
# Enable provisioned concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name serenity-api-prod \
  --provisioned-concurrent-executions 2
```

#### 2. Database Connection Issues
```bash
# Check security group
aws ec2 describe-security-groups \
  --group-ids sg-xxxxx

# Update inbound rules
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-yyyyy
```

#### 3. CORS Issues
```bash
# Update API Gateway CORS
aws apigateway update-method \
  --rest-api-id xxxxx \
  --resource-id yyyyy \
  --http-method OPTIONS \
  --patch-operations \
    op=replace,path=/responseParameters/method.response.header.Access-Control-Allow-Origin,value="'*'"
```

## Support

- **AWS Support**: https://console.aws.amazon.com/support
- **Documentation**: /docs/README.md
- **Monitoring**: CloudWatch Dashboard
- **Alerts**: PagerDuty / Slack integration

## Deployment Schedule

- **Development**: Continuous deployment on merge to `develop`
- **Staging**: Daily at 2 AM UTC
- **Production**: Weekly on Wednesdays at 3 AM UTC (maintenance window)