import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { EncryptionError } from './errors.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new EncryptionError('ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length < 16) {
    throw new EncryptionError('ENCRYPTION_KEY must be at least 16 characters');
  }
  return scryptSync(key, 'arbitrage-salt', KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new EncryptionError('Cannot encrypt empty value');
  }

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const salt = randomBytes(SALT_LENGTH);

    const derivedKey = scryptSync(key, salt, KEY_LENGTH);
    const cipher = createCipheriv(ALGORITHM, derivedKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const result = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, 'hex'),
    ]).toString('base64');

    return result;
  } catch (error) {
    if (error instanceof EncryptionError) throw error;
    throw new EncryptionError(`Encryption failed: ${(error as Error).message}`);
  }
}

export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new EncryptionError('Cannot decrypt empty value');
  }

  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedData, 'base64');

    if (data.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new EncryptionError('Invalid encrypted data format');
    }

    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = data.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    const derivedKey = scryptSync(key, salt, KEY_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof EncryptionError) throw error;
    throw new EncryptionError(`Decryption failed: ${(error as Error).message}`);
  }
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  try {
    const data = Buffer.from(value, 'base64');
    return data.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
