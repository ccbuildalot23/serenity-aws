// Jest setup file for compliance tests
import '@testing-library/jest-dom';

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