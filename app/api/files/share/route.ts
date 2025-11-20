import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';

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

    // Verify that the item exists (check in file_metadata table)
    const { data: item, error: itemError } = await supabaseServer
      .from('file_metadata')
      .select('path, type')
      .eq('path', itemPath)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Datei oder Ordner nicht gefunden' }, { status: 404 });
    }

    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Store the token in Supabase
    const { error: insertError } = await supabaseServer
      .from('shares')
      .insert({
        token: token,
        user_id: user.id,
        item_path: itemPath,
        item_type: item.type,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error creating share:', insertError);
      return NextResponse.json({ error: 'Fehler beim Erstellen des Share-Links' }, { status: 500 });
    }

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
    // Get share data from Supabase
    const { data: shareData, error } = await supabaseServer
      .from('shares')
      .select('user_id, item_path, item_type, created_at')
      .eq('token', token)
      .single();

    if (error || !shareData) {
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 404 });
    }

    // Check if share is older than 30 days
    const createdAt = new Date(shareData.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (createdAt < thirtyDaysAgo) {
      // Delete expired share
      await supabaseServer
        .from('shares')
        .delete()
        .eq('token', token);
      
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 404 });
    }

    // Check if the item is password protected
    const { data: fileMetadata } = await supabaseServer
      .from('file_metadata')
      .select('password_hash, name')
      .eq('path', shareData.item_path)
      .single();

    const isPasswordProtected = !!fileMetadata?.password_hash;

    return NextResponse.json({
      userId: shareData.user_id,
      itemPath: shareData.item_path,
      itemType: shareData.item_type,
      itemName: fileMetadata?.name || shareData.item_path.split('/').pop() || '',
      isPasswordProtected,
    });
  } catch (error: any) {
    console.error('Error getting share:', error);
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}
