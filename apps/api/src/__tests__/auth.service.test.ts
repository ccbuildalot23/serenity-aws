import { AuthService, authService } from '../services/auth.service';

// Mock AWS SDK and other dependencies
jest.mock('@aws-sdk/client-cognito-identity-provider');
jest.mock('jwks-rsa');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  it('should create an instance', () => {
    expect(authService).toBeInstanceOf(AuthService);
  });

  it('should instantiate service successfully', () => {
    const newService = new AuthService();
    expect(newService).toBeDefined();
  });

  it('should have properties defined', () => {
    expect(authService).toBeDefined();
    // Test that the service exists and can be imported
    expect(typeof authService).toBe('object');
  });
});