# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Serenity AWS is a HIPAA-compliant mental health platform built with enterprise-scale architecture. It's a monorepo using Turbo for workspace management with distinct applications for API and web interfaces.

## Architecture

### Tech Stack
- **Monorepo**: Turbo-powered workspaces with shared packages
- **Backend**: Node.js/Express API with AWS Lambda deployment, Prisma ORM
- **Frontend**: Next.js 14 with Turbopack, TypeScript, Tailwind CSS
- **Database**: Amazon RDS PostgreSQL
- **Authentication**: AWS Cognito with MFA support
- **Infrastructure**: AWS CDK for IaC, including VPC, KMS encryption, CloudFront
- **Compliance**: HIPAA-compliant with audit logging, encryption, session management

### Project Structure
```
serenity-aws/
├── apps/
│   ├── api/          # Express backend with Lambda handlers
│   ├── web-phase2/   # Next.js frontend (active development)
│   └── web/          # Legacy frontend
├── packages/         # Shared code packages
├── infrastructure/   # AWS CDK stacks
└── docs/            # Documentation
```

## Development Commands

### Root Level (Monorepo)
```bash
npm install              # Install all dependencies
npm run dev              # Start all apps in dev mode
npm run build            # Build all apps
npm run test             # Run all tests
npm run lint             # Lint all workspaces
npm run typecheck        # Type check all workspaces
```

### API Development (apps/api)
```bash
npm run dev --workspace=@serenity/api     # Start API server with nodemon
npm run test --workspace=@serenity/api    # Run API tests with coverage
npm run build --workspace=@serenity/api   # Build TypeScript
```

### Frontend Development (apps/web-phase2)
```bash
cd apps/web-phase2
npm run dev              # Start Next.js with Turbopack
npm run build            # Build for production
npm run test             # Run Jest tests
npm run test:coverage    # Run tests with coverage report
```

### Infrastructure Deployment
```bash
cd infrastructure
npm run deploy:dev       # Deploy to dev environment
npm run deploy:prod      # Deploy to production
npm run destroy          # Tear down infrastructure
```

### Database Operations
```bash
npm run db:migrate       # Run database migrations
npm run db:generate      # Generate Prisma client
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio
```

## Key Technical Considerations

### HIPAA Compliance
- All PHI data must be encrypted at rest and in transit using AWS KMS
- Session timeout after 15 minutes of inactivity is enforced
- Comprehensive audit logging for all PHI access/modifications
- MFA required for production environments

### Authentication Flow
- AWS Cognito handles user authentication with JWT tokens
- Access tokens expire after 15 minutes (HIPAA requirement)
- Role-based access control: patient, provider, supporter, admin
- Password requirements: 12+ chars, uppercase, lowercase, digits, symbols

### API Security
- Express middleware stack: helmet, cors, compression, rate limiting
- JWT validation through AWS Cognito
- Zod schema validation for request/response
- Structured error handling with appropriate status codes

### Frontend Architecture
- Next.js 14 App Router with server/client components
- Zustand for state management
- Axios for API communication with interceptors
- Tailwind CSS for styling with component-first approach
- Chart.js for data visualization (provider dashboards)

### Testing Strategy
- Unit tests with Jest and React Testing Library
- API tests with Supertest
- Minimum 90% coverage target
- Test files colocated in `__tests__` directories

### AWS Infrastructure
- Multi-AZ deployment for high availability
- VPC with public, private, and isolated subnets
- Lambda functions for serverless API
- CloudFront CDN for static assets
- RDS PostgreSQL with encryption enabled

## Environment Variables

### API (.env)
```
DATABASE_URL=postgresql://...
COGNITO_USER_POOL_ID=us-east-1_...
COGNITO_CLIENT_ID=...
COGNITO_CLIENT_SECRET=...
REGION=us-east-1
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=...
NEXT_PUBLIC_COGNITO_CLIENT_ID=...
NEXT_PUBLIC_AWS_REGION=us-east-1
```

## Common Development Tasks

### Running Tests
```bash
# Run specific test file
npm test -- apps/api/src/__tests__/auth.test.ts

# Run tests in watch mode
npm run test:watch --workspace=@serenity/api

# Run with coverage
npm run test:coverage
```

### Debugging Lambda Functions
```bash
# Test Lambda handler locally
cd apps/api
node test-handler.js

# View Lambda logs
aws logs tail /aws/lambda/serenity-api-dev --follow
```

### Working with Migrations
```bash
# Create new migration
npx prisma migrate dev --name add_feature

# Reset database
npx prisma migrate reset
```

## Critical Files and Patterns

### API Route Pattern
Routes follow RESTful conventions with middleware chains:
- Authentication middleware validates JWT
- Validation middleware uses Zod schemas
- Error handling middleware catches and formats errors

### Component Structure
React components use functional components with TypeScript:
- Props interfaces defined above component
- Custom hooks for business logic
- Separation of concerns between UI and logic

### State Management
Zustand stores follow a consistent pattern:
- Typed state interfaces
- Actions grouped logically
- Persistence for user preferences

## Deployment Checklist

Before deploying:
1. Run `npm run lint` - must pass without errors
2. Run `npm run typecheck` - must pass without errors
3. Run `npm run test` - all tests must pass
4. Verify environment variables are set correctly
5. Check AWS credentials and permissions
6. Review HIPAA compliance requirements in HIPAA_COMPLIANCE_GUIDE.md