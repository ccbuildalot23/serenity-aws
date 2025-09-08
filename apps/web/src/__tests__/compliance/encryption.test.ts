/**
 * PHI Encryption Compliance Tests
 * Testing AES-GCM encryption with Web Crypto API for HIPAA compliance
 * Validates encryption strength, integrity, and key management
 */

import { PHIEncryption, EncryptedData, PHIEncryptionMetadata } from '../../utils/encryption';

// Mock crypto for Node.js environment
const mockCrypto = require('crypto').webcrypto;

describe('PHIEncryption - HIPAA Compliance Tests', () => {
  let encryption: PHIEncryption;

  beforeEach(() => {
    encryption = new PHIEncryption(mockCrypto);
  });

  afterEach(() => {
    // Clear any sensitive data
    PHIEncryption.clearSensitiveData('');
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with HIPAA-compliant default settings', () => {
      const defaultEncryption = new PHIEncryption(mockCrypto);
      const metrics = defaultEncryption.getEncryptionMetrics();

      expect(metrics.algorithm).toBe('AES-GCM');
      expect(metrics.keyLength).toBe(256); // AES-256
      expect(metrics.keyDerivationIterations).toBeGreaterThanOrEqual(100000); // OWASP minimum
      expect(metrics.complianceLevel).toBe('HIPAA Technical Safeguards');
      expect(metrics.securityStrength).toBeOneOf(['high', 'maximum']);
    });

    it('should accept custom configuration for enhanced security', () => {
      const highSecurityEncryption = new PHIEncryption(mockCrypto, {
        keyDerivationIterations: 500000, // Higher than default
        keyLength: 256,
        tagLength: 128
      });

      const metrics = highSecurityEncryption.getEncryptionMetrics();
      expect(metrics.keyDerivationIterations).toBe(500000);
      expect(metrics.securityStrength).toBe('maximum');
    });

    it('should throw error when Web Crypto API is unavailable', () => {
      // Jest setup file provides a global crypto object, so this test needs to check construction logic differently
      const originalCrypto = (global as any).crypto;
      delete (global as any).crypto;
      
      expect(() => {
        new PHIEncryption();
      }).toThrow('Web Crypto API not available - required for HIPAA compliance');
      
      // Restore global crypto
      (global as any).crypto = originalCrypto;
    });

    it('should validate crypto.subtle availability', () => {
      const mockIncompleteCrypto = {} as Crypto;
      
      expect(() => {
        new PHIEncryption(mockIncompleteCrypto);
      }).toThrow('SubtleCrypto not available - required for HIPAA encryption');
    });
  });

  describe('PHI Encryption - AES-GCM Implementation', () => {
    const testPHI = 'Patient: John Doe, DOB: 1980-01-01, Diagnosis: Depression, Treatment: Therapy';
    const testPassword = 'SecurePassword123!';
    const testMetadata: PHIEncryptionMetadata = {
      dataType: 'patient_record',
      patientId: 'patient-123',
      providerId: 'provider-456',
      encryptionTimestamp: '',
      keyVersion: '',
      complianceLevel: 'hipaa'
    };

    it('should encrypt PHI data successfully', async () => {
      const encrypted = await encryption.encryptPHI(testPHI, testPassword, testMetadata);

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-GCM-256');
      expect(encrypted.keyDerivationParams.algorithm).toBe('PBKDF2');
      expect(encrypted.keyDerivationParams.iterations).toBeGreaterThanOrEqual(100000);
    });

    it('should include complete metadata in encrypted output', async () => {
      const encrypted = await encryption.encryptPHI(testPHI, testPassword, testMetadata);

      expect(encrypted.metadata).toBeDefined();
      expect(encrypted.metadata.dataType).toBe('patient_record');
      expect(encrypted.metadata.patientId).toBe('patient-123');
      expect(encrypted.metadata.providerId).toBe('provider-456');
      expect(encrypted.metadata.encryptionTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(encrypted.metadata.keyVersion).toBeDefined();
      expect(encrypted.metadata.complianceLevel).toBe('hipaa');
    });

    it('should generate unique encryption outputs for identical inputs', async () => {
      const encrypted1 = await encryption.encryptPHI(testPHI, testPassword, testMetadata);
      const encrypted2 = await encryption.encryptPHI(testPHI, testPassword, testMetadata);

      // Different salt and IV should result in different ciphertext
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.tag).not.toBe(encrypted2.tag);
    });

    it('should encrypt and decrypt round-trip successfully', async () => {
      const encrypted = await encryption.encryptPHI(testPHI, testPassword, testMetadata);
      const decrypted = await encryption.decryptPHI(encrypted, testPassword);

      expect(decrypted).toBe(testPHI);
    });

    it('should handle large PHI datasets', async () => {
      // Create large test data (1MB of PHI)
      const largePHI = 'Patient Record: '.repeat(50000) + testPHI;
      
      const startTime = Date.now();
      const encrypted = await encryption.encryptPHI(largePHI, testPassword, testMetadata);
      const decrypted = await encryption.decryptPHI(encrypted, testPassword);
      const endTime = Date.now();

      expect(decrypted).toBe(largePHI);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle unicode and special characters in PHI', async () => {
      const unicodePHI = '患者姓名: João da Silva, Diagnóstico: Depressão, Símbolos: ®©™∞';
      
      const encrypted = await encryption.encryptPHI(unicodePHI, testPassword, testMetadata);
      const decrypted = await encryption.decryptPHI(encrypted, testPassword);

      expect(decrypted).toBe(unicodePHI);
    });
  });

  describe('Input Validation and Security', () => {
    const validMetadata: PHIEncryptionMetadata = {
      dataType: 'patient_record',
      patientId: 'patient-123',
      encryptionTimestamp: '',
      keyVersion: '',
      complianceLevel: 'hipaa'
    };

    it('should validate plaintext input', async () => {
      await expect(
        encryption.encryptPHI('', 'password123', validMetadata)
      ).rejects.toThrow('Invalid plaintext: must be a non-empty string');

      await expect(
        encryption.encryptPHI(null as any, 'password123', validMetadata)
      ).rejects.toThrow('Invalid plaintext: must be a non-empty string');
    });

    it('should validate password strength', async () => {
      await expect(
        encryption.encryptPHI('test data', '', validMetadata)
      ).rejects.toThrow('Invalid password: must be at least 8 characters');

      await expect(
        encryption.encryptPHI('test data', '1234567', validMetadata) // 7 chars
      ).rejects.toThrow('Invalid password: must be at least 8 characters');
    });

    it('should validate metadata structure', async () => {
      await expect(
        encryption.encryptPHI('test data', 'password123', null as any)
      ).rejects.toThrow('Invalid metadata: dataType is required');

      await expect(
        encryption.encryptPHI('test data', 'password123', {} as any)
      ).rejects.toThrow('Invalid metadata: dataType is required');
    });

    it('should validate dataType values', async () => {
      const invalidMetadata = { ...validMetadata, dataType: 'invalid_type' as any };
      
      await expect(
        encryption.encryptPHI('test data', 'password123', invalidMetadata)
      ).rejects.toThrow('Invalid dataType: must be one of');
    });

    it('should accept all valid PHI data types', async () => {
      const validDataTypes = ['patient_record', 'assessment_data', 'crisis_plan', 'communication', 'other'];

      for (const dataType of validDataTypes) {
        const metadata = { ...validMetadata, dataType: dataType as any };
        
        await expect(
          encryption.encryptPHI('test data', 'password123', metadata)
        ).resolves.toBeDefined();
      }
    });
  });

  describe('Decryption and Integrity Verification', () => {
    let testEncryptedData: EncryptedData;
    const testPlaintext = 'Confidential Patient Information';
    const testPassword = 'TestPassword123!';

    beforeEach(async () => {
      const metadata: PHIEncryptionMetadata = {
        dataType: 'patient_record',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };
      
      const encrypted = await encryption.encryptPHI(testPlaintext, testPassword, metadata);
      testEncryptedData = encrypted;
    });

    it('should decrypt data with correct password', async () => {
      const decrypted = await encryption.decryptPHI(testEncryptedData, testPassword);
      expect(decrypted).toBe(testPlaintext);
    });

    it('should fail decryption with incorrect password', async () => {
      await expect(
        encryption.decryptPHI(testEncryptedData, 'WrongPassword')
      ).rejects.toThrow('PHI decryption failed');
    });

    it('should detect corrupted ciphertext', async () => {
      const corruptedData = {
        ...testEncryptedData,
        ciphertext: testEncryptedData.ciphertext.slice(0, -4) + 'XXXX' // Corrupt last 4 chars
      };

      await expect(
        encryption.decryptPHI(corruptedData, testPassword)
      ).rejects.toThrow('PHI decryption failed');
    });

    it('should detect corrupted authentication tag', async () => {
      const corruptedData = {
        ...testEncryptedData,
        tag: testEncryptedData.tag.slice(0, -4) + 'YYYY'
      };

      await expect(
        encryption.decryptPHI(corruptedData, testPassword)
      ).rejects.toThrow('PHI decryption failed');
    });

    it('should detect corrupted initialization vector', async () => {
      const corruptedData = {
        ...testEncryptedData,
        iv: testEncryptedData.iv.slice(0, -4) + 'ZZZZ'
      };

      await expect(
        encryption.decryptPHI(corruptedData, testPassword)
      ).rejects.toThrow('PHI decryption failed');
    });

    it('should validate encrypted data structure', async () => {
      const incompleteData = {
        ...testEncryptedData,
        tag: undefined
      };

      await expect(
        encryption.decryptPHI(incompleteData as any, testPassword)
      ).rejects.toThrow('Invalid encrypted data: missing tag');
    });

    it('should validate algorithm compatibility', async () => {
      const incompatibleData = {
        ...testEncryptedData,
        algorithm: 'DES-CBC' // Insecure algorithm
      };

      await expect(
        encryption.decryptPHI(incompatibleData, testPassword)
      ).rejects.toThrow('Unsupported algorithm: DES-CBC');
    });

    it('should validate key derivation parameters', async () => {
      const invalidKDF = {
        ...testEncryptedData,
        keyDerivationParams: {
          ...testEncryptedData.keyDerivationParams,
          algorithm: 'MD5' // Insecure hash
        }
      };

      await expect(
        encryption.decryptPHI(invalidKDF, testPassword)
      ).rejects.toThrow('Unsupported key derivation: MD5');
    });
  });

  describe('System-Level Encryption with Environment Keys', () => {
    beforeEach(() => {
      // Mock environment variable
      process.env.VITE_ENCRYPTION_MASTER_KEY = 'test-master-key-for-system-encryption-12345678';
    });

    afterEach(() => {
      delete process.env.VITE_ENCRYPTION_MASTER_KEY;
    });

    it('should encrypt with system key when environment variable is available', async () => {
      const testData = 'System configuration data';
      
      const encrypted = await encryption.encryptWithSystemKey(testData);
      const decrypted = await encryption.decryptWithSystemKey(encrypted);

      expect(decrypted).toBe(testData);
    });

    it('should support custom key identifiers', async () => {
      process.env.CUSTOM_KEY = 'custom-encryption-key-98765432';
      
      const testData = 'Custom encrypted data';
      
      const encrypted = await encryption.encryptWithSystemKey(testData, 'CUSTOM_KEY');
      const decrypted = await encryption.decryptWithSystemKey(encrypted, 'CUSTOM_KEY');

      expect(decrypted).toBe(testData);
      
      delete process.env.CUSTOM_KEY;
    });

    it('should throw error when environment key is missing', async () => {
      delete process.env.VITE_ENCRYPTION_MASTER_KEY;

      await expect(
        encryption.encryptWithSystemKey('test data')
      ).rejects.toThrow('System encryption key not found');
    });

    it('should fail decryption with missing environment key', async () => {
      const testData = 'Test data for decryption';
      const encrypted = await encryption.encryptWithSystemKey(testData);
      
      delete process.env.VITE_ENCRYPTION_MASTER_KEY;

      await expect(
        encryption.decryptWithSystemKey(encrypted)
      ).rejects.toThrow('System encryption key not found');
    });
  });

  describe('Key Generation and Management', () => {
    it('should generate cryptographically secure keys', async () => {
      const key1 = await encryption.generateSecureKey();
      const key2 = await encryption.generateSecureKey();

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1).not.toBe(key2);
      expect(key1.length).toBeGreaterThan(40); // Base64 encoded 256-bit key
      expect(key2.length).toBeGreaterThan(40);
    });

    it('should generate keys with proper entropy', async () => {
      const keys = [];
      
      // Generate multiple keys to test randomness
      for (let i = 0; i < 10; i++) {
        keys.push(await encryption.generateSecureKey());
      }

      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(10);

      // Keys should have proper base64 encoding
      keys.forEach(key => {
        expect(key).toMatch(/^[A-Za-z0-9+/]+=*$/);
      });
    });
  });

  describe('Integrity Validation', () => {
    it('should validate integrity without decrypting', async () => {
      const testData = 'Integrity test data';
      const password = 'TestPassword123!';
      const metadata: PHIEncryptionMetadata = {
        dataType: 'patient_record',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      const encrypted = await encryption.encryptPHI(testData, password, metadata);
      
      const isValid = await encryption.validateIntegrity(encrypted, password);
      expect(isValid).toBe(true);
    });

    it('should detect integrity failures', async () => {
      const testData = 'Integrity test data';
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const metadata: PHIEncryptionMetadata = {
        dataType: 'patient_record',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      const encrypted = await encryption.encryptPHI(testData, password, metadata);
      
      const isValid = await encryption.validateIntegrity(encrypted, wrongPassword);
      expect(isValid).toBe(false);
    });

    it('should detect tampered data', async () => {
      const testData = 'Integrity test data';
      const password = 'TestPassword123!';
      const metadata: PHIEncryptionMetadata = {
        dataType: 'patient_record',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      const encrypted = await encryption.encryptPHI(testData, password, metadata);
      
      // Tamper with the ciphertext
      const tamperedData = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.replace(/.$/, '0') // Change last character
      };
      
      const isValid = await encryption.validateIntegrity(tamperedData, password);
      expect(isValid).toBe(false);
    });
  });

  describe('Performance and Security Benchmarks', () => {
    it('should encrypt/decrypt within acceptable time limits', async () => {
      const testData = 'Performance test data with moderate length to simulate real PHI data';
      const password = 'PerformanceTestPassword123!';
      const metadata: PHIEncryptionMetadata = {
        dataType: 'assessment_data',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      const encryptStart = Date.now();
      const encrypted = await encryption.encryptPHI(testData, password, metadata);
      const encryptTime = Date.now() - encryptStart;

      const decryptStart = Date.now();
      const decrypted = await encryption.decryptPHI(encrypted, password);
      const decryptTime = Date.now() - decryptStart;

      expect(encryptTime).toBeLessThan(1000); // < 1 second
      expect(decryptTime).toBeLessThan(1000); // < 1 second
      expect(decrypted).toBe(testData);
    });

    it('should use secure key derivation iterations', () => {
      const metrics = encryption.getEncryptionMetrics();
      
      // OWASP recommends minimum 100,000 iterations for PBKDF2
      expect(metrics.keyDerivationIterations).toBeGreaterThanOrEqual(100000);
    });

    it('should meet HIPAA encryption strength requirements', () => {
      const metrics = encryption.getEncryptionMetrics();
      
      expect(metrics.algorithm).toBe('AES-GCM');
      expect(metrics.keyLength).toBe(256); // AES-256 required for HIPAA
      expect(metrics.complianceLevel).toBe('HIPAA Technical Safeguards');
      expect(['high', 'maximum']).toContain(metrics.securityStrength);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty metadata gracefully', async () => {
      const minimalMetadata: PHIEncryptionMetadata = {
        dataType: 'other',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      await expect(
        encryption.encryptPHI('test data', 'password123', minimalMetadata)
      ).resolves.toBeDefined();
    });

    it('should handle very short plaintext', async () => {
      const metadata: PHIEncryptionMetadata = {
        dataType: 'other',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      const encrypted = await encryption.encryptPHI('X', 'password123', metadata);
      const decrypted = await encryption.decryptPHI(encrypted, 'password123');
      
      expect(decrypted).toBe('X');
    });

    it('should handle different key derivation iterations', async () => {
      const customEncryption = new PHIEncryption(mockCrypto, {
        keyDerivationIterations: 50000 // Lower for testing
      });

      const testData = 'Different iterations test';
      const password = 'TestPassword123!';
      const metadata: PHIEncryptionMetadata = {
        dataType: 'other',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      const encrypted = await customEncryption.encryptPHI(testData, password, metadata);
      expect(encrypted.keyDerivationParams.iterations).toBe(50000);

      const decrypted = await customEncryption.decryptPHI(encrypted, password);
      expect(decrypted).toBe(testData);
    });
  });

  describe('Memory and Security Cleanup', () => {
    it('should provide clearSensitiveData utility', () => {
      expect(PHIEncryption.clearSensitiveData).toBeDefined();
      expect(typeof PHIEncryption.clearSensitiveData).toBe('function');
    });

    it('should clear string data (best effort)', () => {
      let sensitiveString = 'Sensitive Patient Data';
      
      PHIEncryption.clearSensitiveData(sensitiveString);
      
      // JavaScript strings are immutable, so we can't actually clear them
      // but the function should not throw an error
      expect(sensitiveString).toBe('Sensitive Patient Data');
    });

    it('should clear array buffer data', () => {
      const buffer = new ArrayBuffer(32);
      const view = new Uint8Array(buffer);
      view.fill(0xFF); // Fill with test data

      PHIEncryption.clearSensitiveData(buffer);

      // Check that buffer was cleared
      const clearedView = new Uint8Array(buffer);
      expect(clearedView.every(byte => byte === 0)).toBe(true);
    });

    it('should clear object properties', () => {
      const sensitiveObject = {
        password: 'secret123',
        key: 'encryption-key',
        data: 'sensitive-data'
      };

      PHIEncryption.clearSensitiveData(sensitiveObject);

      expect(sensitiveObject.password).toBeUndefined();
      expect(sensitiveObject.key).toBeUndefined();
      expect(sensitiveObject.data).toBeUndefined();
    });
  });

  describe('HIPAA Compliance Validation', () => {
    it('should meet all HIPAA technical safeguards for encryption', async () => {
      const phiData = 'HIPAA Protected Health Information: John Doe, SSN: 123-45-6789';
      const password = 'HIPAACompliantPassword123!';
      const metadata: PHIEncryptionMetadata = {
        dataType: 'patient_record',
        patientId: 'hipaa-test-patient',
        providerId: 'hipaa-test-provider',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      const encrypted = await encryption.encryptPHI(phiData, password, metadata);

      // Verify encryption metadata requirements
      expect(encrypted.metadata.dataType).toBe('patient_record');
      expect(encrypted.metadata.patientId).toBe('hipaa-test-patient');
      expect(encrypted.metadata.providerId).toBe('hipaa-test-provider');
      expect(encrypted.metadata.complianceLevel).toBe('hipaa');
      expect(encrypted.metadata.encryptionTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Verify encryption strength
      expect(encrypted.algorithm).toBe('AES-GCM-256');
      expect(encrypted.keyDerivationParams.algorithm).toBe('PBKDF2');
      expect(encrypted.keyDerivationParams.iterations).toBeGreaterThanOrEqual(100000);

      // Verify data integrity and authenticity
      const decrypted = await encryption.decryptPHI(encrypted, password);
      expect(decrypted).toBe(phiData);

      // Verify integrity validation
      const isValid = await encryption.validateIntegrity(encrypted, password);
      expect(isValid).toBe(true);
    });

    it('should support high-security HIPAA compliance level', async () => {
      const highSecurityEncryption = new PHIEncryption(mockCrypto, {
        keyDerivationIterations: 500000 // Higher security
      });

      const phiData = 'High Security PHI Data';
      const metadata: PHIEncryptionMetadata = {
        dataType: 'crisis_plan',
        complianceLevel: 'hipaa_high_security',
        encryptionTimestamp: '',
        keyVersion: ''
      };

      const encrypted = await highSecurityEncryption.encryptPHI(phiData, 'SecurePass123!', metadata);

      expect(encrypted.metadata.complianceLevel).toBe('hipaa_high_security');
      expect(encrypted.keyDerivationParams.iterations).toBe(500000);

      const metrics = highSecurityEncryption.getEncryptionMetrics();
      expect(metrics.securityStrength).toBe('maximum');
    });

    it('should provide complete audit trail for PHI encryption/decryption', async () => {
      const phiData = 'Audit Trail PHI Test Data';
      const password = 'AuditPassword123!';
      const metadata: PHIEncryptionMetadata = {
        dataType: 'assessment_data',
        patientId: 'audit-patient-123',
        providerId: 'audit-provider-456',
        encryptionTimestamp: '',
        keyVersion: '',
        complianceLevel: 'hipaa'
      };

      const encrypted = await encryption.encryptPHI(phiData, password, metadata);

      // Verify all audit trail elements are present
      const auditElements = [
        'dataType', 'patientId', 'providerId', 'encryptionTimestamp', 
        'keyVersion', 'complianceLevel'
      ];

      auditElements.forEach(element => {
        expect(encrypted.metadata).toHaveProperty(element);
        expect(encrypted.metadata[element as keyof PHIEncryptionMetadata]).toBeDefined();
      });

      // Verify encryption parameters are auditable
      expect(encrypted.algorithm).toBeDefined();
      expect(encrypted.keyDerivationParams).toBeDefined();
      expect(typeof encrypted.keyDerivationParams.iterations).toBe('number');
    });
  });
});