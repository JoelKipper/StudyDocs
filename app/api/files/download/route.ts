import { NextRequest, NextResponse } from 'next/server';
import { getFile } from '@/lib/filesystem';
import { sanitizePath } from '@/lib/validation';
import {
  resolveFileAccess,
  getEffectiveUserId,
  assertPathInShare,
} from '@/lib/api-file-context';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shareToken = searchParams.get('shareToken');
  const resolved = await resolveFileAccess(shareToken);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }
  const { access } = resolved;

  const rawFilePath = searchParams.get('path');

  if (!rawFilePath) {
    return NextResponse.json({ error: 'Dateipfad erforderlich' }, { status: 400 });
  }

  const filePath = sanitizePath(rawFilePath);

  if (!filePath) {
    return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
  }

  if (access.mode === 'share' && !assertPathInShare(access, filePath)) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
  }

  const userId = getEffectiveUserId(access);

  try {
    const buffer = await getFile(userId, filePath);
    const fileName = filePath.split('/').pop() || 'download';

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Datei' }, { status: 500 });
  }
}
