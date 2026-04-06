import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isIpBlocked } from '@/lib/auth';
import { findUserById } from '@/lib/local-store';

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return request.ip || 'unknown';
}

export async function GET(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const blocked = await isIpBlocked(ipAddress);

  if (blocked) {
    return NextResponse.json({ error: 'Ihre IP-Adresse wurde gesperrt' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const row = await findUserById(user.id);

  return NextResponse.json({
    user: {
      ...user,
      emailVerified: row?.email_verified || false,
    },
  });
}
