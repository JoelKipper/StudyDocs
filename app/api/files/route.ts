import { NextRequest, NextResponse } from 'next/server';
import {
  getDirectoryContents,
  createDirectory,
  deleteItem,
  renameItem,
  moveItem,
  copyItem,
} from '@/lib/filesystem';
import { getItemPasswordInfo } from '@/lib/filesystem';
import { verifyFilePassword } from '@/lib/encryption';
import { sanitizePath, sanitizeString } from '@/lib/validation';
import {
  resolveFileAccess,
  getEffectiveUserId,
  resolveListingPath,
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

  let dirPath = sanitizePath(searchParams.get('path') || '');
  dirPath = resolveListingPath(access, dirPath);
  const password = searchParams.get('password');

  if (access.mode === 'share' && !assertPathInShare(access, dirPath)) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
  }

  const userId = getEffectiveUserId(access);

  try {
    if (dirPath) {
      const info = await getItemPasswordInfo(userId, dirPath);
      if (info?.passwordHash) {
        if (!password) {
          return NextResponse.json(
            { error: 'Passwort ist erforderlich', requiresPassword: true },
            { status: 401 }
          );
        }
        const isValid = await verifyFilePassword(password, info.passwordHash);
        if (!isValid) {
          return NextResponse.json(
            { error: 'Falsches Passwort', requiresPassword: true },
            { status: 401 }
          );
        }
      }
    }

    const contents = await getDirectoryContents(userId, dirPath);
    return NextResponse.json({ contents });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden des Verzeichnisses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const shareToken = typeof body.shareToken === 'string' ? body.shareToken : null;
  const resolved = await resolveFileAccess(shareToken);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }
  const { access } = resolved;

  if (access.mode === 'share') {
    return NextResponse.json({ error: 'Nur Lesezugriff' }, { status: 403 });
  }

  const { getCurrentUser } = await import('@/lib/auth');
  const fullUser = await getCurrentUser();
  if (!fullUser) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  const userWithNames = { id: fullUser.id, name: fullUser.name, email: fullUser.email };

  try {
    const { action, path, name, newName, targetPath } = body;

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
      await createDirectory(access.userId, dirPath, userWithNames);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
      }
      await deleteItem(access.userId, sanitizedPath);
      return NextResponse.json({ success: true });
    }

    if (action === 'rename') {
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
      }
      if (!sanitizedNewName || !sanitizedNewName.trim()) {
        return NextResponse.json({ error: 'Neuer Name ist erforderlich' }, { status: 400 });
      }
      await renameItem(access.userId, sanitizedPath, sanitizedNewName.trim(), userWithNames);
      return NextResponse.json({ success: true });
    }

    if (action === 'move') {
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
      }
      if (sanitizedTargetPath === undefined) {
        return NextResponse.json({ error: 'Zielverzeichnis ist erforderlich' }, { status: 400 });
      }
      await moveItem(access.userId, sanitizedPath, sanitizedTargetPath, userWithNames);
      return NextResponse.json({ success: true });
    }

    if (action === 'copy') {
      if (!sanitizedPath) {
        return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
      }
      if (sanitizedTargetPath === undefined) {
        return NextResponse.json({ error: 'Zielverzeichnis ist erforderlich' }, { status: 400 });
      }
      await copyItem(access.userId, sanitizedPath, sanitizedTargetPath, userWithNames);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}
