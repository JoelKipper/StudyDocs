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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    let query = supabaseServer
      .from('activity_logs')
      .select(`
        id,
        action,
        resource_type,
        resource_path,
        ip_address,
        user_agent,
        details,
        created_at,
        user:users!activity_logs_user_id_fkey(id, email, name)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) {
      query = query.eq('action', action);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: activities, error } = await query;

    if (error) {
      throw error;
    }

    // Get total count
    let countQuery = supabaseServer
      .from('activity_logs')
      .select('*', { count: 'exact', head: true });

    if (action) {
      countQuery = countQuery.eq('action', action);
    }

    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      activities: activities || [],
      total: count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Error fetching activity logs' }, { status: 500 });
  }
}


