import { supabaseServer } from './supabase-server';
import path from 'path';

const STORAGE_BUCKET = 'files'; // Name of the Supabase Storage bucket

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
  isPasswordProtected?: boolean;
}

interface FileMetadataRow {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number | null;
  storage_path: string | null;
  created_by: string | null;
  created_at: string;
  last_modified_by: string | null;
  last_modified_at: string | null;
  renamed_by: string | null;
  renamed_at: string | null;
  parent_path: string | null;
  password_hash: string | null;
}

// Helper to normalize paths for Supabase Storage
// Supabase Storage requires:
// - No leading/trailing slashes
// - No double slashes
// - No empty segments
// - Valid UTF-8 characters
function normalizePath(filePath: string): string {
  if (!filePath) return '';
  
  // Remove leading/trailing slashes
  let normalized = filePath.replace(/^\/+|\/+$/g, '');
  
  // Replace multiple slashes with single slash
  normalized = normalized.replace(/\/+/g, '/');
  
  // Remove empty segments (double slashes after normalization)
  const parts = normalized.split('/').filter(part => part.length > 0);
  
  // Join parts back together
  normalized = parts.join('/');
  
  return normalized;
}

// Helper to sanitize storage path (for Supabase Storage API)
// Supabase Storage has issues with certain characters, so we need to sanitize the path
// This function replaces problematic characters while keeping the path readable
function sanitizeStoragePath(filePath: string): string {
  if (!filePath) return '';
  
  // First normalize the path (remove leading/trailing slashes, etc.)
  let normalized = normalizePath(filePath);
  
  // Split into segments to sanitize each part separately
  const segments = normalized.split('/').filter(seg => seg.length > 0);
  
  // Sanitize each segment
  const sanitizedSegments = segments.map(segment => {
    // Replace spaces with underscores (Supabase Storage can have issues with spaces)
    let sanitized = segment.replace(/\s+/g, '_');
    
    // Normalize German umlauts and special characters
    sanitized = sanitized
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae')
      .replace(/Ö/g, 'Oe')
      .replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      .replace(/é/g, 'e')
      .replace(/è/g, 'e')
      .replace(/ê/g, 'e')
      .replace(/ë/g, 'e')
      .replace(/à/g, 'a')
      .replace(/á/g, 'a')
      .replace(/â/g, 'a')
      .replace(/ã/g, 'a')
      .replace(/ç/g, 'c')
      .replace(/ñ/g, 'n')
      .replace(/í/g, 'i')
      .replace(/ì/g, 'i')
      .replace(/î/g, 'i')
      .replace(/ó/g, 'o')
      .replace(/ò/g, 'o')
      .replace(/ô/g, 'o')
      .replace(/õ/g, 'o')
      .replace(/ú/g, 'u')
      .replace(/ù/g, 'u')
      .replace(/û/g, 'u');
    
    // Remove any remaining non-ASCII characters except dots, hyphens, underscores
    // Keep alphanumeric, dots, hyphens, underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Remove multiple consecutive underscores
    sanitized = sanitized.replace(/_+/g, '_');
    
    // Remove leading/trailing underscores
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    
    return sanitized;
  });
  
  // Join segments back together
  normalized = sanitizedSegments.join('/');
  
  // Ensure no control characters
  normalized = normalized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return normalized;
}

// Helper to normalize storage path (for Supabase Storage API)
// This is a wrapper that uses sanitizeStoragePath
function normalizeStoragePath(filePath: string): string {
  return sanitizeStoragePath(filePath);
}

// Helper to get parent path
function getParentPath(filePath: string): string | null {
  const normalized = normalizePath(filePath);
  if (!normalized) return null;
  const parts = normalized.split('/');
  parts.pop();
  return parts.length > 0 ? parts.join('/') : null;
}

// Load user info for metadata
async function getUserInfo(userId: string): Promise<{ id: string; name: string; email: string } | null> {
  const { data, error } = await supabaseServer
    .from('users')
    .select('id, name, email')
    .eq('id', userId)
    .single();
  
  if (error || !data) return null;
  return { id: data.id, name: data.name, email: data.email };
}

// Convert database row to FileItem
async function rowToFileItem(row: FileMetadataRow): Promise<FileItem> {
  const metadata: FileMetadata | undefined = row.created_by ? {
    createdBy: await getUserInfo(row.created_by) || { id: row.created_by, name: '', email: '' },
    createdAt: row.created_at,
    lastModifiedBy: row.last_modified_by ? (await getUserInfo(row.last_modified_by) || undefined) : undefined,
    lastModifiedAt: row.last_modified_at || undefined,
    renamedBy: row.renamed_by ? (await getUserInfo(row.renamed_by) || undefined) : undefined,
    renamedAt: row.renamed_at || undefined,
  } : undefined;

  return {
    name: row.name,
    path: row.path,
    type: row.type,
    size: row.size || undefined,
    modified: row.last_modified_at ? new Date(row.last_modified_at) : new Date(row.created_at),
    metadata,
    isPasswordProtected: !!row.password_hash,
  };
}

export async function getDirectoryContents(dirPath: string = ''): Promise<FileItem[]> {
  const normalizedPath = normalizePath(dirPath);
  const parentPath = normalizedPath || null;
  
  try {
    // Handle root directory (parent_path is null) vs subdirectories
    let query;
    if (parentPath === null) {
      query = supabaseServer.from('file_metadata').select('*').is('parent_path', null);
    } else {
      query = supabaseServer.from('file_metadata').select('*').eq('parent_path', parentPath);
    }
    
    const { data, error } = await query
      .order('type', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error loading directory contents:', error);
      // Provide more helpful error messages
      if (error.message?.includes('Invalid API key') || error.message?.includes('Invalid key')) {
        console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY ist ungültig oder fehlt!');
        console.error('Bitte prüfe:');
        console.error('1. Ist SUPABASE_SERVICE_ROLE_KEY in .env.local gesetzt?');
        console.error('2. Ist es der service_role Key (nicht der anon Key)?');
        console.error('3. Wurde der Server nach dem Hinzufügen neu gestartet?');
        console.error('4. Gibt es Leerzeichen oder Zeilenumbrüche im Key?');
      }
      return [];
    }
    
    if (!data) return [];
    
    // Convert rows to FileItems
    const items = await Promise.all(data.map(row => rowToFileItem(row)));
    
    // For directories, calculate size by summing children
    for (const item of items) {
      if (item.type === 'directory') {
        item.size = await calculateDirectorySize(item.path);
      }
    }
    
    return items;
  } catch (error) {
    console.error('Error in getDirectoryContents:', error);
    return [];
  }
}

async function calculateDirectorySize(dirPath: string): Promise<number> {
  const normalizedPath = normalizePath(dirPath);
  
  try {
    // Get all files recursively - start with direct children
    let totalSize = 0;
    
    // Get direct children first
    const { data: children, error: childrenError } = await supabaseServer
      .from('file_metadata')
      .select('size, type, path')
      .eq('parent_path', normalizedPath);
    
    if (childrenError || !children) return 0;
    
    // Sum up file sizes and recursively calculate directory sizes
    for (const item of children) {
      if (item.type === 'file' && item.size) {
        totalSize += item.size;
      } else if (item.type === 'directory') {
        // Recursively calculate size of subdirectory
        totalSize += await calculateDirectorySize(item.path);
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error calculating directory size:', error);
    return 0;
  }
}

export async function createDirectory(dirPath: string, user: { id: string; name: string; email: string }): Promise<void> {
  const normalizedPath = normalizePath(dirPath);
  const parentPath = getParentPath(normalizedPath);
  const name = path.basename(normalizedPath);
  
  // Check if directory already exists
  const { data: existing } = await supabaseServer
    .from('file_metadata')
    .select('id')
    .eq('path', normalizedPath)
    .maybeSingle();
  
  if (existing) {
    // Directory already exists, return silently
    return;
  }
  
  // If parent path exists, ensure it's created first (recursively)
  if (parentPath) {
    try {
      await createDirectory(parentPath, user);
    } catch (error) {
      // Ignore errors from parent creation (might already exist)
    }
  }
  
  const { error } = await supabaseServer
    .from('file_metadata')
    .insert({
      path: normalizedPath,
      name: name,
      type: 'directory',
      size: 0,
      parent_path: parentPath || null,
      created_by: user.id,
    });
  
  if (error) {
    // If error is "duplicate key" or similar, directory might have been created concurrently
    // Check again if it exists now
    const { data: checkAgain } = await supabaseServer
      .from('file_metadata')
      .select('id')
      .eq('path', normalizedPath)
      .maybeSingle();
    
    if (checkAgain) {
      // Directory exists now, return silently
      return;
    }
    
    console.error('Error creating directory:', error);
    throw new Error('Fehler beim Erstellen des Verzeichnisses');
  }
}

export async function saveFile(
  filePath: string,
  buffer: Buffer,
  user: { id: string; name: string; email: string }
): Promise<void> {
  const normalizedPath = normalizePath(filePath);
  const parentPath = getParentPath(normalizedPath);
  const fileName = path.basename(normalizedPath);
  
  // Upload file to Supabase Storage
  // Use normalized path for storage (Supabase Storage accepts UTF-8 paths)
  const storagePath = normalizeStoragePath(normalizedPath);
  
  // Validate storage path
  if (!storagePath || storagePath.length === 0) {
    throw new Error('Ungültiger Dateipfad');
  }
  
  // Debug: Log the storage path being used
  console.log('Uploading file to storage path:', storagePath);
  console.log('Original normalized path:', normalizedPath);
  
  // Check for invalid characters that Supabase Storage doesn't accept
  // Supabase Storage doesn't allow certain control characters
  if (/[\x00-\x1F\x7F]/.test(storagePath)) {
    throw new Error('Dateipfad enthält ungültige Zeichen');
  }
  
  const { error: uploadError } = await supabaseServer.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/octet-stream',
      upsert: true,
    });
  
  if (uploadError) {
    console.error('Error uploading file to storage:', uploadError);
    
    // Spezifische Fehlermeldung für "Bucket not found"
    if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket not found')) {
      throw new Error(
        'Storage Bucket "files" wurde nicht gefunden. ' +
        'Bitte erstelle den Bucket im Supabase Dashboard (Storage > New bucket) oder führe das SQL in "create-bucket.sql" aus. ' +
        'Siehe BUCKET_FIX.md für Anweisungen.'
      );
    }
    
    throw new Error(`Fehler beim Hochladen der Datei: ${uploadError.message || 'Unbekannter Fehler. Bitte prüfe die Server-Logs.'}`);
  }
  
  // Check if file metadata exists
  const { data: existing } = await supabaseServer
    .from('file_metadata')
    .select('id, created_by, created_at, storage_path')
    .eq('path', normalizedPath)
    .single();
  
  if (existing) {
    // Update existing file
    // Also update storage_path in case it changed (e.g., after sanitization)
    const { error } = await supabaseServer
      .from('file_metadata')
      .update({
        size: buffer.length,
        storage_path: storagePath,
        last_modified_by: user.id,
        last_modified_at: new Date().toISOString(),
      })
      .eq('path', normalizedPath);
    
    if (error) {
      console.error('Error updating file metadata:', error);
      throw new Error('Fehler beim Aktualisieren der Datei-Metadaten');
    }
  } else {
    // Insert new file metadata
    const { error } = await supabaseServer
      .from('file_metadata')
      .insert({
        path: normalizedPath,
        name: fileName,
        type: 'file',
        size: buffer.length,
        storage_path: storagePath,
        parent_path: parentPath,
        created_by: user.id,
      });
    
    if (error) {
      console.error('Error inserting file metadata:', error);
      throw new Error('Fehler beim Speichern der Datei-Metadaten');
    }
  }
}

export async function getFile(filePath: string): Promise<Buffer> {
  const normalizedPath = normalizePath(filePath);
  
  // Get file metadata to retrieve the actual storage_path
  const { data: fileMetadata, error: metadataError } = await supabaseServer
    .from('file_metadata')
    .select('storage_path')
    .eq('path', normalizedPath)
    .single();
  
  if (metadataError || !fileMetadata) {
    throw new Error(`Datei nicht gefunden: ${metadataError?.message || 'Unbekannter Fehler'}`);
  }
  
  // Use the storage_path from database, or fallback to normalized path if not set
  const storagePath = fileMetadata.storage_path || normalizeStoragePath(normalizedPath);
  
  const { data, error } = await supabaseServer.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);
  
  if (error || !data) {
    throw new Error(`Datei nicht gefunden: ${error?.message || 'Unbekannter Fehler'}`);
  }
  
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteItem(itemPath: string): Promise<void> {
  const normalizedPath = normalizePath(itemPath);
  
  // Get item info
  const { data: item, error: fetchError } = await supabaseServer
    .from('file_metadata')
    .select('type, path, storage_path')
    .eq('path', normalizedPath)
    .single();
  
  if (fetchError || !item) {
    throw new Error('Element nicht gefunden');
  }
  
  if (item.type === 'directory') {
    // Delete all children recursively
    const { data: children } = await supabaseServer
      .from('file_metadata')
      .select('path, type')
      .eq('parent_path', normalizedPath);
    
    if (children) {
      for (const child of children) {
        await deleteItem(child.path);
      }
    }
    
    // Delete directory metadata
    const { error } = await supabaseServer
      .from('file_metadata')
      .delete()
      .eq('path', normalizedPath);
    
    if (error) {
      console.error('Error deleting directory metadata:', error);
      throw new Error(`Fehler beim Löschen des Verzeichnisses: ${error.message || 'Unbekannter Fehler'}`);
    }
  } else {
    // Delete file from storage
    // Use storage_path from database, or fallback to normalized path
    const storagePath = item.storage_path || normalizeStoragePath(normalizedPath);
    const { error: storageError } = await supabaseServer.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);
    
    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // Continue with metadata deletion even if storage deletion fails
    }
    
    // Delete file metadata
    const { error } = await supabaseServer
      .from('file_metadata')
      .delete()
      .eq('path', normalizedPath);
    
    if (error) {
      console.error('Error deleting file metadata:', error);
      throw new Error(`Fehler beim Löschen der Datei: ${error.message || 'Unbekannter Fehler'}`);
    }
  }
}

export async function renameItem(
  itemPath: string,
  newName: string,
  user: { id: string; name: string; email: string }
): Promise<void> {
  const normalizedPath = normalizePath(itemPath);
  const parentPath = getParentPath(normalizedPath);
  const newPath = parentPath ? `${parentPath}/${newName}` : newName;
  const normalizedNewPath = normalizePath(newPath);
  
  // Get item info
  const { data: item, error: fetchError } = await supabaseServer
    .from('file_metadata')
    .select('*')
    .eq('path', normalizedPath)
    .single();
  
  if (fetchError || !item) {
    throw new Error('Element nicht gefunden');
  }
  
  // Check if new name already exists
  const { data: existing } = await supabaseServer
    .from('file_metadata')
    .select('id')
    .eq('path', normalizedNewPath)
    .single();
  
  if (existing) {
    throw new Error('Ein Element mit diesem Namen existiert bereits');
  }
  
  if (item.type === 'file') {
    // Rename file in storage
    // Use storage_path from database, or fallback to normalized path
    const oldStoragePath = item.storage_path || normalizeStoragePath(normalizedPath);
    const newStoragePath = normalizeStoragePath(normalizedNewPath);
    const { error: storageError } = await supabaseServer.storage
      .from(STORAGE_BUCKET)
      .move(oldStoragePath, newStoragePath);
    
    if (storageError) {
      console.error('Error renaming file in storage:', storageError);
      throw new Error(`Fehler beim Umbenennen der Datei im Storage: ${storageError.message || 'Unbekannter Fehler'}`);
    }
  } else {
    // For directories, update all children paths
    const { data: children } = await supabaseServer
      .from('file_metadata')
      .select('path, type, storage_path')
      .like('path', `${normalizedPath}/%`);
    
    if (children) {
      for (const child of children) {
        const newChildPath = child.path.replace(normalizedPath, normalizedNewPath);
        
        // Prepare update data
        const updateData: any = {
          path: newChildPath,
          parent_path: getParentPath(newChildPath),
        };
        
        // For files, also update storage_path
        if (child.type === 'file') {
          const oldChildStoragePath = child.storage_path || normalizeStoragePath(child.path);
          const newChildStoragePath = normalizeStoragePath(newChildPath);
          updateData.storage_path = newChildStoragePath;
          
          // Move file in storage
          const { error: moveError } = await supabaseServer.storage
            .from(STORAGE_BUCKET)
            .move(oldChildStoragePath, newChildStoragePath);
          
          if (moveError) {
            console.error('Error moving child file in storage:', moveError);
          }
        }
        
        const { error: updateError } = await supabaseServer
          .from('file_metadata')
          .update(updateData)
          .eq('path', child.path);
        
        if (updateError) {
          console.error('Error updating child path:', updateError);
        }
      }
    }
  }
  
  // Update metadata
  const updateData: any = {
    path: normalizedNewPath,
    name: newName,
    parent_path: parentPath,
    renamed_by: user.id,
    renamed_at: new Date().toISOString(),
  };
  
  // For files, also update storage_path
  if (item.type === 'file') {
    const newStoragePath = normalizeStoragePath(normalizedNewPath);
    updateData.storage_path = newStoragePath;
  }
  
  const { error } = await supabaseServer
    .from('file_metadata')
    .update(updateData)
    .eq('path', normalizedPath);
  
  if (error) {
    console.error('Error updating metadata:', error);
    throw new Error(`Fehler beim Aktualisieren der Metadaten: ${error.message || 'Unbekannter Fehler'}`);
  }
}

export async function moveItem(itemPath: string, targetPath: string): Promise<void> {
  const normalizedPath = normalizePath(itemPath);
  const normalizedTargetPath = normalizePath(targetPath);
  const itemName = path.basename(normalizedPath);
  const newPath = normalizedTargetPath ? `${normalizedTargetPath}/${itemName}` : itemName;
  const normalizedNewPath = normalizePath(newPath);
  
  // Get item info
  const { data: item, error: fetchError } = await supabaseServer
    .from('file_metadata')
    .select('*')
    .eq('path', normalizedPath)
    .single();
  
  if (fetchError || !item) {
    throw new Error('Element nicht gefunden');
  }
  
  // Check if target already exists
  const { data: existing } = await supabaseServer
    .from('file_metadata')
    .select('id')
    .eq('path', normalizedNewPath)
    .single();
  
  if (existing) {
    throw new Error('Ein Element mit diesem Namen existiert bereits im Zielverzeichnis');
  }
  
  // Update paths for item and all children
  const pathPrefix = normalizedPath;
  const newPathPrefix = normalizedNewPath;
  
  if (item.type === 'file') {
    // Move file in storage
    // Use storage_path from database, or fallback to normalized path
    const oldStoragePath = item.storage_path || normalizeStoragePath(normalizedPath);
    const newStoragePath = normalizeStoragePath(normalizedNewPath);
    const { error: storageError } = await supabaseServer.storage
      .from(STORAGE_BUCKET)
      .move(oldStoragePath, newStoragePath);
    
    if (storageError) {
      console.error('Error moving file in storage:', storageError);
      throw new Error(`Fehler beim Verschieben der Datei: ${storageError.message || 'Unbekannter Fehler'}`);
    }
  } else {
    // For directories, update all children
    // Get all children recursively
    const { data: allChildren } = await supabaseServer
      .from('file_metadata')
      .select('path, type, storage_path')
      .or(`path.eq.${normalizedPath},path.like.${normalizedPath}/%`);
    
    if (allChildren) {
      // Sort by path length to process children before parents
      const sortedChildren = allChildren
        .filter(child => child.path !== normalizedPath) // Exclude the directory itself
        .sort((a, b) => b.path.length - a.path.length); // Process deepest first
      
      for (const child of sortedChildren) {
        const newChildPath = child.path.replace(pathPrefix, newPathPrefix);
        
        // Prepare update data
        const updateData: any = {
          path: newChildPath,
          parent_path: getParentPath(newChildPath),
        };
        
        // For files, also update storage_path
        if (child.type === 'file') {
          const oldChildStoragePath = child.storage_path || normalizeStoragePath(child.path);
          const newChildStoragePath = normalizeStoragePath(newChildPath);
          updateData.storage_path = newChildStoragePath;
          
          // Move file in storage
          const { error: moveError } = await supabaseServer.storage
            .from(STORAGE_BUCKET)
            .move(oldChildStoragePath, newChildStoragePath);
          
          if (moveError) {
            console.error('Error moving child file in storage:', moveError);
          }
        }
        
        const { error: updateError } = await supabaseServer
          .from('file_metadata')
          .update(updateData)
          .eq('path', child.path);
        
        if (updateError) {
          console.error('Error updating child path:', updateError);
        }
      }
    }
  }
  
  // Update item metadata
  const updateData: any = {
    path: normalizedNewPath,
    parent_path: normalizedTargetPath || null,
  };
  
  // For files, also update storage_path
  if (item.type === 'file') {
    const newStoragePath = normalizeStoragePath(normalizedNewPath);
    updateData.storage_path = newStoragePath;
  }
  
  const { error } = await supabaseServer
    .from('file_metadata')
    .update(updateData)
    .eq('path', normalizedPath);
  
  if (error) {
    console.error('Error updating metadata:', error);
    throw new Error(`Fehler beim Aktualisieren der Metadaten: ${error.message || 'Unbekannter Fehler'}`);
  }
}

export async function copyItem(itemPath: string, targetPath: string, user: { id: string; name: string; email: string }): Promise<void> {
  const normalizedPath = normalizePath(itemPath);
  const normalizedTargetPath = normalizePath(targetPath);
  const itemName = path.basename(normalizedPath);
  const newPath = normalizedTargetPath ? `${normalizedTargetPath}/${itemName}` : itemName;
  const normalizedNewPath = normalizePath(newPath);
  
  // Get item info
  const { data: item, error: fetchError } = await supabaseServer
    .from('file_metadata')
    .select('*')
    .eq('path', normalizedPath)
    .single();
  
  if (fetchError || !item) {
    throw new Error('Element nicht gefunden');
  }
  
  if (item.type === 'file') {
    // Download file
    const buffer = await getFile(normalizedPath);
    
    // Upload as new file
    await saveFile(normalizedNewPath, buffer, user);
  } else {
    // For directories, create directory and copy all children
    await createDirectory(normalizedNewPath, user);
    
    const { data: children } = await supabaseServer
      .from('file_metadata')
      .select('path, type')
      .eq('parent_path', normalizedPath);
    
    if (children) {
      for (const child of children) {
        await copyItem(child.path, normalizedNewPath, user);
      }
    }
  }
}

export async function calculateStorageUsed(): Promise<number> {
  try {
    const { data, error } = await supabaseServer
      .from('file_metadata')
      .select('size')
      .eq('type', 'file');
    
    if (error || !data) return 0;
    
    return data.reduce((sum, item) => sum + (item.size || 0), 0);
  } catch (error) {
    console.error('Error calculating storage:', error);
    return 0;
  }
}

