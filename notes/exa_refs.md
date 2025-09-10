# Testing Reference Guide: NextResponse.json and Supertest Error Handling

## NextResponse.json Testing with Jest and Node 20

### Common Issues and Solutions

#### 1. Request/Response Not Defined Error
- **Problem**: "ReferenceError: Request is not defined" when testing Next.js API routes
- **Cause**: Web APIs aren't available in Node.js test environment
- **Solution**: Use proper Jest environment configuration and polyfills

#### 2. Jest Environment Configuration
```javascript
/** @jest-environment node */
import { GET } from './route';

it('should return data with status 200', async () => {
  const response = await GET();
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.length).toBe(2);
});
```

#### 3. Polyfill Solutions
- **whatwg-fetch**: For fetch API availability in jsdom environment
- **node-fetch**: Alternative for Request/Response methods
- **Issue**: jest-environment-jsdom doesn't implement fetch API properly

#### 4. Response.json Function Error
- **Problem**: "TypeError: Response.json is not a function" in development
- **Context**: Occurs with certain Node.js versions when using NextResponse.json()

### Node 20 Compatibility Notes
- Improved test runner capabilities
- Faster execution times (2-3s → 500ms when switching from Jest to Node test runner)
- Some API compatibility considerations with older Node versions

### Best Practices for NextResponse Testing
1. Test route handlers directly without excessive mocking
2. Focus on mocking internal calls within functions if needed
3. Ensure Jest environment is properly configured for Node.js
4. Use actual NextRequest/NextResponse instances for realistic testing

## Supertest Error Handling Patterns

### Error Branch Testing Techniques

#### 1. Callback Pattern with Error Handling
```javascript
describe('POST /users', function() {
  it('responds with json', function(done) {
    request(app)
      .post('/users')
      .send({name: 'john'})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err);
        return done();
      });
  });
});
```

#### 2. Testing Invalid Scenarios
```javascript
// Test both valid and invalid URLs
describe('API endpoints', () => {
  it('should return 400 for invalid data', async () => {
    await request(app)
      .post('/users')
      .send({ invalidField: 'value' })
      .expect(400);
  });
});
```

### Comprehensive Error Testing Strategy

#### 1. Four Key Techniques for High Coverage
- **100% Branch Coverage**: Use `--branches 100` flag
- **Proper Error Assertions**: Assert exceptions match API contracts
- **Valid/Invalid Path Testing**: Test both success and failure scenarios
- **Error Handler Middleware**: Test custom exception handlers

#### 2. Integration Testing Patterns
```javascript
// Test error scenarios alongside success cases
describe('User API', () => {
  it('creates user successfully', async () => {
    // Success case test
  });

  it('returns 400 for invalid user data', async () => {
    // Error case test
  });
});
```

#### 3. Mock Database Testing
- Use tools like MongoMemoryServer for MongoDB
- Avoid interference with actual database
- Create isolated test environments

### Error Handling Best Practices

#### 1. Test Environment Setup
- Configure Jest properly for Node.js applications
- Use appropriate test environment (node vs jsdom)
- Include necessary polyfills for Web APIs

#### 2. Comprehensive Coverage Goals
- Test all error branches and edge cases
- Include failure scenarios for complete API coverage
- Use Jest matchers like `toBe` and `toContain` for assertions

#### 3. Express.js Error Handler Testing
- Implement custom exception handlers
- Test HTTP response handling
- Verify proper status codes and error messages

### Key Testing Patterns Summary

1. **Direct Testing Approach**: Test route handlers without excessive mocking
2. **Environment Configuration**: Proper Jest setup for Node.js/Next.js compatibility
3. **Polyfill Strategy**: Use appropriate polyfills for Web APIs in test environments
4. **Error Branch Coverage**: Ensure all code paths are tested, especially error scenarios
5. **Integration Testing**: Test complete request/response cycles with Supertest
6. **Mock Strategy**: Use database mocks to avoid test interference

### Node 20 Stability Considerations
- Improved test runner performance
- Better compatibility with modern JavaScript features
- Some migration considerations from Jest to Node test runner
- Enhanced debugging capabilities for Lambda functions

### Common Pitfalls to Avoid
1. Not testing error branches (aim for 100% branch coverage)
2. Improper Jest environment configuration
3. Missing polyfills for Web APIs
4. Not testing both success and failure scenarios
5. Interfering with actual databases in tests
6. Inadequate assertion patterns for error cases