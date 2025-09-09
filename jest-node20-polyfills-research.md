# Jest Polyfills for Node.js 20+ Web APIs - Research & Implementation Guide

## Executive Summary

This document provides comprehensive research on Jest polyfills for Node.js 20+ specifically targeting web APIs needed for modern React/Next.js applications. Based on analysis of the Serenity AWS codebase, current polyfill implementations, and CI environment requirements.

**Current Environment:**
- Node.js v22.18.0
- Jest v30.1.3
- Next.js 14.0.4
- TypeScript 5.3.3
- Testing Library React 16.3.0

## 1. TextEncoder/TextDecoder Polyfills

### Current Implementation Analysis
Your existing setup uses Node.js built-in `util` module:

```javascript
// Current approach in jest.setup.js
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
```

### Recommended Enhanced Implementation

```javascript
// Enhanced TextEncoder/TextDecoder polyfill for Node.js 20+
const { TextEncoder, TextDecoder } = require('util');

// Polyfill with proper prototype chain and methods
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

// Ensure instances have correct methods and properties
const originalTextEncoder = global.TextEncoder;
const originalTextDecoder = global.TextDecoder;

global.TextEncoder = class extends originalTextEncoder {
  constructor(encoding) {
    super(encoding);
    this.encoding = encoding || 'utf-8';
  }
  
  encode(input = '') {
    return super.encode(String(input));
  }
  
  encodeInto(source, destination) {
    if (super.encodeInto) {
      return super.encodeInto(source, destination);
    }
    // Fallback for older Node versions
    const encoded = this.encode(source);
    const length = Math.min(encoded.length, destination.length);
    for (let i = 0; i < length; i++) {
      destination[i] = encoded[i];
    }
    return { read: source.length, written: length };
  }
};

global.TextDecoder = class extends originalTextDecoder {
  constructor(encoding, options) {
    super(encoding, options);
    this.encoding = encoding || 'utf-8';
    this.fatal = options?.fatal || false;
    this.ignoreBOM = options?.ignoreBOM || false;
  }
  
  decode(input, options) {
    if (input === undefined) return '';
    return super.decode(input, options);
  }
};
```

## 2. Headers/Request/Response Polyfills with Full Iteration Support

### Current Implementation Issues
Your current Headers implementation lacks some iterator methods and Web API compatibility.

### Recommended Enhanced Implementation

```javascript
// Enhanced Headers polyfill with complete iteration support
class PolyfillHeaders {
  constructor(init) {
    this._headers = new Map();
    
    if (init) {
      if (init instanceof PolyfillHeaders) {
        init._headers.forEach((value, key) => this._headers.set(key, value));
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this._headers.set(key.toLowerCase(), String(value)));
      } else if (typeof init === 'object' && init !== null) {
        Object.entries(init).forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), String(value));
        });
      }
    }
  }

  append(name, value) {
    const normalizedName = name.toLowerCase();
    const existing = this._headers.get(normalizedName);
    this._headers.set(normalizedName, existing ? `${existing}, ${value}` : String(value));
  }

  delete(name) {
    this._headers.delete(name.toLowerCase());
  }

  get(name) {
    return this._headers.get(name.toLowerCase()) || null;
  }

  has(name) {
    return this._headers.has(name.toLowerCase());
  }

  set(name, value) {
    this._headers.set(name.toLowerCase(), String(value));
  }

  // Iterator methods with proper Web API compliance
  *entries() {
    for (const [key, value] of this._headers) {
      yield [key, value];
    }
  }

  *keys() {
    for (const key of this._headers.keys()) {
      yield key;
    }
  }

  *values() {
    for (const value of this._headers.values()) {
      yield value;
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }

  // Additional Web API methods
  forEach(callback, thisArg) {
    for (const [key, value] of this._headers) {
      callback.call(thisArg, value, key, this);
    }
  }

  // For compatibility with testing libraries
  getSetCookie() {
    const setCookieValues = [];
    for (const [key, value] of this._headers) {
      if (key === 'set-cookie') {
        setCookieValues.push(value);
      }
    }
    return setCookieValues;
  }
}

// Enhanced Request polyfill
class PolyfillRequest {
  constructor(input, init = {}) {
    // Handle URL input
    if (typeof input === 'string') {
      this.url = input;
    } else if (input && typeof input.url === 'string') {
      this.url = input.url;
    } else if (input instanceof URL) {
      this.url = input.href;
    } else {
      this.url = String(input);
    }

    // Set properties with proper defaults
    this.method = (init.method || 'GET').toUpperCase();
    this.headers = new PolyfillHeaders(init.headers || {});
    this.body = init.body || null;
    this.credentials = init.credentials || 'same-origin';
    this.cache = init.cache || 'default';
    this.redirect = init.redirect || 'follow';
    this.referrer = init.referrer || '';
    this.referrerPolicy = init.referrerPolicy || '';
    this.mode = init.mode || 'cors';
    this.integrity = init.integrity || '';
    this.keepalive = init.keepalive || false;
    this.signal = init.signal || null;

    // Readonly properties
    Object.defineProperties(this, {
      bodyUsed: { value: false, writable: false },
      destination: { value: '', writable: false }
    });
  }

  // Body methods
  async arrayBuffer() {
    if (this.body === null) return new ArrayBuffer(0);
    if (typeof this.body === 'string') {
      const encoder = new TextEncoder();
      return encoder.encode(this.body).buffer;
    }
    if (this.body instanceof ArrayBuffer) return this.body;
    return new ArrayBuffer(0);
  }

  async blob() {
    throw new Error('Blob not implemented in test environment');
  }

  async formData() {
    throw new Error('FormData not implemented in test environment');
  }

  async json() {
    const text = await this.text();
    return text ? JSON.parse(text) : null;
  }

  async text() {
    if (this.body === null) return '';
    if (typeof this.body === 'string') return this.body;
    if (this.body instanceof ArrayBuffer) {
      const decoder = new TextDecoder();
      return decoder.decode(this.body);
    }
    return String(this.body);
  }

  clone() {
    return new PolyfillRequest(this.url, {
      method: this.method,
      headers: this.headers,
      body: this.body,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      mode: this.mode,
      integrity: this.integrity,
      keepalive: this.keepalive,
      signal: this.signal
    });
  }
}

// Enhanced Response polyfill
class PolyfillResponse {
  constructor(body = null, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new PolyfillHeaders(init.headers || {});
    this.ok = this.status >= 200 && this.status < 300;
    this.redirected = init.redirected || false;
    this.type = init.type || 'default';
    this.url = init.url || '';

    // Readonly properties
    Object.defineProperties(this, {
      bodyUsed: { value: false, writable: false }
    });
  }

  // Body methods
  async arrayBuffer() {
    if (this.body === null) return new ArrayBuffer(0);
    if (typeof this.body === 'string') {
      const encoder = new TextEncoder();
      return encoder.encode(this.body).buffer;
    }
    if (this.body instanceof ArrayBuffer) return this.body;
    return new ArrayBuffer(0);
  }

  async blob() {
    throw new Error('Blob not implemented in test environment');
  }

  async formData() {
    throw new Error('FormData not implemented in test environment');
  }

  async json() {
    const text = await this.text();
    return text ? JSON.parse(text) : {};
  }

  async text() {
    if (this.body === null) return '';
    if (typeof this.body === 'string') return this.body;
    if (typeof this.body === 'object') return JSON.stringify(this.body);
    return String(this.body);
  }

  clone() {
    return new PolyfillResponse(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      redirected: this.redirected,
      type: this.type,
      url: this.url
    });
  }

  // Static methods
  static error() {
    return new PolyfillResponse(null, { status: 0, statusText: '' });
  }

  static redirect(url, status = 302) {
    return new PolyfillResponse(null, {
      status,
      statusText: 'Redirect',
      headers: { Location: url }
    });
  }

  static json(data, init = {}) {
    const body = JSON.stringify(data);
    const headers = new PolyfillHeaders(init.headers || {});
    headers.set('content-type', 'application/json');
    
    return new PolyfillResponse(body, {
      ...init,
      headers
    });
  }
}

// Set globals
global.Headers = PolyfillHeaders;
global.Request = PolyfillRequest;
global.Response = PolyfillResponse;
```

## 3. Web Crypto API Polyfills for Testing

### Enhanced Crypto Polyfill with Better Mocking

```javascript
// Enhanced Web Crypto API polyfill for Jest testing
const crypto = require('crypto');

class MockSubtleCrypto {
  async encrypt(algorithm, key, data) {
    // Mock implementation that mimics real behavior patterns
    const mockCiphertext = new ArrayBuffer(32);
    const view = new Uint8Array(mockCiphertext);
    crypto.getRandomValues(view);
    return mockCiphertext;
  }

  async decrypt(algorithm, key, data) {
    // Mock decryption - return smaller buffer to simulate decrypted data
    const mockPlaintext = new ArrayBuffer(16);
    const view = new Uint8Array(mockPlaintext);
    // Fill with predictable pattern for testing
    for (let i = 0; i < view.length; i++) {
      view[i] = (i % 256);
    }
    return mockPlaintext;
  }

  async digest(algorithm, data) {
    // Mock digest with predictable but unique output
    const mockHash = new ArrayBuffer(32);
    const view = new Uint8Array(mockHash);
    
    // Create deterministic hash based on input
    const input = typeof data === 'string' ? data : String(data);
    const inputHash = require('crypto').createHash('sha256').update(input).digest();
    
    for (let i = 0; i < Math.min(view.length, inputHash.length); i++) {
      view[i] = inputHash[i];
    }
    
    return mockHash;
  }

  async generateKey(algorithm, extractable, keyUsages) {
    // Mock key generation
    return {
      type: 'secret',
      extractable: extractable || false,
      algorithm: algorithm,
      usages: keyUsages || []
    };
  }

  async deriveKey(algorithm, baseKey, derivedKeyAlgorithm, extractable, keyUsages) {
    return {
      type: 'secret',
      extractable: extractable || false,
      algorithm: derivedKeyAlgorithm,
      usages: keyUsages || []
    };
  }

  async deriveBits(algorithm, baseKey, length) {
    const mockBits = new ArrayBuffer(length / 8);
    const view = new Uint8Array(mockBits);
    crypto.getRandomValues(view);
    return mockBits;
  }

  async importKey(format, keyData, algorithm, extractable, keyUsages) {
    return {
      type: 'secret',
      extractable: extractable || false,
      algorithm: algorithm,
      usages: keyUsages || []
    };
  }

  async exportKey(format, key) {
    if (format === 'raw') {
      const mockExported = new ArrayBuffer(32);
      const view = new Uint8Array(mockExported);
      crypto.getRandomValues(view);
      return mockExported;
    }
    return {};
  }

  async sign(algorithm, key, data) {
    const mockSignature = new ArrayBuffer(64);
    const view = new Uint8Array(mockSignature);
    crypto.getRandomValues(view);
    return mockSignature;
  }

  async verify(algorithm, key, signature, data) {
    // Mock verification - return true for testing success cases
    return true;
  }

  async wrapKey(format, key, wrappingKey, wrapAlgorithm) {
    const mockWrapped = new ArrayBuffer(48);
    const view = new Uint8Array(mockWrapped);
    crypto.getRandomValues(view);
    return mockWrapped;
  }

  async unwrapKey(format, wrappedKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages) {
    return {
      type: 'secret',
      extractable: extractable || false,
      algorithm: unwrappedKeyAlgorithm,
      usages: keyUsages || []
    };
  }
}

const mockCrypto = {
  getRandomValues: (array) => {
    // Use Node.js crypto for actual randomness
    if (array.constructor === Uint8Array) {
      const buffer = crypto.randomBytes(array.length);
      for (let i = 0; i < array.length; i++) {
        array[i] = buffer[i];
      }
    } else if (array.constructor === Uint32Array) {
      const buffer = crypto.randomBytes(array.length * 4);
      for (let i = 0; i < array.length; i++) {
        array[i] = buffer.readUInt32BE(i * 4);
      }
    }
    return array;
  },

  // Add randomUUID for modern applications
  randomUUID: () => {
    return crypto.randomUUID();
  },

  subtle: new MockSubtleCrypto()
};

// Set global crypto
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
  configurable: true
});

// Export for testing
global.mockCrypto = mockCrypto;
```

## 4. Best Practices for Polyfill Loading Order

### Recommended Jest Setup File Structure

```javascript
// jest.setup.js - Proper loading order for CI environments

// 1. FIRST: Load polyfills before any other imports
//    This prevents timing issues with module loading

// Load Node.js built-ins first
const { TextEncoder, TextDecoder } = require('util');
const crypto = require('crypto');

// 2. Set up globals in specific order
console.log('🔧 Setting up Jest polyfills for Node.js', process.version);

// Text encoding polyfills (highest priority)
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Web API polyfills (before any imports that might use them)
require('./polyfills/text-encoding-polyfill');
require('./polyfills/fetch-polyfill');
require('./polyfills/crypto-polyfill');

// DOM polyfills
require('./polyfills/dom-polyfill');

// 3. Environment setup
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';

// 4. LAST: Import testing library setup
import '@testing-library/jest-dom';

// Verify polyfills loaded correctly
const verifyPolyfills = () => {
  const checks = [
    { name: 'TextEncoder', available: typeof global.TextEncoder !== 'undefined' },
    { name: 'TextDecoder', available: typeof global.TextDecoder !== 'undefined' },
    { name: 'Headers', available: typeof global.Headers !== 'undefined' },
    { name: 'Request', available: typeof global.Request !== 'undefined' },
    { name: 'Response', available: typeof global.Response !== 'undefined' },
    { name: 'crypto', available: typeof global.crypto !== 'undefined' },
    { name: 'crypto.subtle', available: typeof global.crypto?.subtle !== 'undefined' }
  ];

  const failed = checks.filter(check => !check.available);
  if (failed.length > 0) {
    console.warn('⚠️  Missing polyfills:', failed.map(f => f.name).join(', '));
  } else {
    console.log('✅ All polyfills loaded successfully');
  }
};

verifyPolyfills();
```

### Separate Polyfill Files for Better Organization

```javascript
// polyfills/index.js - Main polyfill loader
const loadPolyfills = () => {
  // Ensure we're in a test environment
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  // Load in dependency order
  require('./text-encoding');
  require('./web-apis');
  require('./crypto');
  require('./dom-apis');
  require('./performance');
};

module.exports = { loadPolyfills };
```

## 5. Next.js 14 Specific Requirements

### Next.js API Route Testing Polyfills

```javascript
// polyfills/nextjs-polyfill.js - Next.js 14 specific polyfills

const { ReadableStream, WritableStream, TransformStream } = require('stream/web');

// Next.js 14 requires these for API routes
if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
}
if (!global.WritableStream) {
  global.WritableStream = WritableStream;
}
if (!global.TransformStream) {
  global.TransformStream = TransformStream;
}

// Mock NextRequest and NextResponse for API route tests
class MockNextRequest extends Request {
  constructor(input, init = {}) {
    super(input, init);
    
    // Add Next.js specific properties
    this.nextUrl = new URL(typeof input === 'string' ? input : input.url);
    this.geo = init.geo || {};
    this.ip = init.ip || '127.0.0.1';
  }

  // Next.js specific methods
  get cookies() {
    const cookieHeader = this.headers.get('cookie') || '';
    const cookies = new Map();
    
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      if (name) {
        cookies.set(name, rest.join('='));
      }
    });

    return {
      get: (name) => cookies.get(name),
      has: (name) => cookies.has(name),
      getAll: () => Array.from(cookies.entries()).map(([name, value]) => ({ name, value }))
    };
  }
}

class MockNextResponse extends Response {
  constructor(body, init = {}) {
    super(body, init);
  }

  static json(object, init = {}) {
    const response = Response.json(object, init);
    return Object.setPrototypeOf(response, MockNextResponse.prototype);
  }

  static redirect(url, status = 302) {
    const response = Response.redirect(url, status);
    return Object.setPrototypeOf(response, MockNextResponse.prototype);
  }

  // Next.js specific cookie methods
  cookies = {
    set: (name, value, options = {}) => {
      let cookieString = `${name}=${value}`;
      if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
      if (options.path) cookieString += `; Path=${options.path}`;
      if (options.domain) cookieString += `; Domain=${options.domain}`;
      if (options.secure) cookieString += '; Secure';
      if (options.httpOnly) cookieString += '; HttpOnly';
      if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;
      
      this.headers.append('Set-Cookie', cookieString);
      return this;
    },
    
    delete: (name) => {
      this.headers.append('Set-Cookie', `${name}=; Max-Age=0`);
      return this;
    }
  };
}

// Global assignments for Next.js
global.NextRequest = MockNextRequest;
global.NextResponse = MockNextResponse;

// Mock next/headers for App Router
jest.mock('next/headers', () => ({
  headers: () => ({
    get: jest.fn(),
    has: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    entries: jest.fn(() => []),
    keys: jest.fn(() => []),
    values: jest.fn(() => [])
  }),
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(() => [])
  })
}));

// Mock next/navigation for client components
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn()
  }),
  usePathname: () => '/test-path',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({})
}));
```

## 6. CI Environment Optimized Configuration

### Complete Jest Configuration for CI

```javascript
// jest.config.js - Optimized for CI environments
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  // Setup files in correct order
  setupFiles: [
    '<rootDir>/jest.polyfills.js'  // Load polyfills FIRST
  ],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'      // Load after Jest environment is ready
  ],
  
  testEnvironment: 'jest-environment-jsdom',
  
  // Module resolution for polyfills
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Transform configuration for Node.js 20+
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['@swc/jest', {
      jsc: {
        transform: {
          react: {
            runtime: 'automatic'
          }
        }
      }
    }]
  },

  // Globals to prevent polyfill conflicts
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  },

  // Test environment options for better polyfill support
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },

  // Module patterns for polyfills
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library/.*|undici))'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**'
  ],

  coverageReporters: ['text', 'lcov', 'html'],
  
  // Timeout for CI environments
  testTimeout: 30000,

  // Performance optimizations for CI
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Error handling
  verbose: true,
  detectOpenHandles: true,
  detectLeaks: true
};

module.exports = createJestConfig(customJestConfig);
```

### Polyfill Verification Script

```javascript
// scripts/verify-polyfills.js - CI verification script
const verifyPolyfillsForCI = () => {
  const requiredGlobals = [
    'TextEncoder',
    'TextDecoder', 
    'Headers',
    'Request', 
    'Response',
    'crypto',
    'btoa',
    'atob',
    'ReadableStream',
    'WritableStream'
  ];

  const missing = requiredGlobals.filter(name => typeof global[name] === 'undefined');
  
  if (missing.length > 0) {
    console.error('❌ Missing required polyfills for CI:', missing);
    process.exit(1);
  }

  console.log('✅ All required polyfills available');
  
  // Test crypto functionality
  try {
    const array = new Uint8Array(10);
    crypto.getRandomValues(array);
    console.log('✅ Crypto.getRandomValues working');
  } catch (error) {
    console.error('❌ Crypto polyfill failed:', error.message);
    process.exit(1);
  }

  // Test encoding functionality
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const encoded = encoder.encode('test');
    const decoded = decoder.decode(encoded);
    
    if (decoded !== 'test') {
      throw new Error('Encoding/decoding mismatch');
    }
    console.log('✅ Text encoding working');
  } catch (error) {
    console.error('❌ Text encoding polyfill failed:', error.message);
    process.exit(1);
  }

  // Test Headers iteration
  try {
    const headers = new Headers([['test', 'value']]);
    const entries = Array.from(headers.entries());
    
    if (entries.length !== 1 || entries[0][0] !== 'test') {
      throw new Error('Headers iteration failed');
    }
    console.log('✅ Headers iteration working');
  } catch (error) {
    console.error('❌ Headers polyfill failed:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  verifyPolyfillsForCI();
}

module.exports = { verifyPolyfillsForCI };
```

## 7. Implementation Recommendations

### For Your Current Setup

Based on your existing configuration, here are specific recommendations:

1. **Replace current jest.setup.js** with the enhanced polyfills above
2. **Create separate polyfill files** for better organization and loading control
3. **Add polyfill verification** to your CI pipeline
4. **Update Jest configuration** to use the new polyfill loading order

### Package Dependencies to Add

```json
{
  "devDependencies": {
    "@swc/jest": "^0.2.29",
    "undici": "^7.15.0"
  }
}
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml - CI configuration
- name: Verify Polyfills
  run: node scripts/verify-polyfills.js

- name: Run Tests with Polyfills
  run: npm test -- --verbose --no-cache
  env:
    NODE_ENV: test
    NODE_OPTIONS: --experimental-vm-modules
```

## 8. Troubleshooting Common Issues

### Issue: Headers iteration not working
**Solution**: Ensure polyfill implements all iterator methods and Symbol.iterator

### Issue: TextEncoder not available in Workers
**Solution**: Use Node.js util module and ensure global assignment happens early

### Issue: Crypto operations failing in CI
**Solution**: Use Node.js crypto module for actual randomness, mock only the Web Crypto API interface

### Issue: Next.js API routes failing in tests
**Solution**: Mock NextRequest/NextResponse and ensure streaming APIs are polyfilled

## 9. Performance Considerations

- Load polyfills only in test environment
- Use lazy loading for heavy polyfills
- Cache polyfill results where possible
- Minimize polyfill overhead in CI builds

## 10. Future-Proofing

As Node.js continues to add native Web API support:
- Monitor Node.js releases for native implementations
- Gradually remove polyfills as they become unnecessary
- Maintain compatibility with both polyfilled and native environments

---

**Generated for Serenity AWS - HIPAA Compliant Mental Health Platform**  
*Node.js v22.18.0 | Jest v30.1.3 | Next.js 14.0.4*