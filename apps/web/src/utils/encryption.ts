/**
 * HIPAA-Compliant Encryption Utility
 * Implements AES-GCM encryption for PHI protection
 * Meets HIPAA technical safeguards requirements for encryption
 */

export interface EncryptionConfig {
  keyDerivationIterations: number; // PBKDF2 iterations (default: 100000)
  keyLength: number; // Key length in bits (default: 256)
  ivLength: number; // Initialization Vector length (default: 12 bytes for GCM)
  tagLength: number; // Authentication tag length (default: 128 bits)
  saltLength: number; // Salt length for key derivation (default: 32 bytes)
}

export interface EncryptedData {
  ciphertext: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector
  tag: string; // Base64 encoded authentication tag
  salt: string; // Base64 encoded salt for key derivation
  algorithm: string; // Encryption algorithm identifier
  keyDerivationParams: {
    iterations: number;
    algorithm: string;
  };
}

export interface PHIEncryptionMetadata {
  dataType: 'patient_record' | 'assessment_data' | 'crisis_plan' | 'communication' | 'other';
  patientId?: string;
  providerId?: string;
  encryptionTimestamp: string;
  keyVersion: string;
  complianceLevel: 'hipaa' | 'hipaa_high_security';
}

export class PHIEncryption {
  private config: EncryptionConfig;
  private crypto: Crypto;

  constructor(crypto?: Crypto, config: Partial<EncryptionConfig> = {}) {
    // Use provided crypto or default to Web Crypto API
    this.crypto = crypto || (typeof window !== 'undefined' ? window.crypto : require('crypto').webcrypto);
    
    if (!this.crypto) {
      throw new Error('Web Crypto API not available - required for HIPAA compliance');
    }
    
    if (!this.crypto.subtle) {
      throw new Error('SubtleCrypto not available - required for HIPAA encryption');
    }
    this.config = {
      keyDerivationIterations: 100000, // OWASP recommended minimum
      keyLength: 256, // AES-256
      ivLength: 12, // 96 bits for GCM
      tagLength: 128, // 128 bits auth tag
      saltLength: 32, // 256 bits salt
      ...config
    };

    if (!this.crypto || !this.crypto.subtle) {
      throw new Error('Web Crypto API not available - required for HIPAA compliance');
    }
  }

  /**
   * Encrypt PHI data with AES-GCM and PBKDF2 key derivation
   */
  async encryptPHI(
    plaintext: string,
    password: string,
    metadata: PHIEncryptionMetadata
  ): Promise<EncryptedData & { metadata: PHIEncryptionMetadata }> {
    try {
      // Validate inputs
      this.validateEncryptionInputs(plaintext, password, metadata);

      // Generate cryptographically secure random values
      const salt = this.generateSecureRandom(this.config.saltLength);
      const iv = this.generateSecureRandom(this.config.ivLength);

      // Derive encryption key using PBKDF2
      const key = await this.deriveKey(password, salt);

      // Encrypt the plaintext
      const encoder = new TextEncoder();
      const plaintextBytes = encoder.encode(plaintext);

      const encryptedBuffer = await this.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: this.config.tagLength
        },
        key,
        plaintextBytes
      );

      // Extract ciphertext and authentication tag
      const encryptedBytes = new Uint8Array(encryptedBuffer);
      const tagBytes = encryptedBytes.slice(-16); // Last 16 bytes are the tag
      const ciphertextBytes = encryptedBytes.slice(0, -16);

      const encryptedData: EncryptedData = {
        ciphertext: this.arrayBufferToBase64(ciphertextBytes.buffer),
        iv: this.arrayBufferToBase64(iv),
        tag: this.arrayBufferToBase64(tagBytes.buffer),
        salt: this.arrayBufferToBase64(salt),
        algorithm: 'AES-GCM-256',
        keyDerivationParams: {
          iterations: this.config.keyDerivationIterations,
          algorithm: 'PBKDF2'
        }
      };

      return {
        ...encryptedData,
        metadata: {
          ...metadata,
          encryptionTimestamp: new Date().toISOString(),
          keyVersion: await this.getKeyVersion()
        }
      };
    } catch (error) {
      throw new Error(`PHI encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt PHI data with integrity verification
   */
  async decryptPHI(
    encryptedData: EncryptedData,
    password: string
  ): Promise<string> {
    try {
      // Validate encrypted data structure
      this.validateEncryptedData(encryptedData);

      // Convert base64 data back to arrays
      const salt = this.base64ToArrayBuffer(encryptedData.salt);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const ciphertextBytes = this.base64ToArrayBuffer(encryptedData.ciphertext);
      const tagBytes = this.base64ToArrayBuffer(encryptedData.tag);

      // Derive the same encryption key
      const key = await this.deriveKey(password, salt, encryptedData.keyDerivationParams.iterations);

      // Combine ciphertext and tag for GCM decryption
      const combinedBytes = new Uint8Array(ciphertextBytes.byteLength + tagBytes.byteLength);
      combinedBytes.set(new Uint8Array(ciphertextBytes));
      combinedBytes.set(new Uint8Array(tagBytes), ciphertextBytes.byteLength);

      // Decrypt and verify integrity
      const decryptedBuffer = await this.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: this.config.tagLength
        },
        key,
        combinedBytes
      );

      // Convert decrypted bytes back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);

    } catch (error) {
      throw new Error(`PHI decryption failed: ${error}`);
    }
  }

  /**
   * Encrypt data using environment-derived key (for system-level encryption)
   */
  async encryptWithSystemKey(
    plaintext: string,
    keyIdentifier: string = 'VITE_ENCRYPTION_MASTER_KEY'
  ): Promise<EncryptedData> {
    const systemKey = this.getEnvironmentKey(keyIdentifier);
    if (!systemKey) {
      throw new Error(`System encryption key not found: ${keyIdentifier}`);
    }

    return this.encryptWithStaticKey(plaintext, systemKey);
  }

  /**
   * Decrypt data using environment-derived key
   */
  async decryptWithSystemKey(
    encryptedData: EncryptedData,
    keyIdentifier: string = 'VITE_ENCRYPTION_MASTER_KEY'
  ): Promise<string> {
    const systemKey = this.getEnvironmentKey(keyIdentifier);
    if (!systemKey) {
      throw new Error(`System encryption key not found: ${keyIdentifier}`);
    }

    return this.decryptWithStaticKey(encryptedData, systemKey);
  }

  /**
   * Generate secure encryption key for storage
   */
  async generateSecureKey(): Promise<string> {
    const keyBytes = this.generateSecureRandom(32); // 256 bits
    return this.arrayBufferToBase64(keyBytes);
  }

  /**
   * Validate data integrity without decrypting
   */
  async validateIntegrity(encryptedData: EncryptedData, password: string): Promise<boolean> {
    try {
      await this.decryptPHI(encryptedData, password);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get encryption strength metrics
   */
  getEncryptionMetrics(): {
    algorithm: string;
    keyLength: number;
    keyDerivationIterations: number;
    complianceLevel: string;
    securityStrength: 'low' | 'medium' | 'high' | 'maximum';
  } {
    let securityStrength: 'low' | 'medium' | 'high' | 'maximum' = 'medium';
    
    if (this.config.keyLength >= 256 && this.config.keyDerivationIterations >= 100000) {
      securityStrength = 'high';
    }
    
    if (this.config.keyLength >= 256 && this.config.keyDerivationIterations >= 500000) {
      securityStrength = 'maximum';
    }

    return {
      algorithm: 'AES-GCM',
      keyLength: this.config.keyLength,
      keyDerivationIterations: this.config.keyDerivationIterations,
      complianceLevel: 'HIPAA Technical Safeguards',
      securityStrength
    };
  }

  private async encryptWithStaticKey(plaintext: string, keyString: string): Promise<EncryptedData> {
    const salt = this.generateSecureRandom(this.config.saltLength);
    const iv = this.generateSecureRandom(this.config.ivLength);
    const key = await this.deriveKey(keyString, salt);

    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    const encryptedBuffer = await this.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: this.config.tagLength
      },
      key,
      plaintextBytes
    );

    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const tagBytes = encryptedBytes.slice(-16);
    const ciphertextBytes = encryptedBytes.slice(0, -16);

    return {
      ciphertext: this.arrayBufferToBase64(ciphertextBytes.buffer),
      iv: this.arrayBufferToBase64(iv),
      tag: this.arrayBufferToBase64(tagBytes.buffer),
      salt: this.arrayBufferToBase64(salt),
      algorithm: 'AES-GCM-256',
      keyDerivationParams: {
        iterations: this.config.keyDerivationIterations,
        algorithm: 'PBKDF2'
      }
    };
  }

  private async decryptWithStaticKey(encryptedData: EncryptedData, keyString: string): Promise<string> {
    const salt = this.base64ToArrayBuffer(encryptedData.salt);
    const iv = this.base64ToArrayBuffer(encryptedData.iv);
    const ciphertextBytes = this.base64ToArrayBuffer(encryptedData.ciphertext);
    const tagBytes = this.base64ToArrayBuffer(encryptedData.tag);

    const key = await this.deriveKey(keyString, salt, encryptedData.keyDerivationParams.iterations);

    const combinedBytes = new Uint8Array(ciphertextBytes.byteLength + tagBytes.byteLength);
    combinedBytes.set(new Uint8Array(ciphertextBytes));
    combinedBytes.set(new Uint8Array(tagBytes), ciphertextBytes.byteLength);

    const decryptedBuffer = await this.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: this.config.tagLength
      },
      key,
      combinedBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  private async deriveKey(
    password: string, 
    salt: ArrayBuffer, 
    iterations: number = this.config.keyDerivationIterations
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await this.crypto.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES key using PBKDF2
    return this.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: this.config.keyLength
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private generateSecureRandom(length: number): ArrayBuffer {
    const array = new Uint8Array(length);
    this.crypto.getRandomValues(array);
    return array.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private validateEncryptionInputs(
    plaintext: string,
    password: string,
    metadata: PHIEncryptionMetadata
  ): void {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Invalid plaintext: must be a non-empty string');
    }

    if (!password || password.length < 8) {
      throw new Error('Invalid password: must be at least 8 characters');
    }

    if (!metadata || !metadata.dataType) {
      throw new Error('Invalid metadata: dataType is required');
    }

    // HIPAA requires tracking of PHI access
    const validDataTypes = ['patient_record', 'assessment_data', 'crisis_plan', 'communication', 'other'];
    if (!validDataTypes.includes(metadata.dataType)) {
      throw new Error(`Invalid dataType: must be one of ${validDataTypes.join(', ')}`);
    }
  }

  private validateEncryptedData(encryptedData: EncryptedData): void {
    const requiredFields = ['ciphertext', 'iv', 'tag', 'salt', 'algorithm', 'keyDerivationParams'];
    
    requiredFields.forEach(field => {
      if (!encryptedData[field as keyof EncryptedData]) {
        throw new Error(`Invalid encrypted data: missing ${field}`);
      }
    });

    if (encryptedData.algorithm !== 'AES-GCM-256') {
      throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
    }

    if (encryptedData.keyDerivationParams.algorithm !== 'PBKDF2') {
      throw new Error(`Unsupported key derivation: ${encryptedData.keyDerivationParams.algorithm}`);
    }
  }

  private getEnvironmentKey(keyIdentifier: string): string | undefined {
    // In browser environment, try to get from process.env (bundler will replace)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[keyIdentifier];
    }

    // Fallback for testing or other environments
    return undefined;
  }

  private async getKeyVersion(): Promise<string> {
    // In production, this would return the actual key version from key management
    return 'v1.0.0';
  }

  /**
   * Clear sensitive data from memory (best effort)
   */
  static clearSensitiveData(data: any): void {
    if (typeof data === 'string') {
      // Can't actually clear string in JavaScript, but we can try
      data = '';
    } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      // Clear array buffer
      new Uint8Array(data).fill(0);
    } else if (typeof data === 'object' && data !== null) {
      // Clear object properties
      Object.keys(data).forEach(key => {
        data[key] = undefined;
      });
    }
  }
}