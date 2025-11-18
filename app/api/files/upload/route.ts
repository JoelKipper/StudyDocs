import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveFile } from '@/lib/filesystem-supabase';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string || '';
    
    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path ? `${path}/${file.name}` : file.name;
    
    await saveFile(filePath, buffer, user);
    
    return NextResponse.json({ success: true, fileName: file.name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Fehler beim Hochladen der Datei' }, { status: 500 });
  }
}

