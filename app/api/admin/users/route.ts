import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  listUsers,
  userToPublic,
  updateUser,
  deleteUserById,
  findUserById,
  insertActivityLog,
  deleteActivityLogsByUserId,
  deleteSharesByUserId,
} from '@/lib/local-store';
import { ACCOUNTS_DIR } from '@/lib/data-dir';

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

    const users = (await listUsers()).map(userToPublic);
    users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
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

    const { userId, updates } = await request.json();

    if (!userId || !updates) {
      return NextResponse.json({ error: 'Missing userId or updates' }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot update your own account' }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    if (typeof updates.is_admin === 'boolean') allowed.is_admin = updates.is_admin;
    if (typeof updates.is_active === 'boolean') allowed.is_active = updates.is_active;
    if (typeof updates.name === 'string') allowed.name = updates.name;
    if (typeof updates.email === 'string') allowed.email = updates.email.trim().toLowerCase();

    const updated = await updateUser(userId, allowed as any);
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await insertActivityLog({
      user_id: user.id,
      action: 'admin_update_user',
      resource_type: 'user',
      details: { target_user_id: userId, updates },
    });

    return NextResponse.json({ user: userToPublic(updated) });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error updating user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const permanent = searchParams.get('permanent') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const targetUser = await findUserById(userId);

    if (permanent) {
      const userDir = path.join(ACCOUNTS_DIR, userId);
      try {
        await fs.rm(userDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Error removing user files:', e);
      }

      await deleteActivityLogsByUserId(userId);
      await deleteSharesByUserId(userId);

      const ok = await deleteUserById(userId);
      if (!ok) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      await insertActivityLog({
        user_id: user.id,
        action: 'admin_permanently_delete_user',
        resource_type: 'user',
        details: {
          target_user_id: userId,
          target_user_email: targetUser?.email,
          target_user_name: targetUser?.name,
        },
      });

      return NextResponse.json({ success: true, permanent: true });
    }

    const updated = await updateUser(userId, { is_active: false });
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await insertActivityLog({
      user_id: user.id,
      action: 'admin_deactivate_user',
      resource_type: 'user',
      details: {
        target_user_id: userId,
        target_user_email: targetUser?.email,
        target_user_name: targetUser?.name,
      },
    });

    return NextResponse.json({ success: true, permanent: false });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error deleting user' }, { status: 500 });
  }
}
