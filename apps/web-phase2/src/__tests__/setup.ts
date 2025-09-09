// Jest setup file for compliance tests
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder from util (Node.js)
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Custom Headers implementation with iteration support
class MockHeaders implements Headers {
  private _headers = new Map<string, string>();

  constructor(init?: HeadersInit) {
    if (init) {
      if (Array.isArray(init)) {
        init.forEach(([key, value]) => this._headers.set(key.toLowerCase(), value));
      } else if (init instanceof MockHeaders) {
        init._headers.forEach((value, key) => this._headers.set(key, value));
      } else {
        Object.entries(init).forEach(([key, value]) => this._headers.set(key.toLowerCase(), value));
      }
    }
  }

  append(name: string, value: string): void {
    const existing = this._headers.get(name.toLowerCase());
    this._headers.set(name.toLowerCase(), existing ? `${existing}, ${value}` : value);
  }

  delete(name: string): void {
    this._headers.delete(name.toLowerCase());
  }

  get(name: string): string | null {
    return this._headers.get(name.toLowerCase()) || null;
  }

  has(name: string): boolean {
    return this._headers.has(name.toLowerCase());
  }

  set(name: string, value: string): void {
    this._headers.set(name.toLowerCase(), value);
  }

  *entries(): IterableIterator<[string, string]> {
    yield* this._headers.entries();
  }

  *keys(): IterableIterator<string> {
    yield* this._headers.keys();
  }

  *values(): IterableIterator<string> {
    yield* this._headers.values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  forEach(callback: (value: string, key: string, parent: Headers) => void): void {
    this._headers.forEach((value, key) => callback(value, key, this as any));
  }
}

// Custom Request implementation
class MockRequest implements Request {
  readonly body: ReadableStream<Uint8Array> | null = null;
  readonly bodyUsed: boolean = false;
  readonly cache: RequestCache = 'default';
  readonly credentials: RequestCredentials = 'same-origin';
  readonly destination: RequestDestination = '';
  readonly headers: Headers;
  readonly integrity: string = '';
  readonly keepalive: boolean = false;
  readonly method: string;
  readonly mode: RequestMode = 'cors';
  readonly redirect: RequestRedirect = 'follow';
  readonly referrer: string = '';
  readonly referrerPolicy: ReferrerPolicy = '';
  readonly signal: AbortSignal = new AbortController().signal;
  readonly url: string;

  constructor(input: RequestInfo | URL, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.toString();
    this.method = init?.method || 'GET';
    this.headers = new MockHeaders(init?.headers);
  }

  async arrayBuffer(): Promise<ArrayBuffer> { return new ArrayBuffer(0); }
  async blob(): Promise<Blob> { throw new Error('Not implemented'); }
  async formData(): Promise<FormData> { throw new Error('Not implemented'); }
  async json(): Promise<any> { return {}; }
  async text(): Promise<string> { return ''; }
  clone(): Request { return new MockRequest(this.url, { method: this.method, headers: this.headers }); }
}

// Custom Response implementation
class MockResponse implements Response {
  readonly body: ReadableStream<Uint8Array> | null = null;
  readonly bodyUsed: boolean = false;
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean = false;
  readonly status: number;
  readonly statusText: string;
  readonly type: ResponseType = 'basic';
  readonly url: string = '';

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new MockHeaders(init?.headers);
  }

  async arrayBuffer(): Promise<ArrayBuffer> { return new ArrayBuffer(0); }
  async blob(): Promise<Blob> { throw new Error('Not implemented'); }
  async formData(): Promise<FormData> { throw new Error('Not implemented'); }
  async json(): Promise<any> { return {}; }
  async text(): Promise<string> { return ''; }
  clone(): Response { return new MockResponse('', { status: this.status, statusText: this.statusText, headers: this.headers }); }

  static error(): Response { return new MockResponse('', { status: 500, statusText: 'Internal Server Error' }); }
  static redirect(url: string, status = 302): Response { return new MockResponse('', { status, headers: { Location: url } }); }
  static json(data: any, init?: ResponseInit): Response { return new MockResponse(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }); }
}

// Set global polyfills
global.Headers = MockHeaders as any;
global.Request = MockRequest as any;
global.Response = MockResponse as any;

// Mock Web APIs that aren't available in Jest environment
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    generateKey: jest.fn(),
    deriveKey: jest.fn().mockResolvedValue({}),
    importKey: jest.fn().mockResolvedValue({}),
    exportKey: jest.fn()
  }
};

// Mock TextEncoder/TextDecoder
const MockTextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn().mockReturnValue(new Uint8Array(16))
}));

const MockTextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn().mockReturnValue('mock-decoded-text')
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Mock base64 functions
global.btoa = jest.fn((str) => Buffer.from(str).toString('base64'));
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString());

// Set up global mocks
Object.defineProperty(global, 'crypto', { value: mockCrypto });
Object.defineProperty(global, 'TextEncoder', { value: MockTextEncoder });
Object.defineProperty(global, 'TextDecoder', { value: MockTextDecoder });
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Environment)'
  },
  writable: true
});

// Suppress console errors during tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

export { mockCrypto, localStorageMock };