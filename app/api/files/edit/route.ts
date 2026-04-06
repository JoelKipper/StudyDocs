import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveFile, getFile } from '@/lib/filesystem';
import { sanitizePath, sanitizeString } from '@/lib/validation';

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

    const filePath = sanitizePath(rawPath);

    if (!filePath) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'Inhalt ist erforderlich' }, { status: 400 });
    }

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Inhalt muss ein String sein' }, { status: 400 });
    }

    const maxContentSize = 10 * 1024 * 1024;
    const contentSize = Buffer.byteLength(content, 'utf-8');
    if (contentSize > maxContentSize) {
      return NextResponse.json({ error: 'Inhalt ist zu groß (max. 10MB)' }, { status: 400 });
    }

    const sanitizedContent = sanitizeString(content, maxContentSize);
    const buffer = Buffer.from(sanitizedContent, 'utf-8');

    const userPayload = { id: user.id, name: user.name, email: user.email };
    await saveFile(user.id, filePath, buffer, userPayload);

    return NextResponse.json({ success: true, path: filePath });
  } catch (error: any) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Fehler beim Speichern der Datei'
        : error.message || 'Fehler beim Speichern der Datei';
    console.error('Error saving file:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

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

    const filePath = sanitizePath(rawPath);

    if (!filePath) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }

    const buffer = await getFile(user.id, filePath);
    const content = buffer.toString('utf-8');

    return NextResponse.json({ success: true, content, path: filePath });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Laden der Datei' }, { status: 500 });
  }
}
