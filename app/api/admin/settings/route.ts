import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getAllSystemSettings, setSystemSetting } from '@/lib/system-settings';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await getAllSystemSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Error fetching system settings:', error);
    return NextResponse.json({ error: 'Error fetching system settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    await setSystemSetting(key, String(value), user.id);

    // Log activity
    const { supabaseServer } = await import('@/lib/supabase-server');
    await supabaseServer
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: 'admin_update_setting',
        resource_type: 'system_setting',
        details: { key, value }
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating system setting:', error);
    return NextResponse.json({ error: 'Error updating system setting' }, { status: 500 });
  }
}

