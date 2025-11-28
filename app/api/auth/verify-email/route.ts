import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/email-verification';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 });
    }

    const result = await verifyToken(token);

    if (!result) {
      return NextResponse.json(
        { error: 'Ungültiger oder abgelaufener Token' },
        { status: 400 }
      );
    }

    // Redirect to success page or return success
    return NextResponse.json({ 
      success: true,
      message: 'E-Mail-Adresse wurde erfolgreich verifiziert'
    });
  } catch (error: any) {
    console.error('Error verifying email:', error);
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token fehlt' }, { status: 400 });
    }

    const result = await verifyToken(token);

    if (!result) {
      return NextResponse.json(
        { error: 'Ungültiger oder abgelaufener Token' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'E-Mail-Adresse wurde erfolgreich verifiziert'
    });
  } catch (error: any) {
    console.error('Error verifying email:', error);
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

