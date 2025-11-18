import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    const userDir = path.join(process.cwd(), 'user-data', user.id);
    const fullPath = path.join(userDir, filePath);

    // Security check: ensure path is within user directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedUserDir = path.resolve(userDir);
    if (!resolvedPath.startsWith(resolvedUserDir)) {
      return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 403 });
    }

    // Check if file exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        return NextResponse.json({ error: 'Verzeichnisse können nicht als Vorschau angezeigt werden' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
    }

    // Read file
    const fileBuffer = await fs.readFile(resolvedPath);
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

    return new NextResponse(fileBuffer, {
      headers,
    });
  } catch (error: any) {
    console.error('Error serving preview:', error);
    return NextResponse.json({ error: error.message || 'Serverfehler' }, { status: 500 });
  }
}

