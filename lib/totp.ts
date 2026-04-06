import crypto from 'crypto';

// Minimal Base32 decode (RFC 4648) for TOTP secrets used by Microsoft Authenticator.
function base32ToBuffer(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(out);
}

function hotp(key: Buffer, counter: number, digits: number): string {
  const buf = Buffer.alloc(8);
  // big-endian counter
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, '0');
}

export function isTotpEnabled(): boolean {
  return !!process.env.AUTH_TOTP_SECRET;
}

export function verifyTotpCode(code: string, opts?: { nowMs?: number }): boolean {
  const secret = process.env.AUTH_TOTP_SECRET || '';
  if (!secret) return false;

  const digits = 6;
  const stepSeconds = 30;
  const window = Math.max(0, parseInt(process.env.AUTH_TOTP_WINDOW || '1', 10) || 1);

  const cleaned = (code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;

  const key = base32ToBuffer(secret);
  const now = opts?.nowMs ?? Date.now();
  const counter = Math.floor(now / 1000 / stepSeconds);

  for (let w = -window; w <= window; w++) {
    if (hotp(key, counter + w, digits) === cleaned) {
      return true;
    }
  }

  return false;
}

