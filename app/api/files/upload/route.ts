import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveFile, createDirectory } from '@/lib/filesystem-supabase';

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
    const path = formData.get('path') as string || '';
    
    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }
    
    console.log('Upload request received:', {
      fileName: file.name,
      fileSize: file.size,
      path: path
    });
    
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Check if path already ends with the filename (for folder uploads with relative paths)
    let filePath: string;
    if (path && path.endsWith(`/${file.name}`)) {
      // Path already includes the filename, use it as is
      filePath = path;
    } else if (path) {
      // Path is just the directory, append filename
      filePath = `${path}/${file.name}`;
    } else {
      // No path, use filename only
      filePath = file.name;
    }
    
    // Ensure all parent directories exist before uploading the file
    const parentPath = filePath.includes('/') 
      ? filePath.substring(0, filePath.lastIndexOf('/'))
      : '';
    await ensureDirectoriesExist(parentPath, user);
    
    await saveFile(filePath, buffer, user);
    
    return NextResponse.json({ success: true, fileName: file.name });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Fehler beim Hochladen der Datei' }, { status: 500 });
  }
}

