import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

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

    const { data: users, error } = await supabaseServer
      .from('users')
      .select('id, email, name, is_admin, is_active, created_at, last_login, last_login_ip')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ users: users || [] });
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

    // Don't allow updating yourself
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot update your own account' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, name, is_admin, is_active')
      .single();

    if (error) {
      throw error;
    }

    // Log activity
    await supabaseServer
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: 'admin_update_user',
        resource_type: 'user',
        details: { target_user_id: userId, updates }
      });

    return NextResponse.json({ user: data });
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

    // Don't allow deleting yourself
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Get user info before deletion for logging
    const { data: targetUser } = await supabaseServer
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (permanent) {
      console.log('[Admin API] Starting permanent deletion of user:', userId);
      
      // Permanently delete user
      // First, delete all files and directories created by the user
      // Get all items created by the user

      const STORAGE_BUCKET = 'files';

      // Recursively delete all items created by the user
      async function deleteUserItem(itemPath: string) {
        try {
          // Get item details
          const { data: item } = await supabaseServer
            .from('file_metadata')
            .select('type, storage_path, path, created_by')
            .eq('path', itemPath)
            .single();

          if (!item) return;

          // Only delete if created by this user
          if (item.created_by !== userId) return;

          if (item.type === 'directory') {
            // Get all children (regardless of who created them)
            const { data: children } = await supabaseServer
              .from('file_metadata')
              .select('path, type, created_by')
              .eq('parent_path', itemPath);

            // Recursively delete children that were created by this user
            if (children) {
              for (const child of children) {
                if (child.created_by === userId) {
                  await deleteUserItem(child.path);
                }
              }
            }
          } else if (item.type === 'file' && item.storage_path) {
            // Delete file from storage
            const { error: storageError } = await supabaseServer.storage
              .from(STORAGE_BUCKET)
              .remove([item.storage_path]);

            if (storageError) {
              console.error(`Error deleting file from storage: ${item.storage_path}`, storageError);
              // Continue even if storage deletion fails
            }
          }

          // Delete metadata
          await supabaseServer
            .from('file_metadata')
            .delete()
            .eq('path', itemPath);
        } catch (err) {
          console.error(`Error deleting item: ${itemPath}`, err);
          // Continue with other items
        }
      }

      // Get all items created by the user (starting from root level)
      const { data: allUserItems } = await supabaseServer
        .from('file_metadata')
        .select('path, type')
        .eq('created_by', userId)
        .order('path', { ascending: true });

      if (allUserItems && allUserItems.length > 0) {
        // Delete items starting from deepest level (reverse order)
        // This ensures we delete children before parents
        for (let i = allUserItems.length - 1; i >= 0; i--) {
          await deleteUserItem(allUserItems[i].path);
        }
      }

      // Delete activity logs
      await supabaseServer
        .from('activity_logs')
        .delete()
        .eq('user_id', userId);

      // Delete shares
      await supabaseServer
        .from('shares')
        .delete()
        .eq('user_id', userId);

      // Delete file metadata where user was last modifier (cleanup orphaned references)
      await supabaseServer
        .from('file_metadata')
        .update({ last_modified_by: null })
        .eq('last_modified_by', userId);

      await supabaseServer
        .from('file_metadata')
        .update({ renamed_by: null })
        .eq('renamed_by', userId);

      // Finally, delete the user
      console.log('[Admin API] Deleting user from database:', userId);
      const { error } = await supabaseServer
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('[Admin API] Error deleting user:', error);
        throw error;
      }
      
      console.log('[Admin API] User deleted successfully');

      // Log activity
      await supabaseServer
        .from('activity_logs')
        .insert({
          user_id: user.id,
          action: 'admin_permanently_delete_user',
          resource_type: 'user',
          details: { 
            target_user_id: userId,
            target_user_email: targetUser?.email,
            target_user_name: targetUser?.name
          }
        });

      return NextResponse.json({ success: true, permanent: true });
    } else {
      // Deactivate user instead of deleting
      const { error } = await supabaseServer
        .from('users')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      // Log activity
      await supabaseServer
        .from('activity_logs')
        .insert({
          user_id: user.id,
          action: 'admin_deactivate_user',
          resource_type: 'user',
          details: { 
            target_user_id: userId,
            target_user_email: targetUser?.email,
            target_user_name: targetUser?.name
          }
        });

      return NextResponse.json({ success: true, permanent: false });
    }
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error deleting user' }, { status: 500 });
  }
}


