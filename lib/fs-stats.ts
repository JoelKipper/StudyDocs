import fs from 'fs/promises';
import path from 'path';
import { ACCOUNTS_DIR } from './data-dir';

const METADATA_FILE = '.metadata.json';

export async function getGlobalFileStats(): Promise<{
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
}> {
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === METADATA_FILE) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        directoryCount++;
        await walk(p);
      } else if (e.isFile()) {
        fileCount++;
        const st = await fs.stat(p);
        totalBytes += st.size;
      }
    }
  }

  try {
    await fs.access(ACCOUNTS_DIR);
    await walk(ACCOUNTS_DIR);
  } catch {
    // no data yet
  }

  return { fileCount, directoryCount, totalBytes };
}

export async function countUserFilesAndBytes(userId: string): Promise<{
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
}> {
  const root = path.join(ACCOUNTS_DIR, userId);
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === METADATA_FILE) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        directoryCount++;
        await walk(p);
      } else if (e.isFile()) {
        fileCount++;
        const st = await fs.stat(p);
        totalBytes += st.size;
      }
    }
  }

  try {
    await fs.access(root);
    await walk(root);
  } catch {
    return { fileCount: 0, directoryCount: 0, totalBytes: 0 };
  }

  return { fileCount, directoryCount, totalBytes };
}
