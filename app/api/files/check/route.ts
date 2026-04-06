import { NextRequest, NextResponse } from 'next/server';
import { getDirectoryContents } from '@/lib/filesystem';
import {
  resolveFileAccess,
  getEffectiveUserId,
  resolveListingPath,
  assertPathInShare,
} from '@/lib/api-file-context';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shareToken = searchParams.get('shareToken');
  const resolved = await resolveFileAccess(shareToken);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }
  const { access } = resolved;

  try {
    const fileName = searchParams.get('fileName');
    let path = searchParams.get('path') || '';
    path = resolveListingPath(access, path);

    if (access.mode === 'share' && !assertPathInShare(access, path)) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
    }

    if (!fileName) {
      return NextResponse.json({ error: 'Dateiname ist erforderlich' }, { status: 400 });
    }

    const userId = getEffectiveUserId(access);
    const contents = await getDirectoryContents(userId, path);
    const exists = contents.some((item) => item.name === fileName && item.type === 'file');

    return NextResponse.json({ exists, fileName });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Prüfen der Datei' }, { status: 500 });
  }
}
