/**
 * Validation utilities for input sanitization and validation
 */

// Email validation regex (RFC 5322 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'E-Mail ist erforderlich' };
  }

  const trimmedEmail = email.trim().toLowerCase();
  
  if (trimmedEmail.length === 0) {
    return { valid: false, error: 'E-Mail ist erforderlich' };
  }

  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'E-Mail ist zu lang (max. 254 Zeichen)' };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { valid: false, error: 'Ungültiges E-Mail-Format' };
  }

  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Passwort ist erforderlich' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Passwort muss mindestens 8 Zeichen lang sein' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Passwort ist zu lang (max. 128 Zeichen)' };
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Passwort muss mindestens einen Großbuchstaben enthalten' };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Passwort muss mindestens einen Kleinbuchstaben enthalten' };
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Passwort muss mindestens eine Zahl enthalten' };
  }

  return { valid: true };
}

export function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name ist erforderlich' };
  }

  const trimmedName = name.trim();
  
  if (trimmedName.length === 0) {
    return { valid: false, error: 'Name ist erforderlich' };
  }

  if (trimmedName.length < 2) {
    return { valid: false, error: 'Name muss mindestens 2 Zeichen lang sein' };
  }

  if (trimmedName.length > 100) {
    return { valid: false, error: 'Name ist zu lang (max. 100 Zeichen)' };
  }

  // Check for potentially dangerous characters
  if (/[<>\"'&]/.test(trimmedName)) {
    return { valid: false, error: 'Name enthält ungültige Zeichen' };
  }

  return { valid: true };
}

export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters (except newlines and tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim().slice(0, maxLength);
  
  return sanitized;
}

export function sanitizePath(path: string): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  // Remove null bytes and dangerous path characters
  let sanitized = path.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Remove path traversal attempts
  sanitized = sanitized.replace(/\.\./g, '');
  
  // Remove leading/trailing slashes and normalize
  sanitized = sanitized.replace(/^\/+|\/+$/g, '');
  
  return sanitized;
}

