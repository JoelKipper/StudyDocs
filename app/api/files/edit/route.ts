import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveFile, getFile } from '@/lib/filesystem-supabase';

// Save edited file content
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { path, content } = await request.json();

    if (!path) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    if (content === undefined) {
      return NextResponse.json({ error: 'Inhalt ist erforderlich' }, { status: 400 });
    }

    // Convert content to buffer
    const buffer = Buffer.from(content, 'utf-8');

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
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    // Get file content
    const buffer = await getFile(path);
    const content = buffer.toString('utf-8');

    return NextResponse.json({ success: true, content, path });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Laden der Datei' }, { status: 500 });
  }
}

