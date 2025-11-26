import { NextRequest, NextResponse } from 'next/server';
import { loginUser, createToken, isIpBlocked } from '@/lib/auth';
import { getSystemSettingBoolean } from '@/lib/system-settings';
import { cookies } from 'next/headers';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';
import { validateEmail, sanitizeString } from '@/lib/validation';
import { verifyRecaptcha } from '@/lib/captcha';

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
    // Check if login is enabled
    const allowLogin = await getSystemSettingBoolean('allow_login', true);
    if (!allowLogin) {
      return NextResponse.json({ error: 'Login ist derzeit deaktiviert' }, { status: 403 });
    }

    const body = await request.json();
    const email = sanitizeString(body.email, 254);
    const password = body.password;
    const recaptchaToken = body.recaptchaToken;
    
    // Verify reCAPTCHA if token is provided
    if (recaptchaToken && process.env.RECAPTCHA_SECRET_KEY) {
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
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }
    
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Passwort ist erforderlich' }, { status: 400 });
    }
    
    // Check if IP is blocked
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    const blocked = await isIpBlocked(ipAddress);
    
    if (blocked) {
      return NextResponse.json({ error: 'Ihre IP-Adresse wurde gesperrt' }, { status: 403 });
    }
    
    // Check rate limit
    const rateLimit = await checkRateLimit(ipAddress, 'login');
    if (!rateLimit.allowed) {
      const resetSeconds = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { 
          error: `Zu viele Login-Versuche. Bitte versuchen Sie es in ${Math.ceil(resetSeconds / 60)} Minuten erneut.`,
          retryAfter: resetSeconds
        },
        { 
          status: 429,
          headers: {
            'Retry-After': resetSeconds.toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          }
        }
      );
    }
    
    const user = await loginUser(email, password, ipAddress, userAgent);
    if (!user) {
      // Record failed attempt for rate limiting
      await recordFailedAttempt(ipAddress, 'login');
      
      // Re-check rate limit after recording failure
      const updatedRateLimit = await checkRateLimit(ipAddress, 'login');
      
      return NextResponse.json(
        { error: 'Ungültige Anmeldedaten' },
        { 
          status: 401,
          headers: {
            'X-RateLimit-Limit': '5',
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
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        }
      }
    );
  } catch (error: any) {
    // Don't expose error details in production
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}

