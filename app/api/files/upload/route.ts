import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveFile, createDirectory } from '@/lib/filesystem-supabase';
import { sanitizePath, sanitizeString } from '@/lib/validation';
import { validateFile, sanitizeFilename } from '@/lib/file-validation';

// Helper function to ensure all directories in a path exist
async function ensureDirectoriesExist(dirPath: string, user: { id: string; name: string; email: string }): Promise<void> {
  if (!dirPath) return;
  
  const parts = dirPath.split('/').filter(Boolean);
  let currentPath = '';
  
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    
    try {
      // Try to create directory (will fail silently if it already exists)
      await createDirectory(currentPath, user);
    } catch (error: any) {
      // Ignore "already exists" errors
      if (!error.message?.includes('existiert bereits')) {
        // For other errors, log but continue (directory might already exist)
        console.warn(`Could not create directory ${currentPath}:`, error.message);
      }
    }
  }
}

// Configure for larger uploads
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawPath = formData.get('path') as string || '';
    
    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }
    
    // Validate file size (max 100MB)
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: 'Datei ist zu groß (max. 100MB)' }, { status: 400 });
    }
    
    // Get file buffer for validation
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Validate file type, extension, and content
    const fileValidation = validateFile(file, buffer);
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }
    
    // Sanitize inputs
    const path = sanitizePath(rawPath);
    const rawFileName = file.name;
    const sanitizedFileName = sanitizeFilename(rawFileName);
    const fileName = sanitizeString(sanitizedFileName, 255);
    
    if (!fileName) {
      return NextResponse.json({ error: 'Ungültiger Dateiname' }, { status: 400 });
    }
    
    // Log upload (without sensitive data)
    console.log('Upload request received:', {
      fileName: fileName,
      fileSize: file.size,
      mimeType: file.type,
      path: path
    });
    
    // Check if path already ends with the filename (for folder uploads with relative paths)
    let filePath: string;
    const pathEndsWithFilename = path && (path.endsWith(`/${fileName}`) || path === fileName);
    
    if (pathEndsWithFilename) {
      // Path already includes the filename, use it as is
      filePath = path;
    } else if (path) {
      // Path is just the directory, append filename
      filePath = `${path}/${fileName}`;
    } else {
      // No path, use filename only
      filePath = fileName;
    }
    
    // Sanitize final file path
    filePath = sanitizePath(filePath);
    
    console.log('Final filePath:', filePath);
    
    // Ensure all parent directories exist before uploading the file
    const parentPath = filePath.includes('/') 
      ? filePath.substring(0, filePath.lastIndexOf('/'))
      : '';
    
    if (parentPath) {
      await ensureDirectoriesExist(parentPath, user);
    }
    
    await saveFile(filePath, buffer, user);
    console.log('File saved successfully:', filePath);
    
    return NextResponse.json({ success: true, fileName: file.name, filePath: filePath });
  } catch (error: any) {
    // Don't expose error details in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Fehler beim Hochladen der Datei' 
      : (error.message || 'Fehler beim Hochladen der Datei');
    console.error('Upload error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

