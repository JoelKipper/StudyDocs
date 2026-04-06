import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { findUserById, userToPublic, listAllActivityLogsForUser } from '@/lib/local-store';
import { countUserFilesAndBytes } from '@/lib/fs-stats';

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

    const userData = await findUserById(userId);
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const disk = await countUserFilesAndBytes(userId);

    const allActivities = await listAllActivityLogsForUser(userId);

    const activitySummary = {
      total: allActivities.length,
      last24Hours: allActivities.filter((a) => {
        const activityDate = new Date(a.created_at);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return activityDate >= yesterday;
      }).length,
      last7Days: allActivities.filter((a) => {
        const activityDate = new Date(a.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return activityDate >= weekAgo;
      }).length,
      last30Days: allActivities.filter((a) => {
        const activityDate = new Date(a.created_at);
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        return activityDate >= monthAgo;
      }).length,
      byAction: {} as Record<string, number>,
    };

    allActivities.forEach((activity) => {
      activitySummary.byAction[activity.action] = (activitySummary.byAction[activity.action] || 0) + 1;
    });

    const loginHistory = allActivities
      .filter((a) => a.action === 'login')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
      .map((a) => ({
        id: a.id,
        created_at: a.created_at,
        ip_address: a.ip_address,
        user_agent: a.user_agent,
      }));

    const recentActivities = [...allActivities]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        action: a.action,
        resource_type: a.resource_type,
        resource_path: a.resource_path,
        ip_address: a.ip_address,
        created_at: a.created_at,
        details: a.details,
      }));

    return NextResponse.json({
      user: userToPublic(userData),
      files: {
        total: disk.fileCount,
        directories: disk.directoryCount,
        totalSize: disk.totalBytes,
        recent: [],
      },
      loginHistory,
      activitySummary,
      recentActivities,
    });
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    return NextResponse.json({ error: 'Error fetching user details' }, { status: 500 });
  }
}
