import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'user-data');

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
}

export async function ensureUserDirectory(userId: string): Promise<string> {
  const userDir = path.join(UPLOAD_DIR, userId);
  try {
    await fs.access(userDir);
  } catch {
    await fs.mkdir(userDir, { recursive: true });
  }
  return userDir;
}

export async function getDirectoryContents(userId: string, dirPath: string = ''): Promise<FileItem[]> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = dirPath ? path.join(userDir, dirPath) : userDir;
  
  try {
    const items = await fs.readdir(fullPath);
    const contents: FileItem[] = [];
    
    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const relativePath = dirPath ? path.join(dirPath, item) : item;
      const stats = await fs.stat(itemPath);
      
      contents.push({
        name: item,
        path: relativePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.isFile() ? stats.size : undefined,
        modified: stats.mtime,
      });
    }
    
    return contents.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    return [];
  }
}

export async function createDirectory(userId: string, dirPath: string): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, dirPath);
  await fs.mkdir(fullPath, { recursive: true });
}

export async function deleteItem(userId: string, itemPath: string): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, itemPath);
  
  const stats = await fs.stat(fullPath);
  if (stats.isDirectory()) {
    await fs.rmdir(fullPath, { recursive: true });
  } else {
    await fs.unlink(fullPath);
  }
}

export async function saveFile(userId: string, filePath: string, buffer: Buffer): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, filePath);
  const dir = path.dirname(fullPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

export async function getFile(userId: string, filePath: string): Promise<Buffer> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, filePath);
  return fs.readFile(fullPath);
}

