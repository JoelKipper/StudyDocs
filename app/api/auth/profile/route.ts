import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateUserProfile } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { name, email, currentPassword, newPassword } = await request.json();

    await updateUserProfile(user.id, {
      name,
      email,
      currentPassword,
      newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: error.message || 'Fehler beim Aktualisieren des Profils' },
      { status: 400 }
    );
  }
}

