import { NextRequest, NextResponse } from 'next/server';
import { createResetToken, getPasswordResetEmailHtml } from '@/lib/password-reset';
import { validateEmail, sanitizeString } from '@/lib/validation';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Request password reset - sends reset email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = sanitizeString(body.email, 254);
    const language = (body.language as 'de' | 'en') || 'de';

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }

    // Create reset token (returns null if user doesn't exist - security best practice)
    const token = await createResetToken(email);
    
    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we return the same response
    if (!token) {
      // User doesn't exist, but we don't reveal this
      return NextResponse.json({
        success: true,
        message: language === 'de' 
          ? 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.'
          : 'If an account with this email exists, a reset link has been sent.'
      });
    }

    // Get user info for email
    const { data: user } = await supabaseServer
      .from('users')
      .select('id, email, name')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) {
      return NextResponse.json({
        success: true,
        message: language === 'de' 
          ? 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.'
          : 'If an account with this email exists, a reset link has been sent.'
      });
    }

    // Generate email HTML
    const emailHtml = getPasswordResetEmailHtml(user.name, token, language);
    const subject = language === 'de' 
      ? 'Passwort zurücksetzen - StudyDocs'
      : 'Reset your password - StudyDocs';

    // Send email via internal API route
    try {
      const emailResponse = await fetch(`${request.nextUrl.origin}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          subject,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        console.error('Failed to send password reset email');
        // Still return success to user (email might be logged in dev)
      }
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // Still return success to user
    }

    return NextResponse.json({
      success: true,
      message: language === 'de' 
        ? 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.'
        : 'If an account with this email exists, a reset link has been sent.'
    });
  } catch (error: any) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten' },
      { status: 500 }
    );
  }
}

