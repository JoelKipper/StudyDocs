import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { queryActivityLogs, listUsers } from '@/lib/local-store';

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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    const { logs, total } = await queryActivityLogs({
      limit,
      offset,
      action,
      userId,
    });

    const users = await listUsers();
    const uidMap = new Map(users.map((u) => [u.id, { id: u.id, email: u.email, name: u.name }]));

    const activities = logs.map((log) => ({
      ...log,
      user: uidMap.get(log.user_id) || null,
    }));

    return NextResponse.json({
      activities,
      total,
    });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Error fetching activity logs' }, { status: 500 });
  }
}
