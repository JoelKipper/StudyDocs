import path from 'path';

/** Root for all app data (accounts, JSON stores). Override with DATA_DIR on NAS/Docker. */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'user-data');

export const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');
