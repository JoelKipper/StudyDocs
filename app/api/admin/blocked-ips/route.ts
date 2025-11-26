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

    const { data: blockedIps, error } = await supabaseServer
      .from('blocked_ips')
      .select(`
        id,
        ip_address,
        reason,
        blocked_at,
        expires_at,
        is_active,
        blocked_by,
        blocker:users!blocked_ips_blocked_by_fkey(name, email)
      `)
      .order('blocked_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ blockedIps: blockedIps || [] });
  } catch (error: any) {
    console.error('Error fetching blocked IPs:', error);
    return NextResponse.json({ error: 'Error fetching blocked IPs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { ipAddress, reason, expiresAt } = await request.json();

    if (!ipAddress) {
      return NextResponse.json({ error: 'Missing ipAddress' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('blocked_ips')
      .insert({
        ip_address: ipAddress,
        reason: reason || null,
        blocked_by: user.id,
        expires_at: expiresAt || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // IP already exists, update it
        const { data: updated, error: updateError } = await supabaseServer
          .from('blocked_ips')
          .update({
            reason: reason || null,
            blocked_by: user.id,
            expires_at: expiresAt || null,
            is_active: true,
            blocked_at: new Date().toISOString(),
          })
          .eq('ip_address', ipAddress)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        // Log activity
        await supabaseServer
          .from('activity_logs')
          .insert({
            user_id: user.id,
            action: 'admin_block_ip',
            resource_type: 'ip',
            details: { ip_address: ipAddress, reason, expires_at: expiresAt }
          });

        return NextResponse.json({ blockedIp: updated });
      }
      throw error;
    }

    // Log activity
    await supabaseServer
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: 'admin_block_ip',
        resource_type: 'ip',
        details: { ip_address: ipAddress, reason, expires_at: expiresAt }
      });

    return NextResponse.json({ blockedIp: data });
  } catch (error: any) {
    console.error('Error blocking IP:', error);
    return NextResponse.json({ error: 'Error blocking IP' }, { status: 500 });
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
    const ipId = searchParams.get('id');

    if (!ipId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // Get IP address before deleting for logging
    const { data: blockedIp } = await supabaseServer
      .from('blocked_ips')
      .select('ip_address')
      .eq('id', ipId)
      .single();

    const { error } = await supabaseServer
      .from('blocked_ips')
      .update({ is_active: false })
      .eq('id', ipId);

    if (error) {
      throw error;
    }

    // Log activity
    if (blockedIp) {
      await supabaseServer
        .from('activity_logs')
        .insert({
          user_id: user.id,
          action: 'admin_unblock_ip',
          resource_type: 'ip',
          details: { ip_address: blockedIp.ip_address }
        });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error unblocking IP:', error);
    return NextResponse.json({ error: 'Error unblocking IP' }, { status: 500 });
  }
}


