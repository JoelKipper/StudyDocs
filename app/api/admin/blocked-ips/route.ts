import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  listBlockedIps,
  upsertBlockedIp,
  updateBlockedIp,
  findUserById,
  insertActivityLog,
} from '@/lib/local-store';

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

    const blockedIps = await listBlockedIps();
    const enriched = await Promise.all(
      blockedIps.map(async (b) => {
        let blocker: { name: string; email: string } | null = null;
        const u = await findUserById(b.blocked_by);
        if (u) {
          blocker = { name: u.name, email: u.email };
        }
        return { ...b, blocker };
      })
    );

    return NextResponse.json({ blockedIps: enriched });
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

    const existing = (await listBlockedIps()).find((b) => b.ip_address === ipAddress);

    const row = await upsertBlockedIp({
      ip_address: ipAddress,
      reason: reason || null,
      blocked_by: user.id,
      expires_at: expiresAt || null,
      is_active: true,
      id: existing?.id,
      blocked_at: new Date().toISOString(),
    });

    await insertActivityLog({
      user_id: user.id,
      action: 'admin_block_ip',
      resource_type: 'ip',
      details: { ip_address: ipAddress, reason, expires_at: expiresAt },
    });

    return NextResponse.json({ blockedIp: row });
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

    const blockedIps = await listBlockedIps();
    const blockedIp = blockedIps.find((b) => b.id === ipId);

    await updateBlockedIp(ipId, { is_active: false });

    if (blockedIp) {
      await insertActivityLog({
        user_id: user.id,
        action: 'admin_unblock_ip',
        resource_type: 'ip',
        details: { ip_address: blockedIp.ip_address },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error unblocking IP:', error);
    return NextResponse.json({ error: 'Error unblocking IP' }, { status: 500 });
  }
}
