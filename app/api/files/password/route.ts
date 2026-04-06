import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hashFilePassword, verifyFilePassword, encryptFile, decryptFile } from '@/lib/encryption';
import { getFile, saveFile, getItemPasswordInfo, setItemPasswordHash } from '@/lib/filesystem';
import { sanitizePath } from '@/lib/validation';
import { validateShareToken, isPathInShareScope } from '@/lib/file-access';

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
    const shareToken = typeof body.shareToken === 'string' ? body.shareToken : undefined;

    if (!rawPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    const itemPath = sanitizePath(rawPath);

    if (!itemPath) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }

    let fsUserId = user.id;
    if (shareToken) {
      const v = await validateShareToken(shareToken);
      if (!v) {
        return NextResponse.json({ error: 'Ungültiger Share-Link' }, { status: 403 });
      }
      if (!isPathInShareScope(v.itemPath, v.itemType, itemPath)) {
        return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }
      fsUserId = v.ownerUserId;
    }

    const userPayload = { id: user.id, name: user.name, email: user.email };

    if (action === 'set' || action === 'remove') {
      if (shareToken) {
        return NextResponse.json({ error: 'Nur Lesezugriff' }, { status: 403 });
      }
    }

    if (action === 'set') {
      if (!password || password.length < 4) {
        return NextResponse.json({ error: 'Passwort muss mindestens 4 Zeichen lang sein' }, { status: 400 });
      }

      const passwordHash = await hashFilePassword(password);
      await setItemPasswordHash(user.id, itemPath, passwordHash, userPayload);

      const info = await getItemPasswordInfo(user.id, itemPath);
      if (info?.type === 'file') {
        try {
          const fileBuffer = await getFile(user.id, itemPath);
          const { encryptedBuffer } = encryptFile(fileBuffer, password);
          await saveFile(user.id, itemPath, encryptedBuffer, userPayload);
        } catch {
          // metadata still set
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'remove') {
      const meta = await getItemPasswordInfo(user.id, itemPath);
      if (!meta?.passwordHash) {
        return NextResponse.json({ error: 'Datei oder Ordner ist nicht passwortgeschützt' }, { status: 400 });
      }

      const isOwner = meta.createdBy?.id === user.id;
      if (!isOwner) {
        if (!password) {
          return NextResponse.json({ error: 'Passwort ist erforderlich' }, { status: 400 });
        }
        const isValid = await verifyFilePassword(password, meta.passwordHash);
        if (!isValid) {
          return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
        }
      }

      if (meta.type === 'file') {
        try {
          const encryptedBuffer = await getFile(user.id, itemPath);
          const decryptedBuffer = decryptFile(encryptedBuffer, password || '');
          await saveFile(user.id, itemPath, decryptedBuffer, userPayload);
        } catch {
          // continue
        }
      }

      await setItemPasswordHash(user.id, itemPath, null, userPayload);

      return NextResponse.json({ success: true });
    }

    if (action === 'verify') {
      if (!password) {
        return NextResponse.json({ error: 'Passwort ist erforderlich' }, { status: 400 });
      }

      const meta = await getItemPasswordInfo(fsUserId, itemPath);
      if (!meta?.passwordHash) {
        return NextResponse.json({ error: 'Datei oder Ordner ist nicht passwortgeschützt' }, { status: 400 });
      }

      const isValid = await verifyFilePassword(password, meta.passwordHash);
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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const rawPath = searchParams.get('path');
    const shareToken = searchParams.get('shareToken');

    if (!rawPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    const itemPath = sanitizePath(rawPath);

    if (!itemPath) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }

    const password = searchParams.get('password');

    if (!password) {
      return NextResponse.json({ error: 'Passwort ist erforderlich' }, { status: 400 });
    }

    let fsUserId = user.id;
    if (shareToken) {
      const v = await validateShareToken(shareToken);
      if (!v) {
        return NextResponse.json({ error: 'Ungültiger Share-Link' }, { status: 403 });
      }
      if (!isPathInShareScope(v.itemPath, v.itemType, itemPath)) {
        return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 });
      }
      fsUserId = v.ownerUserId;
    }

    const meta = await getItemPasswordInfo(fsUserId, itemPath);
    if (!meta) {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
    }

    if (!meta.passwordHash) {
      return NextResponse.json({ error: 'Datei ist nicht passwortgeschützt' }, { status: 400 });
    }

    const isValid = await verifyFilePassword(password, meta.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
    }

    if (meta.type === 'file') {
      try {
        const encryptedBuffer = await getFile(fsUserId, itemPath);
        const decryptedBuffer = decryptFile(encryptedBuffer, password);
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
