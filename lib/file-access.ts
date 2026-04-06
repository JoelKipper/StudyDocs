import { findShareByToken, deleteShareByToken } from './local-store';

function norm(p: string): string {
  return p.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

/** Shared item is `root`; allowed paths are `root` or `root/...` for directory shares. */
export function isPathInShareScope(
  shareItemPath: string,
  shareItemType: 'file' | 'directory',
  requestedPath: string
): boolean {
  const root = norm(shareItemPath);
  const req = norm(requestedPath);
  if (shareItemType === 'file') {
    return req === root;
  }
  if (!root) {
    return true;
  }
  return req === root || req.startsWith(`${root}/`);
}

export interface ValidatedShare {
  ownerUserId: string;
  itemPath: string;
  itemType: 'file' | 'directory';
  token: string;
}

/**
 * Returns validated share or null. Deletes expired shares (30 days).
 */
export async function validateShareToken(token: string): Promise<ValidatedShare | null> {
  const share = await findShareByToken(token);
  if (!share) return null;

  const createdAt = new Date(share.created_at);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (createdAt < thirtyDaysAgo) {
    await deleteShareByToken(token);
    return null;
  }

  return {
    ownerUserId: share.user_id,
    itemPath: share.item_path,
    itemType: share.item_type,
    token,
  };
}
