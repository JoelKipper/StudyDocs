import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFile } from '@/lib/filesystem-supabase';
import { supabaseServer } from '@/lib/supabase-server';
import { decryptFile, verifyFilePassword } from '@/lib/encryption';
import path from 'path';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');
    const password = searchParams.get('password');

    if (!filePath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    // Check if file is password protected
    const { data: fileMetadata, error: fetchError } = await supabaseServer
      .from('file_metadata')
      .select('password_hash, type')
      .eq('path', filePath)
      .single();

    if (fetchError || !fileMetadata) {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
    }

    // If file is password protected, require password
    if (fileMetadata.password_hash) {
      if (!password) {
        return NextResponse.json({ error: 'Passwort ist erforderlich', requiresPassword: true }, { status: 401 });
      }

      // Verify password
      const isValid = await verifyFilePassword(password, fileMetadata.password_hash);
      if (!isValid) {
        return NextResponse.json({ error: 'Falsches Passwort', requiresPassword: true }, { status: 401 });
      }
    }

    // Get file from Supabase Storage
    const fileBuffer = await getFile(filePath);
    
    // If file is password protected, decrypt it
    let decryptedBuffer = fileBuffer;
    if (fileMetadata.password_hash && password) {
      decryptedBuffer = decryptFile(fileBuffer, password);
    }
    const fileName = path.basename(filePath);
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    // Determine content type
    let contentType = 'application/octet-stream';
    if (fileExtension === 'pdf') {
      contentType = 'application/pdf';
    } else if (['jpg', 'jpeg'].includes(fileExtension)) {
      contentType = 'image/jpeg';
    } else if (fileExtension === 'png') {
      contentType = 'image/png';
    } else if (fileExtension === 'gif') {
      contentType = 'image/gif';
    } else if (fileExtension === 'webp') {
      contentType = 'image/webp';
    } else if (fileExtension === 'svg') {
      contentType = 'image/svg+xml';
    } else if (fileExtension === 'txt') {
      contentType = 'text/plain; charset=utf-8';
    } else if (fileExtension === 'html') {
      contentType = 'text/html; charset=utf-8';
    } else if (fileExtension === 'css') {
      contentType = 'text/css; charset=utf-8';
    } else if (['js', 'jsx'].includes(fileExtension)) {
      contentType = 'application/javascript; charset=utf-8';
    } else if (['ts', 'tsx'].includes(fileExtension)) {
      contentType = 'application/typescript; charset=utf-8';
    } else if (fileExtension === 'json') {
      contentType = 'application/json; charset=utf-8';
    } else if (fileExtension === 'xml') {
      contentType = 'application/xml; charset=utf-8';
    } else if (fileExtension === 'md') {
      contentType = 'text/markdown; charset=utf-8';
    } else if (['py', 'java', 'cpp', 'c', 'h', 'sh', 'yaml', 'yml'].includes(fileExtension)) {
      contentType = 'text/plain; charset=utf-8';
    } else if (['mp4'].includes(fileExtension)) {
      contentType = 'video/mp4';
    } else if (['webm'].includes(fileExtension)) {
      contentType = 'video/webm';
    } else if (['ogg'].includes(fileExtension)) {
      contentType = 'video/ogg';
    } else if (['mov'].includes(fileExtension)) {
      contentType = 'video/quicktime';
    } else if (['avi'].includes(fileExtension)) {
      contentType = 'video/x-msvideo';
    } else if (['mkv'].includes(fileExtension)) {
      contentType = 'video/x-matroska';
    } else if (['mp3'].includes(fileExtension)) {
      contentType = 'audio/mpeg';
    } else if (['wav'].includes(fileExtension)) {
      contentType = 'audio/wav';
    } else if (['flac'].includes(fileExtension)) {
      contentType = 'audio/flac';
    } else if (['aac'].includes(fileExtension)) {
      contentType = 'audio/aac';
    } else if (['m4a'].includes(fileExtension)) {
      contentType = 'audio/mp4';
    } else if (['wma'].includes(fileExtension)) {
      contentType = 'audio/x-ms-wma';
    } else if (['doc'].includes(fileExtension)) {
      contentType = 'application/msword';
    } else if (['docx'].includes(fileExtension)) {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (['xls'].includes(fileExtension)) {
      contentType = 'application/vnd.ms-excel';
    } else if (['xlsx'].includes(fileExtension)) {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (['ppt'].includes(fileExtension)) {
      contentType = 'application/vnd.ms-powerpoint';
    } else if (['pptx'].includes(fileExtension)) {
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (['odt'].includes(fileExtension)) {
      contentType = 'application/vnd.oasis.opendocument.text';
    } else if (['ods'].includes(fileExtension)) {
      contentType = 'application/vnd.oasis.opendocument.spreadsheet';
    } else if (['odp'].includes(fileExtension)) {
      contentType = 'application/vnd.oasis.opendocument.presentation';
    }

    // Return file with appropriate headers
    const headers: HeadersInit = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    };

    // For PDFs, add headers to allow iframe embedding
    if (fileExtension === 'pdf') {
      // Use inline disposition to display in browser
      headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(fileName)}"`;
      headers['X-Content-Type-Options'] = 'nosniff';
      // Allow embedding in iframe
      headers['X-Frame-Options'] = 'SAMEORIGIN';
      // Ensure proper PDF content type
      headers['Content-Type'] = 'application/pdf';
      // Add Accept-Ranges for better PDF support
      headers['Accept-Ranges'] = 'bytes';
    } else {
      headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(fileName)}"`;
    }

    return new NextResponse(new Uint8Array(decryptedBuffer), {
      headers,
    });
  } catch (error: any) {
    console.error('Error serving preview:', error);
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}

