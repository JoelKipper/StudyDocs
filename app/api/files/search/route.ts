import { NextRequest, NextResponse } from 'next/server';
import { getDirectoryContents } from '@/lib/filesystem';
import { getCurrentUser } from '@/lib/auth';
import { sanitizeString } from '@/lib/validation';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string | Date;
  metadata?: any;
}

async function getAllFilesRecursive(userId: string, dirPath: string = ''): Promise<FileItem[]> {
  const allFiles: FileItem[] = [];

  try {
    const contents = await getDirectoryContents(userId, dirPath);

    for (const item of contents) {
      const fileItem: FileItem = {
        ...item,
        modified: item.modified ? new Date(item.modified).toISOString() : undefined,
      };
      allFiles.push(fileItem);

      if (item.type === 'directory') {
        const subFiles = await getAllFilesRecursive(userId, item.path);
        allFiles.push(...subFiles);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return allFiles;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q') || '';
    const query = sanitizeString(rawQuery, 500);
    const fileType = searchParams.get('type') || 'all';
    const rawExtensions = searchParams.get('extensions');
    const extensions = rawExtensions ? sanitizeString(rawExtensions, 100) : null;
    const minSize = searchParams.get('minSize');
    const maxSize = searchParams.get('maxSize');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const allFiles = await getAllFilesRecursive(user.id, '');

    let filtered = allFiles;

    if (query.trim()) {
      const searchQuery = query.toLowerCase().trim();
      filtered = filtered.filter(
        (file) =>
          file.name.toLowerCase().includes(searchQuery) ||
          file.path.toLowerCase().includes(searchQuery)
      );
    }

    if (fileType !== 'all') {
      filtered = filtered.filter((file) => file.type === fileType);
    }

    if (extensions) {
      const extensionList = extensions.split(',').map((ext) => ext.trim().toLowerCase());
      filtered = filtered.filter((file) => {
        if (file.type !== 'file') return false;
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        return extensionList.includes(fileExtension);
      });
    }

    if (minSize) {
      const minSizeBytes = parseInt(minSize, 10) * 1024;
      filtered = filtered.filter((file) => (file.size || 0) >= minSizeBytes);
    }
    if (maxSize) {
      const maxSizeBytes = parseInt(maxSize, 10) * 1024;
      filtered = filtered.filter((file) => (file.size || 0) <= maxSizeBytes);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((file) => {
        if (!file.modified) return false;
        const fileDate = new Date(file.modified as string);
        fileDate.setHours(0, 0, 0, 0);
        return fileDate >= fromDate;
      });
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((file) => {
        if (!file.modified) return false;
        const fileDate = new Date(file.modified as string);
        return fileDate <= toDate;
      });
    }

    return NextResponse.json({ results: filtered, total: allFiles.length });
  } catch (error) {
    console.error('Error in search:', error);
    return NextResponse.json({ error: 'Fehler bei der Suche' }, { status: 500 });
  }
}
