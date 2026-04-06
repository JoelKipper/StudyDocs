import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFile, getDirectoryContents } from '@/lib/filesystem';
import { sanitizePath } from '@/lib/validation';
import archiver from 'archiver';

async function getAllFilesInDirectory(
  userId: string,
  dirPath: string,
  basePath: string = ''
): Promise<Array<{ path: string; name: string; buffer: Buffer; relativePath: string }>> {
  const contents = await getDirectoryContents(userId, dirPath);
  const files: Array<{ path: string; name: string; buffer: Buffer; relativePath: string }> = [];

  for (const item of contents) {
    const relativePath = basePath ? `${basePath}/${item.name}` : item.name;

    if (item.type === 'directory') {
      const subFiles = await getAllFilesInDirectory(userId, item.path, relativePath);
      files.push(...subFiles);
    } else {
      try {
        const buffer = await getFile(userId, item.path);
        files.push({ path: item.path, name: item.name, buffer, relativePath });
      } catch (error) {
        console.error(`Fehler beim Laden von ${item.path}:`, error);
      }
    }
  }

  return files;
}

async function findItemByPath(
  userId: string,
  searchPath: string
): Promise<{ item: any; found: boolean }> {
  const normalizedSearchPath = searchPath.replace(/\\/g, '/');

  async function searchInDirectory(dirPath: string): Promise<{ item: any; found: boolean }> {
    try {
      const contents = await getDirectoryContents(userId, dirPath);

      for (const item of contents) {
        const normalizedItemPath = item.path.replace(/\\/g, '/');

        if (normalizedItemPath === normalizedSearchPath) {
          return { item, found: true };
        }

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

  return searchInDirectory('');
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawPaths = body.paths;

    if (!rawPaths || !Array.isArray(rawPaths) || rawPaths.length === 0) {
      return NextResponse.json({ error: 'Mindestens ein Pfad ist erforderlich' }, { status: 400 });
    }

    const paths = rawPaths.map((p: string) => sanitizePath(p)).filter((p: string) => p.length > 0);

    if (paths.length === 0) {
      return NextResponse.json({ error: 'Keine gültigen Pfade gefunden' }, { status: 400 });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    let archiveError: Error | null = null;
    let archiveEnded = false;

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

    let fileCount = 0;
    for (const itemPath of paths) {
      try {
        const { item, found } = await findItemByPath(user.id, itemPath);

        if (!found || !item) {
          try {
            const buffer = await getFile(user.id, itemPath);
            const fileName = itemPath.split('/').pop() || itemPath.split('\\').pop() || 'file';
            archive.append(buffer, { name: fileName });
            fileCount++;
          } catch (error) {
            console.error(`Fehler beim direkten Laden von ${itemPath}:`, error);
          }
          continue;
        }

        if (item.type === 'directory') {
          const files = await getAllFilesInDirectory(user.id, item.path, item.name);
          for (const file of files) {
            archive.append(file.buffer, { name: file.relativePath });
            fileCount++;
          }
        } else if (item.type === 'file') {
          try {
            const buffer = await getFile(user.id, item.path);
            archive.append(buffer, { name: item.name });
            fileCount++;
          } catch (error) {
            console.error(`Fehler beim Laden von ${item.path}:`, error);
          }
        }
      } catch (error) {
        console.error(`Fehler beim Verarbeiten von ${itemPath}:`, error);
      }
    }

    if (fileCount === 0) {
      return NextResponse.json({ error: 'Keine Dateien zum Herunterladen gefunden' }, { status: 400 });
    }

    archive.finalize();

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!archiveEnded) {
            reject(new Error('Timeout beim Erstellen der ZIP-Datei'));
          }
        }, 30000);

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

    if (archiveError) {
      const errorMessage = (archiveError as Error).message;
      return NextResponse.json({ error: 'Fehler beim Erstellen der ZIP-Datei: ' + errorMessage }, { status: 500 });
    }

    const zipBuffer = Buffer.concat(chunks);

    if (zipBuffer.length === 0) {
      return NextResponse.json({ error: 'ZIP-Datei ist leer' }, { status: 500 });
    }

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
