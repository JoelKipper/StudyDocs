import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const SHARES_FILE = path.join(process.cwd(), 'user-data', 'shares.json');

interface ShareData {
  userId: string;
  itemPath: string;
  createdAt: number;
}

async function loadShares(): Promise<Map<string, ShareData>> {
  try {
    const data = await fs.readFile(SHARES_FILE, 'utf-8');
    const shares = JSON.parse(data);
    const map = new Map<string, ShareData>();
    for (const [token, shareData] of Object.entries(shares)) {
      map.set(token, shareData as ShareData);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function saveShares(shares: Map<string, ShareData>) {
  try {
    await fs.mkdir(path.dirname(SHARES_FILE), { recursive: true });
    const obj = Object.fromEntries(shares);
    await fs.writeFile(SHARES_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving shares:', error);
  }
}

async function cleanupOldShares(shares: Map<string, ShareData>) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [token, data] of shares.entries()) {
    if (data.createdAt < thirtyDaysAgo) {
      shares.delete(token);
    }
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { path: itemPath } = await request.json();

    if (!itemPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    // Verify that the item exists and belongs to the user
    const userDir = path.join(process.cwd(), 'user-data', user.id);
    const fullPath = path.join(userDir, itemPath);

    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json({ error: 'Datei oder Ordner nicht gefunden' }, { status: 404 });
    }

    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Load existing shares
    const shares = await loadShares();
    
    // Clean up old shares
    await cleanupOldShares(shares);

    // Store the token
    shares.set(token, {
      userId: user.id,
      itemPath: itemPath,
      createdAt: Date.now(),
    });

    // Save shares
    await saveShares(shares);

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('Error creating share link:', error);
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token ist erforderlich' }, { status: 400 });
  }

  try {
    const shares = await loadShares();
    const shareData = shares.get(token);

    if (!shareData) {
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 404 });
    }

    // Check if token is expired
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (shareData.createdAt < thirtyDaysAgo) {
      shares.delete(token);
      await saveShares(shares);
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 404 });
    }

    // Determine if item is a file or directory
    const userDir = path.join(process.cwd(), 'user-data', shareData.userId);
    const fullPath = path.join(userDir, shareData.itemPath);
    let itemType: 'file' | 'directory' = 'directory';
    
    try {
      const stats = await fs.stat(fullPath);
      itemType = stats.isFile() ? 'file' : 'directory';
    } catch {
      // If we can't stat, default to directory
    }

    return NextResponse.json({
      userId: shareData.userId,
      itemPath: shareData.itemPath,
      itemType: itemType,
    });
  } catch (error: any) {
    console.error('Error getting share:', error);
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}

