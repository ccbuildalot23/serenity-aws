# Jest Polyfills for Next.js 14 App Router Testing Research

## Problem Statement
You're experiencing issues with `response.json()` returning undefined when testing NextResponse in Next.js 14 App Router with Jest. This research focuses on finding proper polyfills and working examples for Jest setup with NextRequest/NextResponse.

## Key Findings

### 1. Root Cause Analysis

**Primary Issue**: The `testEnvironment: 'jest-environment-jsdom'` configuration in your Jest config doesn't properly support Web APIs like `NextRequest` and `NextResponse`.

**Current Setup Issues**:
- Using jsdom environment for API route tests
- Complex polyfills in setup.ts that may not be fully compatible with NextResponse.json()
- Missing proper fetch API polyfills

### 2. Recommended Solutions

#### Solution 1: Use Node Environment for API Route Tests (Recommended)
Add this comment at the top of your API route test files:

```typescript
/**
 * @jest-environment node
 */
```

This overrides the global jsdom setting for API route tests that need Web APIs.

#### Solution 2: Install next-test-api-route-handler (Comprehensive)
```bash
npm install --save-dev next-test-api-route-handler
```

**Key Requirements**:
- Must be first import in test files
- Supports Next.js 14 App Router (starting from next@14.0.4)
- Handles AsyncLocalStorage requirements automatically

**Example Usage**:
```typescript
import { testApiHandler } from "next-test-api-route-handler";
import * as appHandler from "./route";

it("GET returns 200", async () => {
  await testApiHandler({
    appHandler,
    test: async ({ fetch }) => {
      const response = await fetch({ method: "GET" });
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json).toStrictEqual({ hello: true });
    },
  });
});
```

#### Solution 3: Fix TextEncoder/TextDecoder Issues
Add to your Jest setup file:

```typescript
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextDecoder, TextEncoder });
```

### 3. Working Examples Analysis

Your current test file `C:\dev\serenity-aws\apps\web-phase2\src\app\api\billing\charges\__tests__\route.test.ts` follows good patterns but may need environment fixes.

**Issues Identified**:
1. Missing `@jest-environment node` directive
2. Relying on complex polyfills that may not handle NextResponse.json() properly
3. Testing jsdom environment when API routes need Node.js environment

### 4. Best Practices for Next.js 14 App Router Testing

#### Direct Function Testing Pattern
```typescript
/** @jest-environment node */
import { GET, POST } from './route';

it('should return data with status 200', async () => {
  const response = await GET();
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body).toStrictEqual({ expected: 'data' });
});
```

#### Authentication Mocking
Your current approach with mocking `next/headers` is correct:
```typescript
jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));
```

### 5. Specific Issues in Your Current Setup

**Problem with Current Polyfills**:
Your `MockResponse` class in setup.ts may not be 100% compatible with NextResponse.json(). The issue likely stems from:

1. **Body Storage**: Your `_body` property stores string content, but NextResponse.json() creates structured JSON responses
2. **Headers Implementation**: NextResponse.json() sets specific headers that may not be replicated correctly
3. **Environment Mismatch**: API routes need Node.js environment, not jsdom

### 6. Immediate Action Items

1. **Add Environment Directive**: Add `/** @jest-environment node */` to API route test files
2. **Consider next-test-api-route-handler**: For comprehensive testing solution
3. **Simplify Polyfills**: Remove complex Response/Request polyfills for API route tests
4. **Test Environment Separation**: Use different Jest configs for UI tests (jsdom) vs API tests (node)

### 7. Alternative Jest Configuration

Consider a dual-environment approach:

```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testEnvironment: 'jest-environment-jsdom', // Default for UI tests
  projects: [
    {
      displayName: 'client',
      testEnvironment: 'jest-environment-jsdom',
      testMatch: [
        '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/**/*.test.{js,jsx,ts,tsx}',
      ],
    },
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/app/api/**/*.test.{js,ts}',
      ],
    },
  ],
  // ... rest of config
};

module.exports = createJestConfig(customJestConfig);
```

## Resources and References

1. **next-test-api-route-handler**: https://www.npmjs.com/package/next-test-api-route-handler
2. **Next.js Testing Guide**: https://nextjs.org/docs/app/guides/testing/jest
3. **Community Examples**: Multiple DEV.to articles from 2024 showing working Next.js 14 testing setups
4. **GitHub Discussions**: Active community discussions on Next.js testing challenges

## Conclusion

The primary issue with your `response.json()` returning undefined is likely due to environment mismatch. Next.js 14 App Router API routes should be tested in Node.js environment, not jsdom. The `next-test-api-route-handler` package provides the most comprehensive solution, but simply adding `/** @jest-environment node */` to your test files may resolve the immediate issue.