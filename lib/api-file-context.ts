import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { validateShareToken, type ValidatedShare, isPathInShareScope } from '@/lib/file-access';

export type FileAccessMode =
  | { mode: 'owner'; userId: string }
  | { mode: 'share'; ownerUserId: string; share: ValidatedShare; readOnly: true };

export async function resolveFileAccess(shareToken: string | null): Promise<
  | { ok: true; access: FileAccessMode }
  | { ok: false; status: number; message: string }
> {
  if (shareToken) {
    const v = await validateShareToken(shareToken);
    if (!v) {
      return { ok: false, status: 403, message: 'Ungültiger oder abgelaufener Share-Link' };
    }
    return {
      ok: true,
      access: {
        mode: 'share',
        ownerUserId: v.ownerUserId,
        share: v,
        readOnly: true,
      },
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, message: 'Nicht authentifiziert' };
  }
  return { ok: true, access: { mode: 'owner', userId: user.id } };
}

export function getEffectiveUserId(access: FileAccessMode): string {
  return access.mode === 'owner' ? access.userId : access.ownerUserId;
}

/**
 * Normalizes `path` query for share mode (default to share root when empty).
 */
export function resolveListingPath(access: FileAccessMode, requestedPath: string): string {
  if (access.mode === 'owner') {
    return requestedPath;
  }
  if (requestedPath) {
    return requestedPath;
  }
  if (access.share.itemType === 'directory') {
    return access.share.itemPath;
  }
  const p = access.share.itemPath;
  const d = path.dirname(p);
  return d === '.' ? '' : d;
}

export function assertPathInShare(access: FileAccessMode, itemPath: string): boolean {
  if (access.mode === 'owner') {
    return true;
  }
  return isPathInShareScope(access.share.itemPath, access.share.itemType, itemPath);
}
