import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createVerificationToken, sendVerificationEmail } from '@/lib/email-verification';
import { findUserById } from '@/lib/local-store';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const userData = await findUserById(user.id);

    if (!userData) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    if (userData.email_verified) {
      return NextResponse.json({ error: 'E-Mail-Adresse ist bereits verifiziert' }, { status: 400 });
    }

    // Create verification token
    const token = await createVerificationToken(user.id);

    // Get language from request or default to 'de'
    const body = await request.json().catch(() => ({}));
    const language = (body.language as 'de' | 'en') || 'de';

    // Send verification email via our email API
    const emailResponse = await fetch(`${request.nextUrl.origin}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: userData.email,
        subject: language === 'de' 
          ? 'E-Mail-Adresse bestätigen - StudyDocs'
          : 'Verify your email address - StudyDocs',
        html: await getVerificationEmailHtml(userData.name, token, language),
      }),
    });

    if (!emailResponse.ok) {
      console.error('Failed to send verification email');
      return NextResponse.json(
        { error: 'Fehler beim Senden der Verifizierungs-E-Mail' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: language === 'de' 
        ? 'Verifizierungs-E-Mail wurde gesendet'
        : 'Verification email has been sent'
    });
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

async function getVerificationEmailHtml(name: string, token: string, language: 'de' | 'en'): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  
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
  }
}

