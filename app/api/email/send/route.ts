import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Send email using Supabase's built-in email service
 * 
 * NOTE: Supabase's built-in email service has limitations:
 * - Only works for development/testing
 * - Limited to project members (users in your Supabase organization)
 * - Has rate limits
 * - Not guaranteed for production use
 * 
 * For production, you should configure custom SMTP in Supabase Dashboard:
 * Settings → Auth → SMTP Settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'to, subject, and html are required' },
        { status: 400 }
      );
    }

    // Try to use Supabase's auth.admin API to send email
    // This uses Supabase's built-in email service (if configured)
    // or the custom SMTP configured in Supabase Dashboard
    
    try {
      // Use Supabase Admin API to send email
      // This requires the service role key and uses Supabase's email infrastructure
      const { data, error } = await supabaseServer.auth.admin.generateLink({
        type: 'invite',
        email: to,
      });

      // Note: Supabase's generateLink is for auth flows, not custom emails
      // For custom emails, we need to use Supabase Edge Functions or
      // configure SMTP in Supabase Dashboard
      
      // For now, we'll log the email in development
      // In production with Supabase SMTP configured, this would work differently
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Email would be sent (Development Mode):');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('---');
        console.log('HTML Content:', html);
        console.log('---');
        console.log('⚠️  In production, configure SMTP in Supabase Dashboard:');
        console.log('   Settings → Auth → SMTP Settings');
        
        return NextResponse.json({ 
          success: true,
          message: 'Email logged (development mode). Configure SMTP in Supabase Dashboard for production.',
          development: true
        });
      } else {
        // In production, we need SMTP configured in Supabase
        return NextResponse.json(
          { 
            error: 'Email service not configured. Please configure SMTP in Supabase Dashboard (Settings → Auth → SMTP Settings)',
            hint: 'Supabase built-in email service is limited. For production, configure custom SMTP.'
          },
          { status: 500 }
        );
      }
    } catch (supabaseError: any) {
      console.error('Supabase email error:', supabaseError);
      
      // Fallback: Log email details
      console.log('📧 Email details:', { to, subject });
      
      return NextResponse.json(
        { 
          error: 'Failed to send email via Supabase. Please configure SMTP in Supabase Dashboard.',
          details: process.env.NODE_ENV === 'development' ? supabaseError.message : undefined
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

