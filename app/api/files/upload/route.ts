import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveFile, createDirectory } from '@/lib/filesystem';
import { sanitizePath, sanitizeString } from '@/lib/validation';
import { validateFile, sanitizeFilename } from '@/lib/file-validation';

async function ensureDirectoriesExist(
  userId: string,
  dirPath: string,
  user: { id: string; name: string; email: string }
): Promise<void> {
  if (!dirPath) return;

  const parts = dirPath.split('/').filter(Boolean);
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    try {
      await createDirectory(userId, currentPath, user);
    } catch (error: any) {
      if (!error.message?.includes('existiert bereits')) {
        console.warn(`Could not create directory ${currentPath}:`, error.message);
      }
    }
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const shareToken = formData.get('shareToken');
    if (shareToken) {
      return NextResponse.json({ error: 'Nur Lesezugriff' }, { status: 403 });
    }

    const file = formData.get('file') as File;
    const rawPath = (formData.get('path') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    const maxFileSize = 100 * 1024 * 1024;
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: 'Datei ist zu groß (max. 100MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const fileValidation = validateFile(file, buffer);
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    const path = sanitizePath(rawPath);
    const rawFileName = file.name;
    const sanitizedFileName = sanitizeFilename(rawFileName);
    const fileName = sanitizeString(sanitizedFileName, 255);

    if (!fileName) {
      return NextResponse.json({ error: 'Ungültiger Dateiname' }, { status: 400 });
    }

    let filePath: string;
    const pathEndsWithFilename = path && (path.endsWith(`/${fileName}`) || path === fileName);

    if (pathEndsWithFilename) {
      filePath = path;
    } else if (path) {
      filePath = `${path}/${fileName}`;
    } else {
      filePath = fileName;
    }

    filePath = sanitizePath(filePath);

    const parentPath = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';

    if (parentPath) {
      await ensureDirectoriesExist(user.id, parentPath, user);
    }

    const userPayload = { id: user.id, name: user.name, email: user.email };
    await saveFile(user.id, filePath, buffer, userPayload);

    return NextResponse.json({ success: true, fileName: file.name, filePath: filePath });
  } catch (error: any) {
    const errorMessage =
      process.env.NODE_ENV === 'production'
        ? 'Fehler beim Hochladen der Datei'
        : error.message || 'Fehler beim Hochladen der Datei';
    console.error('Upload error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
