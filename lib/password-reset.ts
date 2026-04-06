import * as nodeCrypto from 'crypto';
import {
  findUserByEmail,
  deletePasswordResetTokensForUser,
  insertPasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUser,
  findUserById,
} from './local-store';
import { hashPassword } from './auth';
import { validatePassword } from './validation';

const RESET_TOKEN_EXPIRY_HOURS = 1;

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export function generateResetToken(): string {
  return nodeCrypto.randomBytes(32).toString('hex');
}

export async function createResetToken(email: string): Promise<string | null> {
  const user = await findUserByEmail(email.toLowerCase());
  if (!user) {
    return null;
  }

  const token = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS);

  await deletePasswordResetTokensForUser(user.id);
  await insertPasswordResetToken({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function verifyResetToken(token: string): Promise<{ userId: string; email: string } | null> {
  const tokenData = await findPasswordResetToken(token);
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

  return {
    userId: userData.id,
    email: userData.email,
  };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.error };
  }

  const tokenData = await verifyResetToken(token);
  if (!tokenData) {
    return { success: false, error: 'Ungültiger oder abgelaufener Reset-Link' };
  }

  const hashedPassword = await hashPassword(newPassword);
  await updateUser(tokenData.userId, { password: hashedPassword });
  await markPasswordResetTokenUsed(token);

  return { success: true };
}

export function getPasswordResetEmailHtml(name: string, token: string, language: 'de' | 'en' = 'de'): string {
  const resetUrl = `${BASE_URL}/reset-password?token=${token}`;

  if (language === 'de') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>StudyDocs</h1>
          </div>
          <div class="content">
            <h2>Hallo ${name}!</h2>
            <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
            <p>Klicken Sie auf den folgenden Button, um ein neues Passwort festzulegen:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Passwort zurücksetzen</a>
            </p>
            <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            <div class="warning">
              <strong>Wichtig:</strong> Dieser Link ist nur 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
            </div>
          </div>
          <div class="footer">
            <p>StudyDocs - Student File Manager</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>StudyDocs</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>You have requested to reset your password.</p>
            <p>Click the button below to set a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            <div class="warning">
              <strong>Important:</strong> This link is only valid for 1 hour. If you did not request this, you can ignore this email.
            </div>
          </div>
          <div class="footer">
            <p>StudyDocs - Student File Manager</p>
          </div>
        </div>
      </body>
      </html>
    `;
}
