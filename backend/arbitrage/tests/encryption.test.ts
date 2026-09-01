import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, isEncrypted } from '../src/utils/encryption.js';

describe('Encryption Utils', () => {
  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-16chars');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('encrypt', () => {
    it('should encrypt a string', () => {
      const plaintext = 'my-secret-api-key';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe('string');
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'same-secret';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw for empty value', () => {
      expect(() => encrypt('')).toThrow('Cannot encrypt empty value');
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string back to original', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'key!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'key-with-unicode-🔐-日本語';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw for empty value', () => {
      expect(() => decrypt('')).toThrow('Cannot decrypt empty value');
    });

    it('should throw for invalid encrypted data', () => {
      expect(() => decrypt('invalid-data')).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted value', () => {
      const encrypted = encrypt('test-value');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncrypted('plain-text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });
  });

  describe('round-trip', () => {
    it('should correctly round-trip API key', () => {
      const apiKey = 'aB3dEfGhIjKlMnOpQrStUvWxYz123456';
      const encrypted = encrypt(apiKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(apiKey);
    });

    it('should correctly round-trip API secret', () => {
      const apiSecret = 'secretKey123456789abcdefghijklmnopqrstuvwxyz';
      const encrypted = encrypt(apiSecret);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(apiSecret);
    });

    it('should handle long strings', () => {
      const longString = 'a'.repeat(1000);
      const encrypted = encrypt(longString);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(longString);
    });
  });
});

describe('Encryption with missing key', () => {
  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should throw when ENCRYPTION_KEY is not set', () => {
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
  });
});
