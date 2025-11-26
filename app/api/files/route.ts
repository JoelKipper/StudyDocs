import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDirectoryContents, createDirectory, deleteItem, renameItem, moveItem, copyItem } from '@/lib/filesystem-supabase';
import { supabaseServer } from '@/lib/supabase-server';
import { verifyFilePassword } from '@/lib/encryption';
import { sanitizePath, sanitizeString } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const dirPath = sanitizePath(searchParams.get('path') || '');
  const password = searchParams.get('password');
  
  try {
    // Check if the directory itself is password protected
    if (dirPath) {
      const { data: dirMetadata, error: fetchError } = await supabaseServer
        .from('file_metadata')
        .select('password_hash, type')
        .eq('path', dirPath)
        .single();

      if (!fetchError && dirMetadata && dirMetadata.password_hash) {
        // Directory is password protected
        if (!password) {
          return NextResponse.json({ 
            error: 'Passwort ist erforderlich', 
            requiresPassword: true 
          }, { status: 401 });
        }

        // Verify password
        const isValid = await verifyFilePassword(password, dirMetadata.password_hash);
        if (!isValid) {
          return NextResponse.json({ 
            error: 'Falsches Passwort', 
            requiresPassword: true 
          }, { status: 401 });
        }
      }
    }
    
    const contents = await getDirectoryContents(dirPath);
    return NextResponse.json({ contents });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden des Verzeichnisses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  try {
    const { action, path, name, newName, targetPath } = await request.json();
    
    // Validate and sanitize inputs
    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
    }
    
    const sanitizedPath = path ? sanitizePath(path) : '';
    const sanitizedName = name ? sanitizeString(name, 255) : '';
    const sanitizedNewName = newName ? sanitizeString(newName, 255) : '';
    const sanitizedTargetPath = targetPath !== undefined ? sanitizePath(targetPath) : '';
    
    if (action === 'create-directory') {
      if (!sanitizedName) {
        return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
      }
      const dirPath = sanitizedPath ? `${sanitizedPath}/${sanitizedName}` : sanitizedName;
      await createDirectory(dirPath, user);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'delete') {
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
      }
      await deleteItem(sanitizedPath);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'rename') {
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
      }
      if (!sanitizedNewName || !sanitizedNewName.trim()) {
        return NextResponse.json({ error: 'Neuer Name ist erforderlich' }, { status: 400 });
      }
      await renameItem(sanitizedPath, sanitizedNewName.trim(), user);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'move') {
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
      }
      if (sanitizedTargetPath === undefined) {
        return NextResponse.json({ error: 'Zielverzeichnis ist erforderlich' }, { status: 400 });
      }
      await moveItem(sanitizedPath, sanitizedTargetPath);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'copy') {
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
      }
      if (sanitizedTargetPath === undefined) {
        return NextResponse.json({ error: 'Zielverzeichnis ist erforderlich' }, { status: 400 });
      }
      await copyItem(sanitizedPath, sanitizedTargetPath, user);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}

