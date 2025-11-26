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

    // Get user statistics
    const { count: userCount } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: activeUserCount } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: adminCount } = await supabaseServer
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', true);

    // Get file statistics
    const { count: fileCount } = await supabaseServer
      .from('file_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'file');

    const { count: directoryCount } = await supabaseServer
      .from('file_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'directory');

    // Get total storage size
    const { data: files } = await supabaseServer
      .from('file_metadata')
      .select('size')
      .eq('type', 'file');

    const totalStorage = files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;

    // Get recent activity count (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { count: recentActivityCount } = await supabaseServer
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    // Get blocked IPs count
    const { count: blockedIpCount } = await supabaseServer
      .from('blocked_ips')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    return NextResponse.json({
      users: {
        total: userCount || 0,
        active: activeUserCount || 0,
        admins: adminCount || 0,
      },
      files: {
        total: fileCount || 0,
        directories: directoryCount || 0,
        totalStorage,
      },
      activity: {
        last24Hours: recentActivityCount || 0,
      },
      security: {
        blockedIps: blockedIpCount || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Error fetching statistics' }, { status: 500 });
  }
}


