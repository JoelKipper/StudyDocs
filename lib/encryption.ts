import crypto from 'crypto';
import { hashPassword, verifyPassword } from './auth';

// AES-256-GCM encryption key derivation from password
// This creates a 32-byte key from a password using PBKDF2
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

// Encrypt data using AES-256-GCM
export function encryptData(data: Buffer, password: string): { encrypted: Buffer; salt: Buffer; iv: Buffer; authTag: Buffer } {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // 96 bits for GCM
  const key = deriveKey(password, salt);
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return { encrypted, salt, iv, authTag };
}

// Decrypt data using AES-256-GCM
export function decryptData(
  encrypted: Buffer,
  password: string,
  salt: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  const key = deriveKey(password, salt);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted;
}

// Store encryption metadata alongside encrypted data
export interface EncryptionMetadata {
  salt: string; // base64 encoded
  iv: string; // base64 encoded
  authTag: string; // base64 encoded
}

// Encrypt file and return encrypted buffer with metadata
export function encryptFile(fileBuffer: Buffer, password: string): { encryptedBuffer: Buffer; metadata: EncryptionMetadata } {
  const { encrypted, salt, iv, authTag } = encryptData(fileBuffer, password);
  
  // Combine encrypted data with metadata
  // Format: [salt (16 bytes)][iv (12 bytes)][authTag (16 bytes)][encrypted data]
  const metadataBuffer = Buffer.concat([salt, iv, authTag]);
  const encryptedBuffer = Buffer.concat([metadataBuffer, encrypted]);
  
  return {
    encryptedBuffer,
    metadata: {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    }
  };
}

// Decrypt file from encrypted buffer
export function decryptFile(encryptedBuffer: Buffer, password: string): Buffer {
  // Extract metadata and encrypted data
  const salt = encryptedBuffer.slice(0, 16);
  const iv = encryptedBuffer.slice(16, 28);
  const authTag = encryptedBuffer.slice(28, 44);
  const encrypted = encryptedBuffer.slice(44);
  
  return decryptData(encrypted, password, salt, iv, authTag);
}

// Hash password for storage in database (using same method as user passwords)
export async function hashFilePassword(password: string): Promise<string> {
  return hashPassword(password);
}

// Verify password against hash
export async function verifyFilePassword(password: string, hash: string): Promise<boolean> {
  return verifyPassword(password, hash);
}

