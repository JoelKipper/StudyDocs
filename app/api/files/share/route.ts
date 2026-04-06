import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';
import { insertShare, findShareByToken, deleteShareByToken } from '@/lib/local-store';
import { getItemPasswordInfo } from '@/lib/filesystem';
import { sanitizePath } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawItemPath = body.path;

    if (!rawItemPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    const itemPath = sanitizePath(rawItemPath);

    if (!itemPath) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
    }

    const info = await getItemPasswordInfo(user.id, itemPath);
    if (!info) {
      return NextResponse.json({ error: 'Datei oder Ordner nicht gefunden' }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString('hex');

    await insertShare({
      token,
      user_id: user.id,
      item_path: itemPath,
      item_type: info.type,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('Error creating share link:', error);
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawToken = searchParams.get('token');

  if (!rawToken) {
    return NextResponse.json({ error: 'Token ist erforderlich' }, { status: 400 });
  }

  if (!/^[a-f0-9]+$/i.test(rawToken) || rawToken.length !== 64) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 });
  }

  const token = rawToken;

  try {
    const shareData = await findShareByToken(token);

    if (!shareData) {
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 404 });
    }

    const createdAt = new Date(shareData.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (createdAt < thirtyDaysAgo) {
      await deleteShareByToken(token);
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 404 });
    }

    const pwdInfo = await getItemPasswordInfo(shareData.user_id, shareData.item_path);
    const isPasswordProtected = !!pwdInfo?.passwordHash;

    const nameFromPath = shareData.item_path.split('/').pop() || '';

    return NextResponse.json({
      userId: shareData.user_id,
      itemPath: shareData.item_path,
      itemType: shareData.item_type,
      itemName: nameFromPath,
      isPasswordProtected,
    });
  } catch (error: any) {
    console.error('Error getting share:', error);
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}
