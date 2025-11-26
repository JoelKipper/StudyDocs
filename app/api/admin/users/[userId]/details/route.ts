import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;

    // Get user details
    const { data: userData, error: userError } = await supabaseServer
      .from('users')
      .select('id, email, name, is_admin, is_active, created_at, last_login, last_login_ip')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get files and directories created by user
    const { data: userFiles, error: filesError } = await supabaseServer
      .from('file_metadata')
      .select('id, name, path, type, size, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    const files = userFiles?.filter(f => f.type === 'file') || [];
    const directories = userFiles?.filter(f => f.type === 'directory') || [];
    const totalFilesSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    // Get login history (last 20 logins)
    const { data: loginHistory, error: loginError } = await supabaseServer
      .from('activity_logs')
      .select('id, created_at, ip_address, user_agent')
      .eq('user_id', userId)
      .eq('action', 'login')
      .order('created_at', { ascending: false })
      .limit(20);

    // Get activity summary
    const { data: allActivities, error: activitiesError } = await supabaseServer
      .from('activity_logs')
      .select('action, created_at')
      .eq('user_id', userId);

    // Calculate activity summary
    const activitySummary = {
      total: allActivities?.length || 0,
      last24Hours: allActivities?.filter(a => {
        const activityDate = new Date(a.created_at);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return activityDate >= yesterday;
      }).length || 0,
      last7Days: allActivities?.filter(a => {
        const activityDate = new Date(a.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return activityDate >= weekAgo;
      }).length || 0,
      last30Days: allActivities?.filter(a => {
        const activityDate = new Date(a.created_at);
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        return activityDate >= monthAgo;
      }).length || 0,
      byAction: {} as Record<string, number>,
    };

    // Count activities by action
    allActivities?.forEach(activity => {
      activitySummary.byAction[activity.action] = (activitySummary.byAction[activity.action] || 0) + 1;
    });

    // Get most recent activities (last 10)
    const { data: recentActivities, error: recentError } = await supabaseServer
      .from('activity_logs')
      .select('id, action, resource_type, resource_path, ip_address, created_at, details')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      user: userData,
      files: {
        total: files.length,
        directories: directories.length,
        totalSize: totalFilesSize,
        recent: files.slice(0, 10),
      },
      loginHistory: loginHistory || [],
      activitySummary,
      recentActivities: recentActivities || [],
    });
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    return NextResponse.json({ error: 'Error fetching user details' }, { status: 500 });
  }
}

