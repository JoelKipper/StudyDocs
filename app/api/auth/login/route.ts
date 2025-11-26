import { NextRequest, NextResponse } from 'next/server';
import { loginUser, createToken, isIpBlocked } from '@/lib/auth';
import { getSystemSettingBoolean } from '@/lib/system-settings';
import { cookies } from 'next/headers';

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

export async function POST(request: NextRequest) {
  try {
    // Check if login is enabled
    const allowLogin = await getSystemSettingBoolean('allow_login', true);
    if (!allowLogin) {
      return NextResponse.json({ error: 'Login ist derzeit deaktiviert' }, { status: 403 });
    }

    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email und Passwort sind erforderlich' }, { status: 400 });
    }
    
    // Check if IP is blocked
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    const blocked = await isIpBlocked(ipAddress);
    
    if (blocked) {
      return NextResponse.json({ error: 'Ihre IP-Adresse wurde gesperrt' }, { status: 403 });
    }
    
    const user = await loginUser(email, password, ipAddress, userAgent);
    if (!user) {
      return NextResponse.json({ error: 'Ungültige Anmeldedaten' }, { status: 401 });
    }
    
    const token = await createToken(user);
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 Tage
    });
    
    return NextResponse.json({ user, success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

