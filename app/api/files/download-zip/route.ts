import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFile, getDirectoryContents } from '@/lib/filesystem-supabase';
import archiver from 'archiver';

async function getAllFilesInDirectory(
  dirPath: string,
  basePath: string = ''
): Promise<Array<{ path: string; name: string; buffer: Buffer; relativePath: string }>> {
  const contents = await getDirectoryContents(dirPath);
  const files: Array<{ path: string; name: string; buffer: Buffer; relativePath: string }> = [];

  for (const item of contents) {
    const relativePath = basePath ? `${basePath}/${item.name}` : item.name;

    if (item.type === 'directory') {
      // Recursively get files from subdirectory
      const subFiles = await getAllFilesInDirectory(item.path, relativePath);
      files.push(...subFiles);
    } else {
      // Get file buffer
      try {
        const buffer = await getFile(item.path);
        files.push({ path: item.path, name: item.name, buffer, relativePath });
      } catch (error) {
        console.error(`Fehler beim Laden von ${item.path}:`, error);
        // Continue with other files
      }
    }
  }

  return files;
}

// Helper function to find an item by path recursively
async function findItemByPath(
  searchPath: string
): Promise<{ item: any; found: boolean }> {
  // Normalize path
  const normalizedSearchPath = searchPath.replace(/\\/g, '/');
  
  // Helper to recursively search
  async function searchInDirectory(dirPath: string): Promise<{ item: any; found: boolean }> {
    try {
      const contents = await getDirectoryContents(dirPath);
      
      for (const item of contents) {
        const normalizedItemPath = item.path.replace(/\\/g, '/');
        
        // Check if this is the item we're looking for
        if (normalizedItemPath === normalizedSearchPath) {
          return { item, found: true };
        }
        
        // If it's a directory, search recursively
        if (item.type === 'directory') {
          const result = await searchInDirectory(item.path);
          if (result.found) {
            return result;
          }
        }
      }
    } catch (error) {
      console.error(`Fehler beim Durchsuchen von ${dirPath}:`, error);
    }
    
    return { item: null, found: false };
  }
  
  // Start search from root
  return await searchInDirectory('');
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { paths } = await request.json();

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: 'Mindestens ein Pfad ist erforderlich' }, { status: 400 });
    }

    console.log('Download-ZIP: Empfangene Pfade:', paths);

    // Create archive in memory
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    let archiveError: Error | null = null;
    let archiveEnded = false;

    // Set up event handlers BEFORE processing
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on('error', (err: Error) => {
      console.error('Archive error:', err);
      archiveError = err;
    });

    archive.on('end', () => {
      archiveEnded = true;
    });

    // Process each path
    let fileCount = 0;
    for (const itemPath of paths) {
      try {
        console.log(`Verarbeite Pfad: ${itemPath}`);
        
        // Find the item using recursive search
        const { item, found } = await findItemByPath(itemPath);
        
        if (!found || !item) {
          console.error(`Item nicht gefunden: ${itemPath}`);
          // Try to get as file directly (fallback)
          try {
            const buffer = await getFile(itemPath);
            const fileName = itemPath.split('/').pop() || itemPath.split('\\').pop() || 'file';
            archive.append(buffer, { name: fileName });
            fileCount++;
            console.log(`Datei direkt geladen: ${itemPath}`);
          } catch (error) {
            console.error(`Fehler beim direkten Laden von ${itemPath}:`, error);
          }
          continue;
        }

        console.log(`Item gefunden: ${item.name}, Typ: ${item.type}, Pfad: ${item.path}`);

        if (item.type === 'directory') {
          // Get all files in directory recursively
          const files = await getAllFilesInDirectory(item.path, item.name);
          console.log(`Ordner ${item.name} enthält ${files.length} Dateien`);
          for (const file of files) {
            archive.append(file.buffer, { name: file.relativePath });
            fileCount++;
          }
        } else if (item.type === 'file') {
          // Single file
          try {
            const buffer = await getFile(item.path);
            archive.append(buffer, { name: item.name });
            fileCount++;
            console.log(`Datei hinzugefügt: ${item.name}`);
          } catch (error) {
            console.error(`Fehler beim Laden von ${item.path}:`, error);
          }
        }
      } catch (error) {
        console.error(`Fehler beim Verarbeiten von ${itemPath}:`, error);
      }
    }

    console.log(`Gesamtanzahl der hinzugefügten Dateien: ${fileCount}`);

    if (fileCount === 0) {
      return NextResponse.json({ error: 'Keine Dateien zum Herunterladen gefunden' }, { status: 400 });
    }

    // Finalize the archive
    archive.finalize();

    // Wait for archive to finish (with timeout)
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!archiveEnded) {
            reject(new Error('Timeout beim Erstellen der ZIP-Datei'));
          }
        }, 30000); // 30 second timeout

        if (archiveError) {
          clearTimeout(timeout);
          reject(archiveError);
          return;
        }

        if (archiveEnded) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        archive.once('end', () => {
          clearTimeout(timeout);
          resolve();
        });

        archive.once('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: 'Fehler beim Erstellen der ZIP-Datei: ' + errorMessage }, { status: 500 });
    }

    // Check for archiveError after promise (in case it was set but promise didn't reject)
    if (archiveError) {
      const errorMessage = (archiveError as Error).message;
      return NextResponse.json({ error: 'Fehler beim Erstellen der ZIP-Datei: ' + errorMessage }, { status: 500 });
    }

    // Combine all chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks);

    if (zipBuffer.length === 0) {
      return NextResponse.json({ error: 'ZIP-Datei ist leer' }, { status: 500 });
    }

    console.log(`ZIP-Datei erstellt, Größe: ${zipBuffer.length} bytes`);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="download.zip"',
      },
    });
  } catch (error: any) {
    console.error('Error in download-zip:', error);
    return NextResponse.json({ error: error.message || 'Fehler beim Erstellen der ZIP-Datei' }, { status: 500 });
  }
}
