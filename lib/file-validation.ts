/**
 * File validation utilities for upload security
 */

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  // Text
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  // Code
  'text/javascript',
  'text/css',
  'application/json',
  'application/xml',
  'text/xml',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-tar',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  // Video
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/ogg',
];

// Allowed file extensions (lowercase)
const ALLOWED_EXTENSIONS = [
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  // Text
  'txt', 'csv', 'md', 'html', 'htm',
  // Code
  'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'css', 'scss', 'sass', 'less',
  'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs',
  'swift', 'kt', 'dart', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
  // Audio
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
  // Video
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v',
];

// Dangerous file extensions that should be blocked
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'app',
  'deb', 'rpm', 'dmg', 'pkg', 'msi', 'sh', 'run', 'bin',
];

// Magic bytes (file signatures) for common file types
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]],
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Check if file extension is allowed
 */
export function isExtensionAllowed(extension: string): boolean {
  const ext = extension.toLowerCase();
  
  // Block dangerous extensions
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // Check if extension is in whitelist
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Check if MIME type is allowed
 */
export function isMimeTypeAllowed(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase());
}

/**
 * Detect file type from magic bytes (file signature)
 */
export function detectFileType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const signature of signatures) {
      if (buffer.length >= signature.length) {
        let matches = true;
        for (let i = 0; i < signature.length; i++) {
          if (buffer[i] !== signature[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return mimeType;
        }
      }
    }
  }
  
  return null;
}

/**
 * Validate uploaded file
 */
export function validateFile(
  file: File,
  buffer?: Buffer
): FileValidationResult {
  // Check file size (already done in upload route, but double-check)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Datei ist zu groß (max. 100MB)',
    };
  }
  
  // Get file extension
  const extension = getFileExtension(file.name);
  if (!extension) {
    return {
      valid: false,
      error: 'Datei muss eine Dateiendung haben',
    };
  }
  
  // Check if extension is allowed
  if (!isExtensionAllowed(extension)) {
    return {
      valid: false,
      error: `Dateityp .${extension} ist nicht erlaubt`,
    };
  }
  
  // Check MIME type if provided
  if (file.type) {
    if (!isMimeTypeAllowed(file.type)) {
      return {
        valid: false,
        error: `Dateityp ${file.type} ist nicht erlaubt`,
      };
    }
  }
  
  // If buffer is provided, check magic bytes
  if (buffer) {
    const detectedType = detectFileType(buffer);
    if (detectedType) {
      // Verify detected type matches extension or MIME type
      if (file.type && detectedType !== file.type) {
        // MIME type mismatch - potential spoofing
        return {
          valid: false,
          error: 'Dateityp stimmt nicht mit Dateiinhalt überein',
        };
      }
    }
  }
  
  return {
    valid: true,
    detectedMimeType: file.type || undefined,
  };
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators
  let sanitized = filename.replace(/[\/\\]/g, '_');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = getFileExtension(sanitized);
    const nameWithoutExt = sanitized.slice(0, 255 - ext.length - 1);
    sanitized = `${nameWithoutExt}.${ext}`;
  }
  
  return sanitized;
}

