import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFile } from '@/lib/filesystem-supabase';
import { sanitizePath } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const rawFilePath = searchParams.get('path');
  
  if (!rawFilePath) {
    return NextResponse.json({ error: 'Dateipfad erforderlich' }, { status: 400 });
  }
  
  // Sanitize file path
  const filePath = sanitizePath(rawFilePath);
  
  if (!filePath) {
    return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 });
  }
  
  try {
    const buffer = await getFile(filePath);
    const fileName = filePath.split('/').pop() || 'download';
    
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Datei' }, { status: 500 });
  }
}

