# Serenity AWS — MVP PRD v1.1 Reference

**Owner:** Product Lead (Chris)  
**Date:** 2025-09-08  
**Status:** Active Development

## One-Liner
Serenity AWS is a HIPAA-compliant mental health platform built on Next.js 14, Express, Prisma and AWS. It enables patients to record daily mood/anxiety/sleep scores in two taps, raises crisis alerts, and delivers providers a concise dashboard of engagement and ROI metrics.

## Core Problems & Vision

### Patient Pain Points
- Daily check-ins feel like chores and require too many steps
- Without rapid feedback, adherence plummets
- Need frictionless way to log mood, anxiety and sleep
- Need ability to summon support when feeling at risk

### Provider Pain Points  
- Clinicians avoid tools that add workflow burden
- Need lightweight portal that surfaces patient risk and engagement metrics
- Need to calculate CCM/BHI billing opportunities
- Want tools that demonstrably improve revenue and retention

### Vision
Serenity AWS will be the triad operating system for patients, supporters and providers. The MVP focuses on:
1. **Two-tap check-in loop** that rewards adherence
2. **Crisis alert system** that notifies supporters  
3. **Provider dashboard** that quantifies engagement and financial value
4. **Built on AWS** to meet HIPAA requirements out of the box

## Personas

### Person in Recovery (Patient)
- **Wants:** Quick, shame-free self-awareness and ability to summon support
- **Values:** Privacy, simple interactions, immediate feedback

### Supporter (Family/Peer/Coach)  
- **Wants:** Timely alerts when loved one is struggling, simple way to respond
- **Needs:** Clear prompts and reminders

### Clinician/Provider
- **Wants:** Weekly snapshot of patient engagement, risk windows, billing opportunities
- **Values:** Security, HIPAA compliance, ROI metrics without complex portal

## Success Metrics & Targets

| Goal | Metric (MVP Target) |
|------|---------------------|
| **Activation** | ≥80% of new patients complete first check-in within 24 hours |
| **Adherence** | Median ≥5 check-ins in first 7 days; average ≤3 taps per check-in |
| **Time-to-Insight** | ≥80% see personalized insight card by day 7 |
| **Crisis Response** | ≤15 minutes median time from alert to supporter response |
| **Provider Adoption** | ≥70% access dashboard weekly; ≥50% enable weekly digest |
| **Compliance** | 100% API endpoints validated; all PHI encrypted at rest/transit |

## Core Features & Acceptance Criteria

### A. Two-Tap Check-In (Patient)
**Flow:** Home screen → Check-in → select mood/anxiety/sleep (sliders/buttons) → optional note → Submit

**Acceptance Criteria:**
- ✅ Flow requires ≤3 taps (excluding optional note)
- ✅ Complete in under 10 seconds
- ✅ Input values 1-10, validated server-side with express-validator
- ✅ Invalid values return 400 with errors
- ✅ Success logs to DynamoDB/RDS with timestamp, user ID, scores
- ✅ UI displays streak and summary stats after submission

### B. Crisis Alert & Support Ping
**Flow:** Check-in screen or Support screen → "I need help" → choose supporters → confirm → SMS/push notifications

**Acceptance Criteria:**
- ✅ API /api/crisis requires authentication
- ✅ Server logs alert with severity level, sends via SNS/Twilio
- ✅ Notifications include patient initials (no PHI) + call-to-action
- ✅ Response times stored for metrics
- ✅ One-tap acknowledgment updates alert status, notifies patient
- ✅ All alerts/acknowledgments in audit log with IP/timestamp

### C. Insight Cards (Patient)
**Flow:** After ≥5 check-ins, Home screen shows pattern cards with small charts

**Acceptance Criteria:**
- ✅ Cards generated daily by analytics service
- ✅ API endpoint /api/checkins/stats returns aggregated metrics per user
- ✅ Frontend renders with Chart.js; dismissible/saveable per user
- ✅ First card appears within 7 days for ≥80% of users
- ✅ Cards don't block check-in flow

### D. Provider Dashboard (Simplified)
**Flow:** Provider login → patient list → recent alerts → metrics → patient detail view

**Acceptance Criteria:**
- ✅ Access restricted to provider/admin roles via Cognito groups
- ✅ API endpoints: /api/provider/dashboard, /patients, /patients/:id/checkins
- ✅ Data paginated and filtered by provider ID
- ✅ ROI metrics (CCM/BHI) calculated per provider
- ✅ Dashboard loads <1 second (≤200ms backend response)
- ✅ CSV export functionality

### E. Authentication & Role Management
**Acceptance Criteria:**
- ✅ AWS Cognito handles sign-up/login with email verification
- ✅ Production requires MFA
- ✅ Tokens expire after 15 minutes, include Cognito groups in JWT
- ✅ /api/auth/me returns user profile and role
- ✅ /api/auth/refresh issues new tokens
- ✅ Frontend uses Cognito hosted UI or Amplify components
- ✅ Invalid auth returns 401, insufficient roles return 403

### F. Audit Logging & HIPAA Compliance
**Acceptance Criteria:**
- ✅ Every endpoint logs user ID, action, IP, user agent, timestamp
- ✅ Logs to DynamoDB/S3 with ≥7 years retention
- ✅ PHI encrypted at rest with AWS KMS
- ✅ No PHI echoed to unauthorized users
- ✅ 15-minute session timeout with helmet security headers
- ✅ Rate limiting: auth 5/15min, other 100/15min

## Information Architecture

### Frontend Navigation
- **Home:** Daily check-in card, streak stats, insight cards
- **Support:** Crisis alert button, supporter management, "Play the Tape"
- **Dashboard (Provider):** Patient list, metrics, check-in history, ROI
- **Account:** Settings, notifications, terms

### Backend API Routes
- **Auth:** /api/auth/{register,login,me,refresh}
- **Check-ins:** /api/checkins (CRUD), /api/checkins/stats
- **Crisis:** /api/crisis (POST), /api/crisis/:id/acknowledge
- **Provider:** /api/provider/{dashboard,patients,roi}
- **Audit:** Internal service → DynamoDB/S3 (not exposed)

## Data Model

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Cognito-linked records | id, email, role (patient/provider/supporter/admin) |
| `checkins` | Daily patient entries | id, user_id, mood_score, anxiety_level, sleep_quality, notes, created_at |
| `crisis_alerts` | Active/resolved alerts | id, user_id, severity, status (active/acknowledged/resolved), created_at |
| `provider_patients` | Provider assignments | provider_id, patient_id, assigned_at |
| `audit_logs` | HIPAA audit trail | id, user_id, entity, action, entity_id, ip, user_agent, timestamp |
| `sessions` | Session tokens | id, user_id, expires_at |

## Technical Architecture

### Frontend Stack
- **Next.js 14** App Router (server/client components)
- **Tailwind CSS** + **shadcn/ui** components
- **Zustand** for state management  
- **Chart.js** for insights visualization
- **React Hook Form** + **Zod** for validation

### Backend Stack
- **Express.js** API with TypeScript
- **Prisma ORM** with PostgreSQL (AWS RDS)
- **AWS Cognito** for auth & authorization
- **AWS SDK** for services integration
- **Winston** + **CloudWatch** for logging

### Infrastructure
- **AWS CDK** (SerenitySimpleStack → SerenityStack)
- **API Gateway** + **Lambda** serverless
- **CloudFront** + **S3** for assets
- **KMS** for encryption keys
- **SNS** for notifications

## 13-Week Timeline

### Weeks 1-2: Foundation
- Deploy simple stack, Cognito auth, sign-up/sign-in flows
- Wire DynamoDB via AWS SDK, unit tests, CI/CD

### Weeks 3-6: Core Features  
- Check-in flow and stats retrieval
- Crisis alerts and supporter notifications
- Provider dashboard with patient roster and ROI
- Migrate Supabase → Prisma/RDS

### Weeks 7-10: Insights & Compliance
- Generate/display insight cards
- Audit logging and compliance checks
- Deploy full stack in staging
- Add encryption and KMS keys, run security tests

### Weeks 11-13: Pilot & Hardening
- Onboard pilot users, monitor metrics
- Optimize performance, fix bugs
- Finalize documentation, SOC 2 readiness

## Risk Mitigations

1. **Data Fragmentation:** Standardize on Prisma/RDS for production
2. **Scope Creep:** Limit MVP to roster, metrics, ROI only
3. **AWS Complexity:** Use simplified stack initially, monitor costs
4. **Compliance:** Integrate HIPAA validator in CI, regular audits
5. **Patient Adherence:** Keep <3 taps, micro-interactions, 7-day insights
6. **Provider Adoption:** Clear ROI metrics, simple dashboard, weekly digests

## Non-Goals (Out of Scope)
- Deep EHR/insurance billing integration
- AI diagnosis or treatment recommendations  
- Native mobile apps (beyond PWA)
- Full provider care plans and note-taking
- Insurance billing integration (CPT codes)
- Formal diagnostic tools

## Analytics & Telemetry Events
- `checkin_created`, `insight_viewed`, `crisis_alert_sent`
- `crisis_alert_acknowledged`, `dashboard_viewed`, `engagement_exported`

## Open Questions
1. DynamoDB vs RDS for MVP pilot?
2. Provider access granularity (assigned patients only vs aggregated metrics)?
3. Top 3 insight card types for week 1 value?
4. Supporter web portal vs SMS/push only?

---

**Development Notes:**
- Leverage existing HIPAA compliance utilities (SessionTimeout, AuditLogger, PHIEncryption)
- Maintain 93.37% test coverage foundation
- Follow two-tap interaction principle throughout
- Prioritize simplicity and speed over features