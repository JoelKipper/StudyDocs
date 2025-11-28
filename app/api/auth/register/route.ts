import { NextRequest, NextResponse } from 'next/server';
import { registerUser, createToken } from '@/lib/auth';
import { getSystemSettingBoolean } from '@/lib/system-settings';
import { cookies } from 'next/headers';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';
import { validateEmail, validatePassword, validateName, sanitizeString } from '@/lib/validation';
import { verifyRecaptcha } from '@/lib/captcha';

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

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return request.ip || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    // Check if registration is enabled
    const allowRegistration = await getSystemSettingBoolean('allow_registration', true);
    if (!allowRegistration) {
      return NextResponse.json({ error: 'Registrierung ist derzeit deaktiviert' }, { status: 403 });
    }

    const body = await request.json();
    const email = sanitizeString(body.email, 254);
    const password = body.password;
    const name = sanitizeString(body.name, 100);
    const recaptchaToken = body.recaptchaToken;
    
    // Check if reCAPTCHA is enabled
    const enableRecaptcha = await getSystemSettingBoolean('enable_recaptcha', true);
    
    // Verify reCAPTCHA if enabled and token is provided
    if (enableRecaptcha) {
      if (!recaptchaToken) {
        return NextResponse.json(
          { error: 'Sicherheitsprüfung erforderlich. Bitte versuchen Sie es erneut.' },
          { status: 400 }
        );
      }
      
      if (process.env.RECAPTCHA_SECRET_KEY) {
        const recaptchaResult = await verifyRecaptcha(recaptchaToken, process.env.RECAPTCHA_SECRET_KEY);
        if (!recaptchaResult.success) {
          return NextResponse.json(
            { error: 'Sicherheitsprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.' },
            { status: 400 }
          );
        }
        // Optional: Check score threshold (0.0 = bot, 1.0 = human)
        // Typically scores above 0.5 are considered human
        if (recaptchaResult.score !== undefined && recaptchaResult.score < 0.5) {
          return NextResponse.json(
            { error: 'Sicherheitsprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.' },
            { status: 400 }
          );
        }
      }
    }
    
    // Validate inputs
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
    }
    
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return NextResponse.json({ error: nameValidation.error }, { status: 400 });
    }
    
    // Check rate limit
    const ipAddress = getClientIp(request);
    const rateLimit = await checkRateLimit(ipAddress, 'register');
    if (!rateLimit.allowed) {
      const resetSeconds = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { 
          error: `Zu viele Registrierungsversuche. Bitte versuchen Sie es in ${Math.ceil(resetSeconds / 60)} Minuten erneut.`,
          retryAfter: resetSeconds
        },
        { 
          status: 429,
          headers: {
            'Retry-After': resetSeconds.toString(),
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          }
        }
      );
    }
    
    let user;
    try {
      user = await registerUser(email, password, name);
      
      // Send verification email after successful registration
      try {
        const { createVerificationToken } = await import('@/lib/email-verification');
        const token = await createVerificationToken(user.id);
        
        // Send email via our email API
        const emailResponse = await fetch(`${request.nextUrl.origin}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            subject: 'E-Mail-Adresse bestätigen - StudyDocs',
            html: await getVerificationEmailHtml(name, token, 'de'),
          }),
        });
        
        if (!emailResponse.ok) {
          console.error('Failed to send verification email, but user was created');
        }
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        // Don't fail registration if email fails
      }
    } catch (error: any) {
      // Record failed attempt for rate limiting
      await recordFailedAttempt(ipAddress, 'register');
      
      // Re-check rate limit after recording failure
      const updatedRateLimit = await checkRateLimit(ipAddress, 'register');
      
      // Return appropriate error
      if (error.message && error.message.includes('existiert bereits')) {
        return NextResponse.json(
          { error: error.message },
          {
            status: 400,
            headers: {
              'X-RateLimit-Limit': '3',
              'X-RateLimit-Remaining': updatedRateLimit.remaining.toString(),
              'X-RateLimit-Reset': updatedRateLimit.resetAt.toISOString(),
            }
          }
        );
      }
      
      return NextResponse.json(
        { error: error.message || 'Serverfehler' },
        {
          status: 500,
          headers: {
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': updatedRateLimit.remaining.toString(),
            'X-RateLimit-Reset': updatedRateLimit.resetAt.toISOString(),
          }
        }
      );
    }
    // Create new token (session regeneration for security)
    const token = await createToken(user);
    const cookieStore = await cookies();
    
    // Delete old token if exists (session regeneration - prevents session fixation)
    cookieStore.delete('auth-token');
    
    // Set new token
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 Tage
    });
    
    return NextResponse.json(
      { user, success: true },
      {
        headers: {
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        }
      }
    );
  } catch (error: any) {
    // Check if it's a known error (e.g., user already exists)
    if (error.message && error.message.includes('existiert bereits')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

