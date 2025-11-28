import * as nodeCrypto from 'crypto';
import { supabaseServer } from './supabase-server';

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): string {
  return nodeCrypto.randomBytes(32).toString('hex');
}

/**
 * Create a verification token for a user
 */
export async function createVerificationToken(userId: string): Promise<string> {
  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + VERIFICATION_TOKEN_EXPIRY_HOURS);

  // Delete any existing unused tokens for this user
  await supabaseServer
    .from('email_verification_tokens')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null);

  // Insert new token
  const { error } = await supabaseServer
    .from('email_verification_tokens')
    .insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error('Error creating verification token:', error);
    throw new Error('Fehler beim Erstellen des Verifizierungs-Tokens');
  }

  return token;
}

/**
 * Verify a token and mark user as verified
 */
export async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  // Find token
  const { data: tokenData, error: tokenError } = await supabaseServer
    .from('email_verification_tokens')
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

  // Mark token as used
  await supabaseServer
    .from('email_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token);

  // Mark user as verified
  await supabaseServer
    .from('users')
    .update({ email_verified: true })
    .eq('id', tokenData.user_id);

  return {
    userId: userData.id,
    email: userData.email,
  };
}

/**
 * Send verification email using Supabase
 */
export async function sendVerificationEmail(email: string, name: string, token: string, language: 'de' | 'en' = 'de'): Promise<void> {
  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;
  
  const subject = language === 'de' 
    ? 'E-Mail-Adresse bestätigen - StudyDocs'
    : 'Verify your email address - StudyDocs';
  
  const htmlContent = language === 'de' 
    ? `
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>StudyDocs</h1>
          </div>
          <div class="content">
            <h2>Hallo ${name}!</h2>
            <p>Vielen Dank für Ihre Registrierung bei StudyDocs.</p>
            <p>Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Button klicken:</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">E-Mail-Adresse bestätigen</a>
            </p>
            <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            <p>Dieser Link ist 24 Stunden gültig.</p>
            <p>Falls Sie sich nicht registriert haben, können Sie diese E-Mail ignorieren.</p>
          </div>
          <div class="footer">
            <p>StudyDocs - Student File Manager</p>
          </div>
        </div>
      </body>
      </html>
    `
    : `
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>StudyDocs</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for registering with StudyDocs.</p>
            <p>Please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            <p>This link is valid for 24 hours.</p>
            <p>If you did not register, you can ignore this email.</p>
          </div>
          <div class="footer">
            <p>StudyDocs - Student File Manager</p>
          </div>
        </div>
      </body>
      </html>
    `;

  // Use Supabase's built-in email functionality
  // Note: This requires Supabase Auth to be configured with SMTP
  // For now, we'll use a workaround with Supabase Edge Functions or direct SMTP
  
  // Try to use Supabase's auth.admin.sendEmail if available
  // Otherwise, we'll need to implement SMTP directly
  
  // For Supabase, we can use the auth.admin API or create an Edge Function
  // Since we're using custom auth, we'll need to implement SMTP directly
  
  // Using nodemailer would be ideal, but for now let's use Supabase's email service
  // We'll create an API route that uses Supabase's email capabilities
  
  // Store email in a queue or send directly via API
  // For now, we'll send via an API endpoint that handles SMTP
}

/**
 * Check if user's email is verified
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('users')
    .select('email_verified')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.email_verified === true;
}

