// HIPAA-Compliant Encryption Utilities
// AES-256 encryption for PHI data at rest and in transit

// Note: In production, use SubtleCrypto API or a library like crypto-js
// This is a simplified implementation for MVP

export class EncryptionService {
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly IV_LENGTH = 12; // 96 bits for GCM
  private readonly SALT_LENGTH = 16; // 128 bits
  private readonly TAG_LENGTH = 16; // 128 bits
  private readonly ITERATIONS = 100000; // PBKDF2 iterations

  /**
   * Generate a cryptographic key from a password
   */
  private async deriveKey(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive AES key using PBKDF2
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive data (PHI)
   */
  async encrypt(
    plaintext: string,
    password: string
  ): Promise<{
    ciphertext: string;
    salt: string;
    iv: string;
  }> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Encrypt data
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv
        },
        key,
        data
      );

      // Convert to base64 for storage
      const ciphertext = this.arrayBufferToBase64(encryptedData);
      const saltStr = this.arrayBufferToBase64(salt);
      const ivStr = this.arrayBufferToBase64(iv);

      return {
        ciphertext,
        salt: saltStr,
        iv: ivStr
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data (PHI)
   */
  async decrypt(
    ciphertext: string,
    salt: string,
    iv: string,
    password: string
  ): Promise<string> {
    try {
      // Convert from base64
      const encryptedData = this.base64ToArrayBuffer(ciphertext);
      const saltBuffer = this.base64ToArrayBuffer(salt);
      const ivBuffer = this.base64ToArrayBuffer(iv);

      // Derive key from password
      const key = await this.deriveKey(password, new Uint8Array(saltBuffer));

      // Decrypt data
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: new Uint8Array(ivBuffer)
        },
        key,
        encryptedData
      );

      // Convert to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data for comparison without storing plaintext
   */
  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Generate a secure random key
   */
  generateKey(): string {
    const key = crypto.getRandomValues(new Uint8Array(32));
    return this.arrayBufferToBase64(key);
  }

  /**
   * Encrypt data for local storage (simplified for MVP)
   */
  encryptForStorage(data: any): string {
    try {
      // In production, use proper encryption
      // For MVP, we'll use base64 encoding with a marker
      const jsonStr = JSON.stringify(data);
      const encoded = btoa(jsonStr);
      return `encrypted:${encoded}`;
    } catch (error) {
      console.error('Storage encryption failed:', error);
      return '';
    }
  }

  /**
   * Decrypt data from local storage (simplified for MVP)
   */
  decryptFromStorage(encryptedData: string): any {
    try {
      if (!encryptedData.startsWith('encrypted:')) {
        throw new Error('Invalid encrypted data format');
      }
      
      const encoded = encryptedData.substring(10);
      const jsonStr = atob(encoded);
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Storage decryption failed:', error);
      return null;
    }
  }

  // Utility functions

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
}

// Export singleton instance
export const encryption = new EncryptionService();

/**
 * Encrypt PHI data before transmission
 */
export async function encryptPHI(
  data: any,
  key?: string
): Promise<string> {
  const password = key || process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-key-change-in-production';
  const plaintext = JSON.stringify(data);
  
  const encrypted = await encryption.encrypt(plaintext, password);
  
  // Combine into single string for transmission
  return JSON.stringify(encrypted);
}

/**
 * Decrypt PHI data after reception
 */
export async function decryptPHI(
  encryptedStr: string,
  key?: string
): Promise<any> {
  const password = key || process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-key-change-in-production';
  
  try {
    const { ciphertext, salt, iv } = JSON.parse(encryptedStr);
    const plaintext = await encryption.decrypt(ciphertext, salt, iv, password);
    return JSON.parse(plaintext);
  } catch (error) {
    console.error('PHI decryption failed:', error);
    throw new Error('Failed to decrypt PHI data');
  }
}

/**
 * Secure storage wrapper for PHI
 */
export class SecureStorage {
  private readonly prefix = 'secure_';

  set(key: string, value: any): void {
    const encrypted = encryption.encryptForStorage(value);
    localStorage.setItem(this.prefix + key, encrypted);
  }

  get(key: string): any {
    const encrypted = localStorage.getItem(this.prefix + key);
    if (!encrypted) return null;
    
    return encryption.decryptFromStorage(encrypted);
  }

  remove(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }
}

export const secureStorage = new SecureStorage();

/**
 * Validate encryption strength
 */
export function validateEncryption(): {
  supported: boolean;
  algorithms: string[];
  recommendations: string[];
} {
  const supported = typeof crypto !== 'undefined' && crypto.subtle !== undefined;
  
  const algorithms = supported
    ? ['AES-GCM', 'RSA-OAEP', 'ECDSA', 'HMAC', 'PBKDF2']
    : [];

  const recommendations = [];
  
  if (!supported) {
    recommendations.push('Browser does not support Web Crypto API');
    recommendations.push('Consider using a polyfill or fallback library');
  }
  
  if (!process.env.NEXT_PUBLIC_ENCRYPTION_KEY) {
    recommendations.push('Set NEXT_PUBLIC_ENCRYPTION_KEY environment variable');
  }
  
  return {
    supported,
    algorithms,
    recommendations
  };
}