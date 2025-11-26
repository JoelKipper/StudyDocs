import { NextRequest, NextResponse } from 'next/server';
import { registerUser, createToken } from '@/lib/auth';
import { getSystemSettingBoolean } from '@/lib/system-settings';
import { cookies } from 'next/headers';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';
import { validateEmail, validatePassword, validateName, sanitizeString } from '@/lib/validation';

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
    const token = await createToken(user);
    const cookieStore = await cookies();
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

