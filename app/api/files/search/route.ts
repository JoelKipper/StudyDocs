import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDirectoryContents } from '@/lib/filesystem-supabase';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string | Date; // Can be ISO string or Date
  metadata?: any;
}

async function getAllFilesRecursive(
  dirPath: string = ''
): Promise<FileItem[]> {
  const allFiles: FileItem[] = [];
  
  try {
    const contents = await getDirectoryContents(dirPath);
    
    for (const item of contents) {
      // Convert modified date to ISO string for JSON serialization
      const fileItem: FileItem = {
        ...item,
        modified: item.modified ? new Date(item.modified).toISOString() : undefined,
      };
      allFiles.push(fileItem);
      
      // If it's a directory, recursively get its contents
      if (item.type === 'directory') {
        const subFiles = await getAllFilesRecursive(item.path);
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
    const query = searchParams.get('q') || '';
    const fileType = searchParams.get('type') || 'all';
    const extensions = searchParams.get('extensions');
    const minSize = searchParams.get('minSize');
    const maxSize = searchParams.get('maxSize');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Get all files recursively
    const allFiles = await getAllFilesRecursive('');

    // Apply filters
    let filtered = allFiles;

    // Text search
    if (query.trim()) {
      const searchQuery = query.toLowerCase().trim();
      filtered = filtered.filter(
        (file) =>
          file.name.toLowerCase().includes(searchQuery) ||
          file.path.toLowerCase().includes(searchQuery)
      );
    }

    // File type filter
    if (fileType !== 'all') {
      filtered = filtered.filter((file) => file.type === fileType);
    }

    // File extensions filter
    if (extensions) {
      const extensionList = extensions.split(',').map((ext) => ext.trim().toLowerCase());
      filtered = filtered.filter((file) => {
        if (file.type !== 'file') return false;
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        return extensionList.includes(fileExtension);
      });
    }

    // Size filter
    if (minSize) {
      const minSizeBytes = parseInt(minSize) * 1024; // Convert KB to bytes
      filtered = filtered.filter((file) => (file.size || 0) >= minSizeBytes);
    }
    if (maxSize) {
      const maxSizeBytes = parseInt(maxSize) * 1024; // Convert KB to bytes
      filtered = filtered.filter((file) => (file.size || 0) <= maxSizeBytes);
    }

    // Date filter
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

