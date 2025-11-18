import { NextRequest, NextResponse } from 'next/server';
import { loginUser, createToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email und Passwort sind erforderlich' }, { status: 400 });
    }
    
    const user = await loginUser(email, password);
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

