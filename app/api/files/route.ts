import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDirectoryContents, createDirectory, deleteItem, renameItem, moveItem, copyItem } from '@/lib/filesystem';

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
    const { action, path, name, newName, targetPath } = await request.json();
    
    if (action === 'create-directory') {
      const dirPath = path ? `${path}/${name}` : name;
      await createDirectory(user.id, dirPath, user);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'delete') {
      await deleteItem(user.id, path);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'rename') {
      if (!newName || !newName.trim()) {
        return NextResponse.json({ error: 'Neuer Name ist erforderlich' }, { status: 400 });
      }
      await renameItem(user.id, path, newName.trim(), user);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'move') {
      if (!targetPath && targetPath !== '') {
        return NextResponse.json({ error: 'Zielverzeichnis ist erforderlich' }, { status: 400 });
      }
      await moveItem(user.id, path, targetPath, user);
      return NextResponse.json({ success: true });
    }
    
    if (action === 'copy') {
      if (!targetPath && targetPath !== '') {
        return NextResponse.json({ error: 'Zielverzeichnis ist erforderlich' }, { status: 400 });
      }
      await copyItem(user.id, path, targetPath, user);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}

