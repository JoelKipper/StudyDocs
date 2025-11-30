import * as nodeCrypto from 'crypto';
import { supabaseServer } from './supabase-server';
import { hashPassword } from './auth';
import { validatePassword } from './validation';

const RESET_TOKEN_EXPIRY_HOURS = 1; // Reset tokens expire after 1 hour
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000');

/**
 * Generate a secure reset token
 */
export function generateResetToken(): string {
  return nodeCrypto.randomBytes(32).toString('hex');
}

/**
 * Create a password reset token for a user
 */
export async function createResetToken(email: string): Promise<string | null> {
  // Find user by email
  const { data: user, error: userError } = await supabaseServer
    .from('users')
    .select('id, email, name')
    .eq('email', email.toLowerCase())
    .single();

  if (userError || !user) {
    // Don't reveal if user exists or not (security best practice)
    return null;
  }

  const token = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS);

  // Delete any existing unused tokens for this user
  await supabaseServer
    .from('password_reset_tokens')
    .delete()
    .eq('user_id', user.id)
    .is('used_at', null);

  // Insert new token
  const { error } = await supabaseServer
    .from('password_reset_tokens')
    .insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error('Error creating reset token:', error);
    return null;
  }

  return token;
}

/**
 * Verify a reset token and get user info
 */
export async function verifyResetToken(token: string): Promise<{ userId: string; email: string } | null> {
  // Find token
  const { data: tokenData, error: tokenError } = await supabaseServer
    .from('password_reset_tokens')
    .select('user_id, expires_at, used_at')
    .eq('token', token)
    .is('used_at', null)
    .single();

  if (tokenError || !tokenData) {
    return null;
  }

  // Check if token is expired
  if (new Date(tokenData.expires_at) < new Date()) {
    return null;
  }

  // Check if token is already used
  if (tokenData.used_at) {
    return null;
  }

  // Get user email
  const { data: userData, error: userError } = await supabaseServer
    .from('users')
    .select('id, email')
    .eq('id', tokenData.user_id)
    .single();

  if (userError || !userData) {
    return null;
  }

  return {
    userId: userData.id,
    email: userData.email,
  };
}

/**
 * Reset password using token
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  // Validate password
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.error };
  }

  // Verify token
  const tokenData = await verifyResetToken(token);
  if (!tokenData) {
    return { success: false, error: 'Ungültiger oder abgelaufener Reset-Link' };
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user password
  const { error: updateError } = await supabaseServer
    .from('users')
    .update({ password: hashedPassword })
    .eq('id', tokenData.userId);

  if (updateError) {
    console.error('Error updating password:', updateError);
    return { success: false, error: 'Fehler beim Zurücksetzen des Passworts' };
  }

  // Mark token as used
  await supabaseServer
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token);

  return { success: true };
}

/**
 * Generate password reset email HTML
 */
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
  } else {
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
}

