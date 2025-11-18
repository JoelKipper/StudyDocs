import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'user-data');
const METADATA_FILE = '.metadata.json';

interface MetadataStore {
  [itemName: string]: FileMetadata;
}

async function getMetadataPath(userId: string, dirPath: string): Promise<string> {
  const userDir = await ensureUserDirectory(userId);
  const fullDirPath = dirPath ? path.join(userDir, dirPath) : userDir;
  return path.join(fullDirPath, METADATA_FILE);
}

async function loadMetadata(userId: string, dirPath: string): Promise<MetadataStore> {
  try {
    const metadataPath = await getMetadataPath(userId, dirPath);
    const data = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveMetadata(userId: string, dirPath: string, metadata: MetadataStore): Promise<void> {
  const metadataPath = await getMetadataPath(userId, dirPath);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

export interface FileMetadata {
  createdBy: { id: string; name: string; email: string };
  createdAt: string;
  lastModifiedBy?: { id: string; name: string; email: string };
  lastModifiedAt?: string;
  renamedBy?: { id: string; name: string; email: string };
  renamedAt?: string;
}

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  metadata?: FileMetadata;
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
    const metadata = await loadMetadata(userId, dirPath);
    const contents: FileItem[] = [];
    
    for (const item of items) {
      // Skip metadata file
      if (item === METADATA_FILE) continue;
      
      const itemPath = path.join(fullPath, item);
      const relativePath = dirPath ? path.join(dirPath, item) : item;
      const stats = await fs.stat(itemPath);
      
      contents.push({
        name: item,
        path: relativePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.isFile() ? stats.size : undefined,
        modified: stats.mtime,
        metadata: metadata[item] || undefined,
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

export async function createDirectory(
  userId: string,
  dirPath: string,
  user: { id: string; name: string; email: string }
): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, dirPath);
  await fs.mkdir(fullPath, { recursive: true });
  
  // Save metadata
  const parentDir = path.dirname(dirPath);
  const dirName = path.basename(dirPath);
  const metadata = await loadMetadata(userId, parentDir === '.' ? '' : parentDir);
  metadata[dirName] = {
    createdBy: user,
    createdAt: new Date().toISOString(),
  };
  await saveMetadata(userId, parentDir === '.' ? '' : parentDir, metadata);
}

export async function deleteItem(userId: string, itemPath: string): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, itemPath);
  const itemName = path.basename(itemPath);
  const relativeDir = path.dirname(itemPath);
  const dirPath = relativeDir === '.' ? '' : relativeDir;
  
  // Remove metadata before deleting
  const metadata = await loadMetadata(userId, dirPath);
  if (metadata[itemName]) {
    delete metadata[itemName];
    await saveMetadata(userId, dirPath, metadata);
  }
  
  const stats = await fs.stat(fullPath);
  if (stats.isDirectory()) {
    // Recursively delete directory and all its contents
    await fs.rm(fullPath, { recursive: true, force: true });
  } else {
    await fs.unlink(fullPath);
  }
}

export async function saveFile(
  userId: string,
  filePath: string,
  buffer: Buffer,
  user: { id: string; name: string; email: string }
): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, filePath);
  const dir = path.dirname(fullPath);
  const fileName = path.basename(filePath);
  const relativeDir = path.dirname(filePath);
  const dirPath = relativeDir === '.' ? '' : relativeDir;
  
  await fs.mkdir(dir, { recursive: true });
  
  // Check if file exists
  const metadata = await loadMetadata(userId, dirPath);
  const fileExists = metadata[fileName] !== undefined;
  
  await fs.writeFile(fullPath, buffer);
  
  // Update metadata
  if (fileExists) {
    metadata[fileName] = {
      ...metadata[fileName],
      lastModifiedBy: user,
      lastModifiedAt: new Date().toISOString(),
    };
  } else {
    metadata[fileName] = {
      createdBy: user,
      createdAt: new Date().toISOString(),
    };
  }
  await saveMetadata(userId, dirPath, metadata);
}

export async function getFile(userId: string, filePath: string): Promise<Buffer> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, filePath);
  return fs.readFile(fullPath);
}

export async function renameItem(
  userId: string,
  itemPath: string,
  newName: string,
  user: { id: string; name: string; email: string }
): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, itemPath);
  const dir = path.dirname(fullPath);
  const newPath = path.join(dir, newName);
  const itemName = path.basename(itemPath);
  const relativeDir = path.dirname(itemPath);
  const dirPath = relativeDir === '.' ? '' : relativeDir;
  
  // Check if new name already exists
  try {
    await fs.access(newPath);
    throw new Error('Ein Element mit diesem Namen existiert bereits');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  
  // Update metadata before renaming
  const metadata = await loadMetadata(userId, dirPath);
  if (metadata[itemName]) {
    metadata[newName] = {
      ...metadata[itemName],
      renamedBy: user,
      renamedAt: new Date().toISOString(),
      lastModifiedBy: user,
      lastModifiedAt: new Date().toISOString(),
    };
    delete metadata[itemName];
    await saveMetadata(userId, dirPath, metadata);
  }
  
  await fs.rename(fullPath, newPath);
}

