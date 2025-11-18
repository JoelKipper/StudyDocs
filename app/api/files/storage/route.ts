import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { calculateStorageUsed } from '@/lib/filesystem';

// Default storage quota: 5 GB (can be configured via environment variable)
const DEFAULT_STORAGE_QUOTA = 5 * 1024 * 1024 * 1024; // 5 GB in bytes

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  try {
    const used = await calculateStorageUsed(user.id);
    const quota = process.env.STORAGE_QUOTA 
      ? parseInt(process.env.STORAGE_QUOTA, 10) 
      : DEFAULT_STORAGE_QUOTA;
    
    return NextResponse.json({
      used,
      quota,
      percentage: (used / quota) * 100,
    });
  } catch (error: any) {
    console.error('Error calculating storage:', error);
    return NextResponse.json({ error: 'Fehler beim Berechnen des Speicherplatzes' }, { status: 500 });
  }
}

