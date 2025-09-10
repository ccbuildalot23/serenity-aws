# Serenity AWS Infrastructure Guide

**Version**: 1.0  
**Environment**: Pilot Production  
**Architecture**: HIPAA-Compliant Multi-Tier  
**Last Updated**: September 9, 2025

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet Users                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                    AWS CloudFront CDN                          │
│                  (TLS 1.2+, WAF Protection)                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                        Public Subnet                           │
│  ┌─────────────────┐                    ┌─────────────────┐    │
│  │ Application     │                    │    S3 Bucket    │    │
│  │ Load Balancer   │                    │  (Web Assets)   │    │
│  │   (ALB/HTTPS)   │                    │  KMS Encrypted  │    │
│  └─────────────────┘                    └─────────────────┘    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                       Private Subnet                           │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   ECS Fargate   │    │   AWS Cognito   │                    │
│  │  (API Service)  │    │  (User Pool +   │                    │
│  │  KMS Encrypted  │    │   App Clients)  │                    │
│  └─────────────────┘    └─────────────────┘                    │
│           │                                                     │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   DynamoDB      │    │      KMS        │                    │
│  │ (Session/Audit) │    │ (Encryption     │                    │
│  │  Encrypted      │    │     Keys)       │                    │
│  └─────────────────┘    └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Security & Monitoring                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   CloudTrail    │ │   GuardDuty     │ │   AWS Config    │   │
│  │ (Audit Logs)    │ │ (Threat Detect) │ │ (Compliance)    │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   CloudWatch    │ │   AWS Backup    │ │       WAF       │   │
│  │  (Monitoring)   │ │ (Data Backup)   │ │ (Web Security)  │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Network Infrastructure (VPC)

**VPC Configuration:**
- CIDR: 10.0.0.0/16
- Multi-AZ deployment across 2 availability zones
- DNS hostnames and resolution enabled

**Subnets:**
- **Public Subnets** (10.0.1.0/24, 10.0.2.0/24): ALB, NAT Gateways
- **Private Subnets** (10.0.11.0/24, 10.0.12.0/24): ECS Fargate services
- **Database Subnets** (10.0.21.0/24, 10.0.22.0/24): DynamoDB VPC endpoints

**Security Groups:**
- ALB-SG: Ports 80, 443 from 0.0.0.0/0
- ECS-SG: Port 3001 from ALB-SG only
- VPC Endpoints-SG: Port 443 from Private Subnets

### 2. Compute Infrastructure (ECS Fargate)

**ECS Cluster:**
- Name: `serenity-pilot-cluster`
- Container Insights enabled
- Fargate launch type (serverless)

**API Service:**
- Image: `serenity/api:latest`
- CPU: 256 units (0.25 vCPU)
- Memory: 512 MB
- Desired count: 2 (pilot), 3+ (production)
- Health check: `/health` endpoint

**Task Role Permissions:**
- DynamoDB: GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan
- KMS: Decrypt, GenerateDataKey
- Cognito: AdminGetUser, AdminUpdateUserAttributes, ListUsers

### 3. Database Infrastructure

**DynamoDB Tables:**

*Session Table:*
- Name: `serenity-pilot-sessions`
- Partition Key: `sessionId` (String)
- Billing: Pay-per-request
- Encryption: Customer-managed KMS
- TTL: `ttl` attribute (automatic cleanup)
- Point-in-time recovery: Enabled

*Audit Table:*
- Name: `serenity-pilot-audit`
- Partition Key: `userId` (String)
- Sort Key: `timestamp` (Number)
- Billing: Pay-per-request
- Encryption: Customer-managed KMS
- TTL: `retentionTtl` (7-year HIPAA retention)
- Point-in-time recovery: Enabled

### 4. Identity & Access Management

**Cognito User Pool:**
- Name: `serenity-pilot-users`
- MFA: Required (SMS + TOTP)
- Password Policy: 12+ chars, complex requirements
- Advanced Security: Enforced (risk detection)
- Self-signup: Disabled (controlled pilot)

**App Clients:**

*SPA Client (Web):*
- Type: Public client (no secret)
- Auth Flow: Authorization Code + PKCE
- Token Validity: 15 minutes (HIPAA requirement)
- Scopes: email, openid, profile

*Server Client (API):*
- Type: Confidential client (with secret)
- Auth Flow: Client credentials, SRP
- Token Validity: 15 minutes

**User Groups:**
- Patients: Basic PHI access to own data
- Providers: Full PHI access, assessment tools
- Supporters: Limited PHI access, crisis alerts
- Admins: Full system access

### 5. Storage Infrastructure

**S3 Buckets:**

*Web Assets Bucket:*
- Name: `serenity-pilot-web-assets-{account}`
- Encryption: KMS with customer-managed key
- Versioning: Enabled
- Public access: Blocked (CloudFront only)
- Lifecycle: Delete old versions after 30 days

*Audit Logs Bucket:*
- Name: `serenity-pilot-audit-logs-{account}`
- Encryption: KMS with customer-managed key
- Versioning: Enabled
- Public access: Blocked
- Retention: 7 years (HIPAA requirement)
- MFA delete: Required

### 6. Content Delivery (CloudFront)

**Distribution Configuration:**
- Origin: S3 bucket + ALB (API)
- SSL: TLS 1.2 minimum
- WAF: Associated for security
- Caching: Optimized for static assets, disabled for API
- Logging: Enabled to audit bucket

**Security Features:**
- HSTS headers enforced
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Origin Access Control for S3

### 7. Security Infrastructure

**Web Application Firewall (WAF):**
- AWS Managed Rules: Common Rule Set
- Rate limiting: 2000 requests per 5 minutes per IP
- Known bad inputs protection
- SQL injection and XSS protection

**KMS Encryption:**
- Customer-managed key with rotation
- Used for: DynamoDB, S3, CloudTrail, CloudWatch Logs
- Key policy: Least privilege access

**AWS GuardDuty:**
- Threat detection enabled
- S3 protection enabled
- Kubernetes audit logs (if applicable)
- Malware protection for EC2/ECS

### 8. Monitoring & Compliance

**CloudTrail:**
- Multi-region trail enabled
- Log file validation enabled
- KMS encryption enabled
- S3 bucket with MFA delete

**AWS Config:**
- Configuration recorder enabled
- Compliance rules for HIPAA
- Automatic remediation where possible

**CloudWatch:**
- Log groups with encryption
- Metrics and alarms for all services
- Dashboard for operational visibility

**AWS Backup:**
- Daily backups with 35-day retention
- Cross-region backup for production
- Backup vault with access policies

## Security Controls

### 1. Encryption

**Data at Rest:**
- DynamoDB: Customer-managed KMS encryption
- S3: KMS encryption for all buckets
- CloudWatch Logs: KMS encryption
- ECS: Encrypted EBS volumes

**Data in Transit:**
- TLS 1.2+ for all external connections
- VPC endpoints for AWS service communication
- Internal ALB to ECS communication over HTTPS

### 2. Access Controls

**Network Security:**
- Private subnets for all application components
- Security groups with least privilege
- NACLs for additional network layer security
- VPC Flow Logs enabled

**Identity Security:**
- IAM roles with minimal required permissions
- No hardcoded credentials
- Secrets Manager for sensitive configuration
- MFA required for privileged operations

### 3. Monitoring & Auditing

**Audit Logging:**
- CloudTrail for all AWS API calls
- Application audit logs in DynamoDB
- VPC Flow Logs for network traffic
- GuardDuty for threat detection

**Compliance Monitoring:**
- AWS Config rules for HIPAA compliance
- Custom CloudWatch metrics for PHI access
- Automated compliance reporting

## Deployment Configuration

### 1. Environment Variables

**Production Environment:**
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=[account-id]

# Application Configuration
NODE_ENV=production
API_PORT=3001
PHI_SESSION_TIMEOUT_MINUTES=15

# Cognito Configuration
COGNITO_USER_POOL_ID=[from-stack-output]
COGNITO_CLIENT_ID=[from-stack-output]
COGNITO_CLIENT_SECRET=[from-secrets-manager]

# Database Configuration
DYNAMODB_SESSION_TABLE=serenity-pilot-sessions
DYNAMODB_AUDIT_TABLE=serenity-pilot-audit

# Security Configuration
KMS_KEY_ID=[from-stack-output]
ENABLE_AUDIT_LOGGING=true
ENABLE_ENCRYPTION=true
```

### 2. CDK Deployment Commands

```bash
# Install dependencies
cd infrastructure
npm ci

# Synthesize templates
npm run synth:pilot

# Deploy infrastructure
npm run deploy:pilot

# Destroy (emergency only)
npm run destroy:pilot
```

### 3. Post-Deployment Configuration

```bash
# Create initial admin user
aws cognito-idp admin-create-user \
  --user-pool-id [POOL_ID] \
  --username admin@serenityhealth.io \
  --user-attributes Name=email,Value=admin@serenityhealth.io \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id [POOL_ID] \
  --username admin@serenityhealth.io \
  --password [SECURE_PASSWORD] \
  --permanent

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id [POOL_ID] \
  --username admin@serenityhealth.io \
  --group-name Admins
```

## Cost Optimization

### 1. Current Pilot Costs (Estimated)

**Monthly Costs:**
- ECS Fargate: $30-50/month (2 tasks)
- DynamoDB: $5-15/month (on-demand)
- CloudFront: $5-10/month (pilot traffic)
- S3: $5-10/month (assets + logs)
- Other AWS services: $20-30/month
- **Total Estimated**: $65-115/month

### 2. Production Scaling Costs

**Scaling Factors:**
- ECS tasks scale with user load
- DynamoDB scales automatically with usage
- CloudFront costs scale with traffic
- Storage costs grow with data retention

### 3. Cost Controls

- Reserved capacity for predictable workloads
- Lifecycle policies for log retention
- Automated scaling policies
- Regular cost review and optimization

## Disaster Recovery

### 1. RTO/RPO Targets

- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 1 hour
- **Mean Time to Recovery (MTTR)**: 2 hours

### 2. Backup Strategy

**Automated Backups:**
- DynamoDB: Point-in-time recovery (35 days)
- S3: Cross-region replication for critical data
- Code: Git repository with multiple copies
- Infrastructure: CDK templates in version control

**Manual Backup Procedures:**
- Weekly configuration exports
- Monthly disaster recovery testing
- Quarterly full environment rebuild

### 3. Recovery Procedures

**Service Recovery:**
1. Deploy infrastructure from CDK templates
2. Restore DynamoDB tables from backups
3. Deploy application code from Git
4. Verify health checks and monitoring
5. Update DNS if necessary

## Compliance Documentation

### 1. HIPAA Technical Safeguards

**Access Control (§164.312(a)(1)):**
- ✅ Unique user identification (Cognito)
- ✅ Automatic logoff (15-minute timeout)
- ✅ Encryption and decryption (KMS)

**Audit Controls (§164.312(b)):**
- ✅ Audit logs (CloudTrail + DynamoDB)
- ✅ Review procedures (daily monitoring)
- ✅ Reporting mechanisms (CloudWatch)

**Integrity (§164.312(c)(1)):**
- ✅ PHI alteration protection (encryption)
- ✅ Audit trail for changes

**Person or Entity Authentication (§164.312(d)):**
- ✅ User authentication (Cognito + MFA)
- ✅ Strong password requirements

**Transmission Security (§164.312(e)(1)):**
- ✅ End-to-end encryption (TLS 1.2+)
- ✅ Network security controls (VPC)

### 2. AWS Shared Responsibility

**AWS Responsibilities:**
- Physical security of data centers
- Infrastructure security and patching
- Network controls and monitoring
- Service availability and durability

**Customer Responsibilities:**
- Application-level security
- User access management
- Data encryption configuration
- Audit logging and monitoring
- Incident response procedures

### 3. Business Associate Agreement

- AWS BAA executed and current
- Third-party service agreements reviewed
- Subprocessor agreements in place
- Regular compliance auditing scheduled

---

**Document Classification**: Internal Use - Technical  
**Review Frequency**: Quarterly  
**Next Review Date**: 2025-12-09