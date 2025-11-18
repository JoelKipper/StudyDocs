import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFile } from '@/lib/filesystem';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');
  
  if (!filePath) {
    return NextResponse.json({ error: 'Dateipfad erforderlich' }, { status: 400 });
  }
  
  try {
    const buffer = await getFile(user.id, filePath);
    const fileName = filePath.split('/').pop() || 'download';
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden der Datei' }, { status: 500 });
  }
}

