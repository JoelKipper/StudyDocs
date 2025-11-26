import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { hashFilePassword, verifyFilePassword, encryptFile, decryptFile } from '@/lib/encryption';
import { getFile, saveFile } from '@/lib/filesystem-supabase';
import { sanitizePath } from '@/lib/validation';

// Set password protection for a file or directory
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawPath = body.path;
    const password = body.password;
    const action = body.action;

    if (!rawPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }
    
    // Sanitize path
    const path = sanitizePath(rawPath);
    
    if (!path) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }

    if (action === 'set') {
      if (!password || password.length < 4) {
        return NextResponse.json({ error: 'Passwort muss mindestens 4 Zeichen lang sein' }, { status: 400 });
      }

      // Hash the password
      const passwordHash = await hashFilePassword(password);

      // Update file_metadata to set password_hash
      const { error: updateError } = await supabaseServer
        .from('file_metadata')
        .update({ password_hash: passwordHash })
        .eq('path', path);

      if (updateError) {
        return NextResponse.json({ error: 'Fehler beim Setzen des Passworts' }, { status: 500 });
      }

      // If it's a file, encrypt the file content
      const { data: fileMetadata } = await supabaseServer
        .from('file_metadata')
        .select('type')
        .eq('path', path)
        .single();

      if (fileMetadata?.type === 'file') {
        try {
          const fileBuffer = await getFile(path);
          const { encryptedBuffer } = encryptFile(fileBuffer, password);
          await saveFile(path, encryptedBuffer, user);
        } catch (error) {
          // If file doesn't exist or can't be encrypted, continue anyway
          // The password protection is still set in metadata
        }
      }

      return NextResponse.json({ success: true });
    } else if (action === 'remove') {
      // Get current password hash and owner
      const { data: fileMetadata, error: fetchError } = await supabaseServer
        .from('file_metadata')
        .select('password_hash, type, created_by')
        .eq('path', path)
        .single();

      if (fetchError || !fileMetadata) {
        return NextResponse.json({ error: 'Datei oder Ordner nicht gefunden' }, { status: 404 });
      }

      if (!fileMetadata.password_hash) {
        return NextResponse.json({ error: 'Datei oder Ordner ist nicht passwortgeschützt' }, { status: 400 });
      }

      // Check if user is the owner - if yes, no password needed
      const isOwner = fileMetadata.created_by === user.id;
      
      // If not owner, require password verification
      if (!isOwner) {
        if (!password) {
          return NextResponse.json({ error: 'Passwort ist erforderlich' }, { status: 400 });
        }
        
        // Verify password
        const isValid = await verifyFilePassword(password, fileMetadata.password_hash);
        if (!isValid) {
          return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
        }
      }

      // If it's a file, decrypt the file content
      if (fileMetadata.type === 'file') {
        try {
          const encryptedBuffer = await getFile(path);
          const decryptedBuffer = decryptFile(encryptedBuffer, password);
          await saveFile(path, decryptedBuffer, user);
        } catch (error) {
          // If decryption fails, continue anyway to remove password protection
        }
      }

      // Remove password protection
      const { error: updateError } = await supabaseServer
        .from('file_metadata')
        .update({ password_hash: null })
        .eq('path', path);

      if (updateError) {
        return NextResponse.json({ error: 'Fehler beim Entfernen des Passworts' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else if (action === 'verify') {
      if (!password) {
        return NextResponse.json({ error: 'Passwort ist erforderlich' }, { status: 400 });
      }

      // Get password hash
      const { data: fileMetadata, error: fetchError } = await supabaseServer
        .from('file_metadata')
        .select('password_hash')
        .eq('path', path)
        .single();

      if (fetchError || !fileMetadata) {
        return NextResponse.json({ error: 'Datei oder Ordner nicht gefunden' }, { status: 404 });
      }

      if (!fileMetadata.password_hash) {
        return NextResponse.json({ error: 'Datei oder Ordner ist nicht passwortgeschützt' }, { status: 400 });
      }

      // Verify password
      const isValid = await verifyFilePassword(password, fileMetadata.password_hash);
      if (!isValid) {
        return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
      }

      return NextResponse.json({ success: true, verified: true });
    }

    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server-Fehler' }, { status: 500 });
  }
}

// Get decrypted file content (requires password)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const rawPath = searchParams.get('path');
    
    if (!rawPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }
    
    // Sanitize path
    const path = sanitizePath(rawPath);
    
    if (!path) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }
    
    const password = searchParams.get('password');

    if (!path) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Passwort ist erforderlich' }, { status: 400 });
    }

    // Verify password
    const { data: fileMetadata, error: fetchError } = await supabaseServer
      .from('file_metadata')
      .select('password_hash, type')
      .eq('path', path)
      .single();

    if (fetchError || !fileMetadata) {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
    }

    if (!fileMetadata.password_hash) {
      return NextResponse.json({ error: 'Datei ist nicht passwortgeschützt' }, { status: 400 });
    }

    const isValid = await verifyFilePassword(password, fileMetadata.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
    }

    // Get and decrypt file
    if (fileMetadata.type === 'file') {
      try {
        const encryptedBuffer = await getFile(path);
        const decryptedBuffer = decryptFile(encryptedBuffer, password);
        // Convert Buffer to Uint8Array for NextResponse
        const uint8Array = new Uint8Array(decryptedBuffer);
        return new NextResponse(uint8Array, {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        });
      } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Fehler beim Entschlüsseln' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Nur Dateien können entschlüsselt werden' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server-Fehler' }, { status: 500 });
  }
}

