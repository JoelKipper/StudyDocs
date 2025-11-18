import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDirectoryContents, createDirectory, deleteItem } from '@/lib/filesystem';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const dirPath = searchParams.get('path') || '';
  
  try {
    const contents = await getDirectoryContents(user.id, dirPath);
    return NextResponse.json({ contents });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Laden des Verzeichnisses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  try {
    const { action, path, name } = await request.json();
    
    if (action === 'create-directory') {
      const dirPath = path ? `${path}/${name}` : name;
      await createDirectory(user.id, dirPath);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'delete') {
      await deleteItem(user.id, path);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

