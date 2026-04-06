import * as nodeCrypto from 'crypto';
import {
  deleteEmailVerificationTokensForUser,
  insertEmailVerificationToken,
  findEmailVerificationToken,
  markEmailVerificationTokenUsed,
  updateUser,
  findUserById,
} from './local-store';

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export function generateVerificationToken(): string {
  return nodeCrypto.randomBytes(32).toString('hex');
}

export async function createVerificationToken(userId: string): Promise<string> {
  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS);

  await deleteEmailVerificationTokensForUser(userId);
  await insertEmailVerificationToken({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  const tokenData = await findEmailVerificationToken(token);
  if (!tokenData) {
    return null;
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    return null;
  }

  const userData = await findUserById(tokenData.user_id);
  if (!userData) {
    return null;
  }

  await markEmailVerificationTokenUsed(token);
  await updateUser(tokenData.user_id, { email_verified: true });

  return {
    userId: userData.id,
    email: userData.email,
  };
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
  language: 'de' | 'en' = 'de'
): Promise<void> {
  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;
  // Email body built for API route that sends via SMTP — kept for compatibility
  void verificationUrl;
  void email;
  void name;
  void language;
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const u = await findUserById(userId);
  return u?.email_verified === true;
}
