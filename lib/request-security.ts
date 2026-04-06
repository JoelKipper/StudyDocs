import type { NextRequest } from 'next/server';

/**
 * Decide whether cookies should be marked `secure`.
 * - Behind reverse proxies, `x-forwarded-proto` is the most reliable.
 * - For LAN HTTP setups, we must allow non-secure cookies, otherwise browsers reject them.
 *
 * Set `FORCE_SECURE_COOKIES=true` to always require HTTPS.
 */
export function shouldUseSecureCookies(request: NextRequest): boolean {
  const forced = (process.env.FORCE_SECURE_COOKIES || '').toLowerCase() === 'true';
  if (forced) return true;

  const xfProto = request.headers.get('x-forwarded-proto');
  if (xfProto) {
    return xfProto.split(',')[0].trim().toLowerCase() === 'https';
  }

  // NextRequest.url will be http://... when accessed directly over http
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

