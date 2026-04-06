import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { verifyTotpCode, isTotpEnabled } from '@/lib/totp';
import { shouldUseSecureCookies } from '@/lib/request-security';

type PreAuthClaims = { stage: 'preauth'; userId: string; email?: string };

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (!secret || secret === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET environment variable is required and must be set to a secure value');
  }
  return secret;
}

export async function POST(request: NextRequest) {
  if (!isTotpEnabled()) {
    return NextResponse.json({ error: 'TOTP ist nicht aktiviert' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const code = String(body.code || '');

  const cookieStore = await cookies();
  const preauth = cookieStore.get('preauth-token')?.value;
  if (!preauth) {
    return NextResponse.json({ error: 'Sitzung abgelaufen. Bitte erneut anmelden.' }, { status: 401 });
  }

  let claims: PreAuthClaims | null = null;
  try {
    claims = jwt.verify(preauth, getJwtSecret()) as PreAuthClaims;
  } catch {
    return NextResponse.json({ error: 'Sitzung abgelaufen. Bitte erneut anmelden.' }, { status: 401 });
  }

  if (!claims || claims.stage !== 'preauth' || !claims.userId) {
    return NextResponse.json({ error: 'Sitzung abgelaufen. Bitte erneut anmelden.' }, { status: 401 });
  }

  const ok = verifyTotpCode(code);
  if (!ok) {
    return NextResponse.json({ error: 'Ungültiger Code' }, { status: 401 });
  }

  // Promote to full auth by swapping cookies
  cookieStore.delete('preauth-token');

  const authToken = jwt.sign(
    { userId: claims.userId, email: claims.email, iat: Math.floor(Date.now() / 1000) },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
  cookieStore.set('auth-token', authToken, {
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ success: true });
}

