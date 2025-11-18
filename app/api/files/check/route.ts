import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDirectoryContents } from '@/lib/filesystem';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');
    const path = searchParams.get('path') || '';
    
    if (!fileName) {
      return NextResponse.json({ error: 'Dateiname ist erforderlich' }, { status: 400 });
    }
    
    const contents = await getDirectoryContents(user.id, path);
    const exists = contents.some(item => item.name === fileName && item.type === 'file');
    
    return NextResponse.json({ exists, fileName });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Prüfen der Datei' }, { status: 500 });
  }
}

