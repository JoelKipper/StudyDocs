import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { listUsers, countActivitySince, listBlockedIps } from '@/lib/local-store';
import { getGlobalFileStats } from '@/lib/fs-stats';

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

    const users = await listUsers();
    const userCount = users.length;
    const activeUserCount = users.filter((u) => u.is_active).length;
    const adminCount = users.filter((u) => u.is_admin).length;

    const { fileCount, directoryCount, totalBytes } = await getGlobalFileStats();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recentActivityCount = await countActivitySince(yesterday.toISOString());

    const blocked = await listBlockedIps();
    const blockedIpCount = blocked.filter((b) => b.is_active).length;

    return NextResponse.json({
      users: {
        total: userCount,
        active: activeUserCount,
        admins: adminCount,
      },
      files: {
        total: fileCount,
        directories: directoryCount,
        totalStorage: totalBytes,
      },
      activity: {
        last24Hours: recentActivityCount,
      },
      security: {
        blockedIps: blockedIpCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Error fetching statistics' }, { status: 500 });
  }
}
