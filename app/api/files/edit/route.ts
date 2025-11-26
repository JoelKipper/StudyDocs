import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveFile, getFile } from '@/lib/filesystem-supabase';
import { sanitizePath, sanitizeString } from '@/lib/validation';

// Save edited file content
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawPath = body.path;
    const content = body.content;

    if (!rawPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }
    
    // Sanitize path
    const path = sanitizePath(rawPath);
    
    if (!path) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'Inhalt ist erforderlich' }, { status: 400 });
    }
    
    // Validate content type and size
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Inhalt muss ein String sein' }, { status: 400 });
    }
    
    // Limit content size (max 10MB)
    const maxContentSize = 10 * 1024 * 1024; // 10MB
    const contentSize = Buffer.byteLength(content, 'utf-8');
    if (contentSize > maxContentSize) {
      return NextResponse.json({ error: 'Inhalt ist zu groß (max. 10MB)' }, { status: 400 });
    }

    // Sanitize content (remove null bytes and control characters)
    const sanitizedContent = sanitizeString(content, maxContentSize);

    // Convert content to buffer
    const buffer = Buffer.from(sanitizedContent, 'utf-8');

    // Save file
    await saveFile(path, buffer, user);

    return NextResponse.json({ success: true, path });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Speichern der Datei' }, { status: 500 });
  }
}

// Get file content for editing
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path');

    if (!rawPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }
    
    // Sanitize path
    const path = sanitizePath(rawPath);
    
    if (!path) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }

    // Get file content
    const buffer = await getFile(path);
    const content = buffer.toString('utf-8');

    return NextResponse.json({ success: true, content, path });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Laden der Datei' }, { status: 500 });
  }
}

