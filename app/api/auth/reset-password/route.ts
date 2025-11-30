import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/password-reset';
import { sanitizeString } from '@/lib/validation';

/**
 * Reset password using token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = sanitizeString(body.token, 64);
    const password = body.password;

    if (!token) {
      return NextResponse.json(
        { error: 'Token ist erforderlich' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Passwort ist erforderlich' },
        { status: 400 }
      );
    }

    // Reset password
    const result = await resetPasswordWithToken(token, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Fehler beim Zurücksetzen des Passworts' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Passwort wurde erfolgreich zurückgesetzt'
    });
  } catch (error: any) {
    console.error('Error in reset-password:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

