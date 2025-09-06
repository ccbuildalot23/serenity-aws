# Serenity AWS - Mental Health Platform

## Clean Architecture, Enterprise Scale

A HIPAA-compliant mental health platform built on AWS from the ground up.

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: Amazon RDS PostgreSQL
- **Auth**: AWS Cognito with MFA
- **Infrastructure**: AWS CDK, Lambda, API Gateway
- **Compliance**: HIPAA, SOC2-ready

### Project Structure
```
serenity-aws/
├── apps/
│   ├── web/               # Next.js frontend
│   └── api/               # Express backend
├── packages/
│   ├── database/          # Prisma schema & migrations
│   ├── shared/            # Shared types & utils
│   └── ui/                # Shared UI components
├── infrastructure/        # AWS CDK
└── docs/                  # Documentation
```

### Quick Start
```bash
npm install
npm run dev
```

### Features
- ✅ Daily mental health check-ins
- ✅ Crisis support system
- ✅ Provider dashboard with ROI metrics
- ✅ Multi-tenant architecture
- ✅ HIPAA compliant audit logging
- ✅ Real-time notifications

### Development Principles
1. **Ship Daily**: Deploy working features every day
2. **Test First**: TDD with >90% coverage
3. **Simple First**: No abstractions until 3rd use
4. **Delete More**: Remove code ruthlessly
5. **User First**: Every feature must solve real user pain