# EXA Research References: Implementation Patterns

This document contains comprehensive findings from web searches on key implementation patterns for modern web applications.

## 1. NextResponse.json Jest Node 20 Stable Testing

### Overview
Testing Next.js App Router API routes that use `NextResponse.json` requires specific Jest configuration and environment setup for Node 20 stable environments.

### Best Practices

#### Jest Environment Configuration
```javascript
/** 
 * @jest-environment node 
 */
import { GET } from './route';
```

**Key Point**: Use `@jest-environment node` comment in test files rather than jsdom for API route testing.

#### Basic Test Structure
```javascript
/** 
 * @jest-environment node 
 */
import { GET } from './route';

it('should return data with status 200', async () => {
  const response = await GET();
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.length).toBe(2);
});
```

#### Testing with Request Parameters
```javascript
it('should return data with status 200', async () => {
  const requestObj = {
    nextUrl: {
      searchParams: new URLSearchParams({ Id: '1' }),
    },
  } as any;
  
  const response = await GET(requestObj);
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.id).toBe(1);
});
```

#### Alternative: next-test-api-route-handler
```javascript
import { testApiHandler } from "next-test-api-route-handler";
import * as appHandler from "./route";

it("GET returns 200", async () => {
  await testApiHandler({
    appHandler,
    test: async ({ fetch }) => {
      const response = await fetch({ method: "GET" });
      const json = await response.json();
      expect(response.status).toBe(200);
    },
  });
});
```

### Common Pitfalls and Solutions

- **ReferenceError: Request is not defined**: Occurs when test environment isn't properly configured for Node.js
- **Solution**: Ensure proper Jest environment configuration with `@jest-environment node`
- **Mocking Strategy**: You don't need to mock the API function itself - focus on mocking internal dependencies

### Performance Considerations

- Tests run in Node.js environment (not browser runtime)
- Compatible with Node 20 stable
- Isolated testing environment prevents interference between tests

### Security Implications

- API routes tested in isolation from browser environment
- Request/response handling validated at the function level
- Proper error handling can be tested without exposing sensitive information

## 2. Supertest Coverage of Express Error Branches

### Overview
Supertest provides comprehensive testing capabilities for Express applications with focus on achieving high test coverage for error handling scenarios.

### Best Practices

#### Comprehensive Error Branch Testing
```javascript
// Achieving 100% branch coverage
--branches 100  // Enforces complete branch coverage
```

**Key Strategy**: Test every decision point and conditional logic path, especially error scenarios.

#### Testing Structure for Error Handling
```javascript
describe('Error Handling', () => {
  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/api/users')
      .send(invalidData)
      .expect(400);
    
    expect(response.body.error).toBeDefined();
  });
  
  it('should handle authorization errors', async () => {
    const response = await request(app)
      .get('/api/protected')
      .expect(401);
  });
});
```

#### Supertest HTTP Server Testing
```javascript
// Supertest automatically handles server lifecycle
const request = require('supertest');
const app = require('../app');

// No need to manage ports - Supertest handles ephemeral ports
```

### Testing Strategies

#### Branch Coverage Implementation
- **Statement Coverage**: Every line of code executed
- **Branch Coverage**: Every decision point tested (if/else, switch cases)
- **Path Coverage**: Every possible execution path tested

#### Error Scenario Validation
1. **Function Exit Validation**: Ensure errors throw appropriately
2. **API Contract Validation**: Verify error response format matches specification
3. **HTTP Status Code Validation**: Confirm appropriate status codes for different error types

### Common Pitfalls and Solutions

- **Incomplete Branch Coverage**: Use coverage tools like `nyc` with `--reporter=text` and `--reporter=lcov`
- **Mocking Issues**: Refactor to separate modules for better testability
- **Complex Error Paths**: Break down complex error handling into smaller, testable units

### Performance Considerations

- Automated testing improves long-term maintainability
- Integration tests validate module interactions
- Proper test structure reduces debugging time

### Security Implications

- Comprehensive error testing prevents information leakage
- Validates proper error handling doesn't expose sensitive data
- Ensures consistent error responses across the application

## 3. Terraform ECS Fargate + ALB Baseline

### Overview
Infrastructure as Code pattern for deploying containerized applications using AWS ECS Fargate with Application Load Balancer for scalable, serverless container orchestration.

### Best Practices

#### Core Infrastructure Components

##### 1. Networking Foundation
```hcl
# VPC with proper subnet configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
}

# Private subnets for ECS tasks
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
}

# Public subnets for ALB
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 101}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
}
```

##### 2. Security Groups
```hcl
# ALB Security Group
resource "aws_security_group" "alb" {
  name_prefix = "alb-sg"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ECS Security Group
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "ecs-tasks-sg"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
}
```

##### 3. ECS Fargate Configuration
```hcl
resource "aws_ecs_cluster" "main" {
  name = "app-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "app-task"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = 256
  memory                  = 512
  execution_role_arn      = aws_iam_role.ecs_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "nginx:latest"
    portMappings = [{
      containerPort = 80
      protocol      = "tcp"
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ecs.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}
```

##### 4. Application Load Balancer
```hcl
resource "aws_lb" "main" {
  name               = "app-alb"
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "app" {
  name        = "app-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"  # Important for Fargate

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}
```

### Modular Architecture Pattern
```
├── backend.tf          # S3 + DynamoDB for remote state
├── main.tf            # Root config orchestrating modules
├── outputs.tf         # Outputs (ALB DNS, VPC ID, etc.)
├── variables.tf       # Global variables
├── modules/
│   ├── networking/    # VPC, subnets, security groups
│   ├── ecs/          # ECS cluster, services, tasks
│   ├── alb/          # Load balancer configuration
│   └── monitoring/   # CloudWatch, alarms
```

### Common Pitfalls and Solutions

- **Target Group Type**: Must use `target_type = "ip"` for Fargate (not "instance")
- **Service Discovery**: Implement proper service mesh for microservices communication
- **Resource Sizing**: Start with smaller CPU/memory allocations and scale up based on metrics

### Performance Considerations

- **Auto-scaling**: Implement ECS service auto-scaling based on CPU/memory metrics
- **Multi-AZ Deployment**: Distribute tasks across availability zones for high availability
- **Container Insights**: Enable for detailed monitoring and performance optimization

### Security Implications

- **Network Isolation**: ECS tasks in private subnets, ALB in public subnets
- **IAM Roles**: Separate execution and task roles with least privilege principle
- **Security Groups**: Restrictive rules allowing only necessary traffic

## 4. Cognito PKCE SPA + JWKS Verification Patterns

### Overview
Secure authentication implementation for Single Page Applications using AWS Cognito with Proof Key for Code Exchange (PKCE) and JSON Web Key Set (JWKS) verification.

### Best Practices

#### PKCE Implementation for SPAs

##### Authorization Code Flow with PKCE
```javascript
// Generate code verifier and challenge
function generateCodeVerifier() {
  const array = new Uint32Array(56/2);
  crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  return crypto.subtle.digest('SHA-256', data)
    .then(digest => {
      return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    });
}

// Authorization request
const authUrl = `https://<your-domain>.auth.<region>.amazoncognito.com/oauth2/authorize?` +
  `response_type=code&` +
  `client_id=${clientId}&` +
  `redirect_uri=${redirectUri}&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256&` +
  `scope=openid profile email`;
```

##### Token Exchange
```javascript
// Exchange authorization code for tokens
async function exchangeCodeForTokens(authorizationCode, codeVerifier) {
  const response = await fetch('https://<your-domain>.auth.<region>.amazoncognito.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: authorizationCode,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier  // Plain text verifier
    })
  });
  
  return response.json();
}
```

#### JWKS Verification Implementation

##### JWKS Endpoint and Caching
```javascript
// Construct JWKS URI
const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;

// Cache implementation
class JWKSCache {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  async getKey(kid) {
    const cached = this.cache.get(kid);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.key;
    }

    // Fetch fresh JWKS
    const response = await fetch(jwksUri);
    const jwks = await response.json();
    
    // Cache all keys
    jwks.keys.forEach(key => {
      this.cache.set(key.kid, {
        key: key,
        timestamp: Date.now()
      });
    });

    return this.cache.get(kid)?.key;
  }
}
```

##### Token Verification with aws-jwt-verify
```javascript
import { CognitoJwtVerifier } from "aws-jwt-verify";

// Create the verifier outside your Lambda handler
const verifier = CognitoJwtVerifier.create({
  userPoolId: "us-east-1_VfvwDdHph",
  tokenUse: "access", // or "id"
  clientId: "7471gd82vtv9rrbhq8aiq6ofn",
});

// Verify token
async function verifyToken(token) {
  try {
    const payload = await verifier.verify(token);
    console.log("Token is valid. Payload:", payload);
    return payload;
  } catch (error) {
    console.log("Token not valid:", error);
    throw error;
  }
}
```

##### Manual JWKS Verification
```javascript
import jwt from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';

async function verifyJWT(token) {
  // Decode header to get kid
  const decodedHeader = jwt.decode(token, { complete: true }).header;
  const kid = decodedHeader.kid;

  // Get JWK for kid
  const jwk = await jwksCache.getKey(kid);
  if (!jwk) {
    throw new Error('Public key not found');
  }

  // Convert JWK to PEM
  const pem = jwkToPem(jwk);

  // Verify token
  return jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    audience: clientId
  });
}
```

### Common Pitfalls and Solutions

#### Security Considerations
- **Token Tampering**: JWTs can be decoded and modified - always verify signatures
- **Key Rotation**: Implement proper JWKS caching with refresh capabilities
- **PKCE Verification**: Ensures authorization code hasn't been intercepted

#### Implementation Issues
- **Cache Management**: Balance between security and performance with appropriate TTL
- **Error Handling**: Implement proper fallback for key rotation scenarios
- **Token Lifetime**: Use short-lived tokens with refresh mechanisms

### Performance Considerations

- **JWKS Caching**: Cache public keys using `kid` as cache key
- **Token Validation**: Use AWS JWT Verify library for optimized validation
- **Lambda@Edge**: Implement token validation at edge for reduced latency

### Security Implications

#### PKCE Benefits
- **Code Interception Protection**: PKCE prevents authorization code interception attacks
- **Dynamic Secret Generation**: Each authentication flow uses unique code verifier
- **No Client Secret Required**: Suitable for public clients (SPAs)

#### JWKS Security
- **Signature Verification**: Ensures token integrity and authenticity
- **Issuer Validation**: Prevents token replay attacks from other sources
- **Audience Validation**: Ensures tokens are intended for your application

#### API Gateway Integration
```javascript
// Built-in Cognito User Pool Authorizer
const authorizer = {
  type: 'COGNITO_USER_POOLS',
  providerARNs: [`arn:aws:cognito-idp:${region}:${accountId}:userpool/${userPoolId}`],
  identitySource: 'method.request.header.Authorization'
};
```

## Practical Takeaways for Implementation

### 1. Next.js API Testing
- Always use `@jest-environment node` for API route tests
- Consider `next-test-api-route-handler` for comprehensive testing
- Focus on testing business logic rather than mocking framework internals

### 2. Express Error Coverage
- Implement systematic branch coverage testing
- Use Supertest for comprehensive HTTP testing
- Organize tests to cover all error scenarios systematically

### 3. ECS Fargate Infrastructure
- Use modular Terraform structure for maintainability
- Implement proper security groups and network isolation
- Enable auto-scaling and monitoring from the start

### 4. Cognito Authentication
- Always use PKCE for SPAs (not implicit flow)
- Implement proper JWKS caching strategy
- Use AWS JWT Verify library for production applications
- Integrate with API Gateway for seamless authorization

These patterns provide robust, secure, and scalable foundations for modern web application development with comprehensive testing and infrastructure management strategies.