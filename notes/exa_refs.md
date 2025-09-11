# Implementation Patterns Reference

Research findings for key implementation patterns gathered from web research.

## 1. NextResponse.json Jest Testing Patterns for Node 20

### Basic Testing Pattern
The most stable approach for testing Next.js API routes with NextResponse.json in Node 20:

```javascript
/** 
 * @jest-environment node 
 */
import { GET, POST } from './route';
import { NextRequest } from 'next/server';

describe('API Route Tests', () => {
  it('should return data with status 200', async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toBeDefined();
  });

  it('should handle POST requests', async () => {
    const requestBody = { name: 'test' };
    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.name).toBe('test');
  });
});
```

### Advanced Testing with next-test-api-route-handler
For comprehensive testing with better isolation:

```javascript
import { testApiHandler } from "next-test-api-route-handler";
import * as appHandler from "./route";

it("handles error scenarios", async () => {
  await testApiHandler({
    appHandler,
    test: async ({ fetch }) => {
      const response = await fetch({ 
        method: "POST",
        body: JSON.stringify({ invalid: true })
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.message).toBe('Validation failed');
    },
  });
});
```

### Jest Configuration for Node 20
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Best Practices
- Always use `@jest-environment node` for API route tests
- Mock external dependencies (databases, APIs) not the route handlers themselves
- Test both success and error paths
- Validate both status codes and response structure

---

## 2. Supertest Coverage for Express Error Branches

### Comprehensive Error Testing Strategy

```javascript
import request from 'supertest';
import app from '../app';

describe('Error Handling Coverage', () => {
  // Test middleware error handling
  it('should handle validation errors', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ invalidField: 'value' })
      .expect(400);
    
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  // Test database connection errors
  it('should handle database errors', async () => {
    // Mock database to throw error
    jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('DB connection failed'));
    
    const response = await request(app)
      .get('/api/users')
      .expect(500);
    
    expect(response.body.error).toBe('Internal server error');
  });

  // Test authentication errors
  it('should handle unauthorized access', async () => {
    const response = await request(app)
      .get('/api/protected')
      .expect(401);
    
    expect(response.body.error).toBe('Unauthorized');
  });

  // Test rate limiting
  it('should handle rate limiting', async () => {
    // Make multiple requests to trigger rate limit
    const promises = Array(10).fill().map(() => 
      request(app).get('/api/limited-endpoint')
    );
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.some(res => res.status === 429);
    expect(rateLimited).toBe(true);
  });
});
```

### Error Middleware Testing Pattern
```javascript
// Test error middleware directly
describe('Error Middleware', () => {
  it('should format validation errors correctly', () => {
    const mockError = new ValidationError('Field required');
    const mockReq = {};
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const mockNext = jest.fn();

    errorHandler(mockError, mockReq, mockRes, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      message: 'Field required'
    });
  });
});
```

### Coverage Configuration
```javascript
// package.json
{
  "scripts": {
    "test:coverage": "jest --coverage --coverageThreshold='{\"global\":{\"branches\":90,\"functions\":90,\"lines\":90,\"statements\":90}}'"
  },
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/test/**/*.js"
    ],
    "coverageReporters": ["text", "lcov", "html"]
  }
}
```

### Testing Strategies for 100% Branch Coverage
- Mock external dependencies to simulate failures
- Test all conditional branches (if/else, switch cases)
- Test async error scenarios with Promise.reject
- Use try/catch blocks in tests to verify error handling
- Test edge cases and boundary conditions

---

## 3. Terraform ECS Fargate + ALB Baseline

### Core Infrastructure Components

```hcl
# VPC and Networking
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  tags = {
    Name = "${var.project_name}-private-${count.index + 1}"
  }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 10}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "${var.project_name}-public-${count.index + 1}"
  }
}
```

### Application Load Balancer Configuration
```hcl
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-alb"
  }
}

resource "aws_lb_target_group" "app" {
  name        = "${var.project_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.project_name}-tg"
  }
}

resource "aws_lb_listener" "front_end" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
```

### ECS Fargate Service Configuration
```hcl
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-task"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512

  container_definitions = jsonencode([
    {
      name  = "${var.project_name}-app"
      image = "${var.app_image}"
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        }
      ]
    }
  ])

  tags = {
    Name = "${var.project_name}-task"
  }
}

resource "aws_ecs_service" "main" {
  name            = "${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "${var.project_name}-app"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.front_end]

  tags = {
    Name = "${var.project_name}-service"
  }
}
```

### Security Groups
```hcl
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-ecs-tasks-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "inbound from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-tasks-sg"
  }
}
```

### Key Considerations
- **Fargate Networking**: Host port must match container port
- **Target Group**: Use `target_type = "ip"` for Fargate
- **Security**: Deploy containers in private subnets
- **Health Checks**: Configure proper health check endpoints
- **Auto Scaling**: Add auto scaling policies for production

---

## 4. Cognito PKCE SPA + JWKS Verification Patterns

### PKCE Implementation for SPAs

```javascript
// PKCE Helper Functions
import crypto from 'crypto';

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier) {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}

// Authentication Flow
class CognitoAuth {
  constructor(config) {
    this.userPoolId = config.userPoolId;
    this.clientId = config.clientId;
    this.domain = config.domain;
    this.redirectUri = config.redirectUri;
    this.region = config.region;
  }

  async initiateAuth() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later use
    sessionStorage.setItem('code_verifier', codeVerifier);
    
    const authUrl = new URL(`${this.domain}/oauth2/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    window.location.href = authUrl.toString();
  }

  async exchangeCodeForTokens(authCode) {
    const codeVerifier = sessionStorage.getItem('code_verifier');
    sessionStorage.removeItem('code_verifier');
    
    const tokenResponse = await fetch(`${this.domain}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code: authCode,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }
    
    return await tokenResponse.json();
  }
}
```

### JWKS Token Verification

```javascript
import jwt from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';

class TokenValidator {
  constructor(userPoolId, region) {
    this.userPoolId = userPoolId;
    this.region = region;
    this.jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    this.jwksCache = new Map();
    this.cacheExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  }

  async getJWKS() {
    if (this.jwksCache.size > 0 && Date.now() < this.cacheExpiry) {
      return this.jwksCache;
    }

    try {
      const response = await fetch(this.jwksUri);
      const jwks = await response.json();
      
      // Cache the JWKs
      this.jwksCache.clear();
      jwks.keys.forEach(key => {
        this.jwksCache.set(key.kid, key);
      });
      
      this.cacheExpiry = Date.now() + (24 * 60 * 60 * 1000);
      return this.jwksCache;
    } catch (error) {
      throw new Error('Failed to fetch JWKS');
    }
  }

  async verifyToken(token) {
    try {
      // Decode token header to get kid
      const decodedHeader = jwt.decode(token, { complete: true });
      if (!decodedHeader || !decodedHeader.header.kid) {
        throw new Error('Invalid token structure');
      }

      const kid = decodedHeader.header.kid;
      const jwks = await this.getJWKS();
      const jwk = jwks.get(kid);
      
      if (!jwk) {
        throw new Error('JWK not found for kid');
      }

      // Convert JWK to PEM
      const pem = jwkToPem(jwk);
      
      // Verify token
      const decoded = jwt.verify(token, pem, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`,
        audience: this.clientId
      });

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  async validateAccessToken(accessToken) {
    const decoded = await this.verifyToken(accessToken);
    
    // Additional validation for access tokens
    if (decoded.token_use !== 'access') {
      throw new Error('Invalid token use');
    }
    
    if (decoded.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }
    
    return decoded;
  }

  async validateIdToken(idToken) {
    const decoded = await this.verifyToken(idToken);
    
    // Additional validation for ID tokens
    if (decoded.token_use !== 'id') {
      throw new Error('Invalid token use');
    }
    
    return decoded;
  }
}
```

### React Implementation with OIDC Context

```javascript
import { AuthProvider } from 'react-oidc-context';

const cognitoConfig = {
  authority: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/callback`,
  response_type: 'code',
  scope: 'openid email profile',
  
  // PKCE configuration
  code_challenge_method: 'S256',
  
  // Additional security settings
  automaticSilentRenew: true,
  silentRequestTimeoutInSeconds: 30,
  
  // Metadata for JWKS endpoint
  metadata: {
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    authorization_endpoint: `${cognitoDomain}/oauth2/authorize`,
    token_endpoint: `${cognitoDomain}/oauth2/token`,
    userinfo_endpoint: `${cognitoDomain}/oauth2/userInfo`,
    jwks_uri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
  }
};

function App() {
  return (
    <AuthProvider {...cognitoConfig}>
      <Main />
    </AuthProvider>
  );
}

function Main() {
  const auth = useAuth();

  React.useEffect(() => {
    if (auth.isAuthenticated) {
      // Validate tokens
      const tokenValidator = new TokenValidator(userPoolId, region);
      
      tokenValidator.validateAccessToken(auth.user.access_token)
        .then(decoded => {
          console.log('Access token valid:', decoded);
        })
        .catch(error => {
          console.error('Token validation failed:', error);
          auth.signoutRedirect();
        });
    }
  }, [auth.isAuthenticated]);

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Authentication error: {auth.error.message}</div>;
  }

  if (!auth.isAuthenticated) {
    return <button onClick={auth.signinRedirect}>Sign In</button>;
  }

  return (
    <div>
      <h1>Welcome {auth.user?.profile?.email}</h1>
      <button onClick={auth.signoutRedirect}>Sign Out</button>
    </div>
  );
}
```

### Security Best Practices

1. **PKCE Implementation**:
   - Always use PKCE for public clients (SPAs)
   - Generate cryptographically secure code verifiers
   - Store code verifier securely (sessionStorage, not localStorage)

2. **Token Management**:
   - Implement automatic token refresh
   - Validate tokens on both client and server
   - Handle token rotation gracefully

3. **JWKS Handling**:
   - Cache JWKS responses with appropriate TTL
   - Handle key rotation scenarios
   - Validate token issuer and audience claims

4. **Additional Security**:
   - Use HTTPS for all communications
   - Implement proper CORS policies
   - Consider using secure, HttpOnly cookies for refresh tokens via backend proxy

---

## Summary

These patterns provide production-ready implementations for:

1. **Next.js API Testing**: Stable Jest patterns for Node 20 with proper error handling
2. **Express Coverage**: Comprehensive strategies for testing all error branches
3. **ECS Infrastructure**: Complete Terraform baseline for Fargate + ALB deployment
4. **Cognito Authentication**: Secure PKCE + JWKS patterns for SPAs

Each pattern includes security considerations, performance optimizations, and production-ready configurations suitable for enterprise applications.