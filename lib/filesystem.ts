import fs from 'fs/promises';
import path from 'path';
import { ACCOUNTS_DIR } from './data-dir';

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
  /** bcrypt hash for file/folder password protection */
  passwordHash?: string;
}

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  metadata?: FileMetadata;
  isPasswordProtected?: boolean;
}

export async function ensureUserDirectory(userId: string): Promise<string> {
  const userDir = path.join(ACCOUNTS_DIR, userId);
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
      
      let size: number | undefined;
      if (stats.isFile()) {
        size = stats.size;
      } else if (stats.isDirectory()) {
        // Calculate directory size
        try {
          size = await getDirectorySize(itemPath);
        } catch (error) {
          // If calculation fails, leave size as undefined
          size = undefined;
        }
      }
      
      const meta = metadata[item];
      contents.push({
        name: item,
        path: relativePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: size,
        modified: stats.mtime,
        metadata: meta || undefined,
        isPasswordProtected: !!meta?.passwordHash,
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

/**
 * Calculate the size of a single directory (in bytes)
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      // Skip metadata files
      if (item === METADATA_FILE) continue;
      
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        totalSize += await getDirectorySize(itemPath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Ignore errors (e.g., permission denied)
    console.error(`Error calculating size for ${dirPath}:`, error);
  }
  
  return totalSize;
}

/**
 * Calculate total storage used by a user (in bytes)
 */
export async function calculateStorageUsed(userId: string): Promise<number> {
  const userDir = await ensureUserDirectory(userId);
  return await getDirectorySize(userDir);
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

export async function moveItem(
  userId: string,
  itemPath: string,
  targetDirPath: string,
  user: { id: string; name: string; email: string }
): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const sourcePath = path.join(userDir, itemPath);
  const itemName = path.basename(itemPath);
  const sourceDir = path.dirname(itemPath);
  const sourceDirPath = sourceDir === '.' ? '' : sourceDir;
  const targetDir = targetDirPath === '' ? userDir : path.join(userDir, targetDirPath);
  const targetPath = path.join(targetDir, itemName);
  
  // Check if target already exists
  try {
    await fs.access(targetPath);
    throw new Error('Ein Element mit diesem Namen existiert bereits im Zielverzeichnis');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  
  // Load and update metadata
  const sourceMetadata = await loadMetadata(userId, sourceDirPath);
  const targetMetadata = await loadMetadata(userId, targetDirPath);
  
  if (sourceMetadata[itemName]) {
    targetMetadata[itemName] = {
      ...sourceMetadata[itemName],
      lastModifiedBy: user,
      lastModifiedAt: new Date().toISOString(),
    };
    delete sourceMetadata[itemName];
    await saveMetadata(userId, sourceDirPath, sourceMetadata);
    await saveMetadata(userId, targetDirPath, targetMetadata);
  } else {
    // If no metadata exists, create new metadata for moved item
    targetMetadata[itemName] = {
      createdBy: user,
      createdAt: new Date().toISOString(),
      lastModifiedBy: user,
      lastModifiedAt: new Date().toISOString(),
    };
    await saveMetadata(userId, targetDirPath, targetMetadata);
  }
  
  // Move the file/directory
  await fs.rename(sourcePath, targetPath);
  
  // If moving a directory, also update metadata file location
  const stats = await fs.stat(targetPath);
  if (stats.isDirectory()) {
    // Move metadata file if it exists
    const oldMetadataPath = path.join(sourcePath, METADATA_FILE);
    const newMetadataPath = path.join(targetPath, METADATA_FILE);
    try {
      await fs.access(oldMetadataPath);
      await fs.rename(oldMetadataPath, newMetadataPath);
    } catch {
      // Metadata file doesn't exist, that's okay
    }
  }
}

export async function copyItem(
  userId: string,
  itemPath: string,
  targetDirPath: string,
  user: { id: string; name: string; email: string }
): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const sourcePath = path.join(userDir, itemPath);
  const itemName = path.basename(itemPath);
  const sourceDir = path.dirname(itemPath);
  const sourceDirPath = sourceDir === '.' ? '' : sourceDir;
  const targetDir = targetDirPath === '' ? userDir : path.join(userDir, targetDirPath);
  const targetPath = path.join(targetDir, itemName);
  
  // Check if target already exists
  try {
    await fs.access(targetPath);
    throw new Error('Ein Element mit diesem Namen existiert bereits im Zielverzeichnis');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  
  // Check if source exists
  const stats = await fs.stat(sourcePath);
  
  if (stats.isDirectory()) {
    // Copy directory recursively
    await fs.mkdir(targetPath, { recursive: true });
    
    // Copy all files and subdirectories
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });
    for (const entry of entries) {
      const sourceEntryPath = path.join(sourcePath, entry.name);
      const targetEntryPath = path.join(targetPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        const subItemPath = itemPath ? `${itemPath}/${entry.name}` : entry.name;
        const subTargetDirPath = targetDirPath ? `${targetDirPath}/${itemName}` : itemName;
        await copyItem(userId, subItemPath, subTargetDirPath, user);
      } else if (entry.isFile() && entry.name !== METADATA_FILE) {
        // Copy file
        await fs.copyFile(sourceEntryPath, targetEntryPath);
      }
    }
    
    // Copy metadata file if it exists
    const sourceMetadataPath = path.join(sourcePath, METADATA_FILE);
    const targetMetadataPath = path.join(targetPath, METADATA_FILE);
    try {
      await fs.access(sourceMetadataPath);
      const metadataContent = await fs.readFile(sourceMetadataPath, 'utf-8');
      await fs.writeFile(targetMetadataPath, metadataContent, 'utf-8');
    } catch {
      // Metadata file doesn't exist, that's okay
    }
    
    // Update metadata for copied directory
    const targetMetadata = await loadMetadata(userId, targetDirPath);
    const sourceMetadata = await loadMetadata(userId, sourceDirPath);
    
    if (sourceMetadata[itemName]) {
      // Copy metadata with new creation info
      targetMetadata[itemName] = {
        ...sourceMetadata[itemName],
        createdBy: user,
        createdAt: new Date().toISOString(),
        lastModifiedBy: user,
        lastModifiedAt: new Date().toISOString(),
      };
    } else {
      // Create new metadata for copied directory
      targetMetadata[itemName] = {
        createdBy: user,
        createdAt: new Date().toISOString(),
        lastModifiedBy: user,
        lastModifiedAt: new Date().toISOString(),
      };
    }
    await saveMetadata(userId, targetDirPath, targetMetadata);
  } else {
    // Copy file
    await fs.copyFile(sourcePath, targetPath);
    
    // Update metadata for copied file
    const targetMetadata = await loadMetadata(userId, targetDirPath);
    const sourceMetadata = await loadMetadata(userId, sourceDirPath);
    
    if (sourceMetadata[itemName]) {
      // Copy metadata with new creation info
      targetMetadata[itemName] = {
        ...sourceMetadata[itemName],
        createdBy: user,
        createdAt: new Date().toISOString(),
        lastModifiedBy: user,
        lastModifiedAt: new Date().toISOString(),
      };
    } else {
      // Create new metadata for copied file
      targetMetadata[itemName] = {
        createdBy: user,
        createdAt: new Date().toISOString(),
        lastModifiedBy: user,
        lastModifiedAt: new Date().toISOString(),
      };
    }
    await saveMetadata(userId, targetDirPath, targetMetadata);
  }
}

export async function getItemPasswordInfo(
  userId: string,
  itemPath: string
): Promise<{
  passwordHash: string | null;
  type: 'file' | 'directory';
  createdBy?: { id: string; name: string; email: string };
} | null> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, itemPath);
  let stats;
  try {
    stats = await fs.stat(fullPath);
  } catch {
    return null;
  }
  const type = stats.isDirectory() ? 'directory' : 'file';
  const itemName = path.basename(itemPath);
  const relativeDir = path.dirname(itemPath);
  const dirPath = relativeDir === '.' ? '' : relativeDir;
  const metaStore = await loadMetadata(userId, dirPath);
  const entry = metaStore[itemName];
  return {
    passwordHash: entry?.passwordHash ?? null,
    type,
    createdBy: entry?.createdBy,
  };
}

export async function setItemPasswordHash(
  userId: string,
  itemPath: string,
  passwordHash: string | null,
  contextUser: { id: string; name: string; email: string }
): Promise<void> {
  const userDir = await ensureUserDirectory(userId);
  const fullPath = path.join(userDir, itemPath);
  await fs.access(fullPath);
  const itemName = path.basename(itemPath);
  const relativeDir = path.dirname(itemPath);
  const dirPath = relativeDir === '.' ? '' : relativeDir;
  const metadata = await loadMetadata(userId, dirPath);
  if (!metadata[itemName]) {
    metadata[itemName] = {
      createdBy: contextUser,
      createdAt: new Date().toISOString(),
    };
  }
  if (passwordHash === null) {
    delete metadata[itemName].passwordHash;
  } else {
    metadata[itemName].passwordHash = passwordHash;
  }
  await saveMetadata(userId, dirPath, metadata);
}
