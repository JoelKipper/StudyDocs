import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * Send email using nodemailer with SMTP
 * 
 * This uses the same SMTP settings configured in Supabase Dashboard.
 * IMPORTANT: Copy the SMTP settings from Supabase Dashboard to Environment Variables:
 * - Supabase Dashboard → Settings → Auth → SMTP Settings
 * - Copy: SMTP Host, Port, User, Password, Sender Email, Sender Name
 * - Paste into Environment Variables (see docs/EMAIL_SETUP.md)
 * 
 * Configuration:
 * - In development: Logs emails to console if SMTP not configured
 * - In production: Sends emails via SMTP using Supabase-configured settings
 * 
 * Environment Variables (use same values as in Supabase Dashboard):
 * - SMTP_HOST: SMTP server host (from Supabase Dashboard)
 * - SMTP_PORT: SMTP port (from Supabase Dashboard)
 * - SMTP_USER: SMTP username/email (from Supabase Dashboard)
 * - SMTP_PASSWORD: SMTP password (from Supabase Dashboard)
 * - SMTP_FROM: Sender email address (from Supabase Dashboard)
 * - SMTP_FROM_NAME: Sender name (from Supabase Dashboard, optional, defaults to "StudyDocs")
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

    // In development, log email to console
    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST) {
      console.log('📧 Email (Development Mode / SMTP not configured):');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('---');
      console.log('HTML Content:');
      console.log(html);
      console.log('---');
      
      if (!process.env.SMTP_HOST) {
        console.log('⚠️  To send real emails, copy SMTP settings from Supabase Dashboard:');
        console.log('   1. Go to Supabase Dashboard → Settings → Auth → SMTP Settings');
        console.log('   2. Copy the SMTP settings to Environment Variables:');
        console.log('      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_FROM_NAME');
        console.log('   3. See docs/EMAIL_SETUP.md for detailed instructions');
      }
      
      return NextResponse.json({ 
        success: true,
        message: process.env.NODE_ENV === 'development' 
          ? 'Email logged to console (development mode)'
          : 'Email logged. Configure SMTP environment variables to send real emails.',
        development: true
      });
    }

    // In production with SMTP configured, send real email
    // Use the same SMTP settings as configured in Supabase Dashboard
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) {
      return NextResponse.json(
        { 
          error: 'SMTP not configured. Please copy SMTP settings from Supabase Dashboard to Environment Variables. See docs/EMAIL_SETUP.md for instructions.',
          hint: 'Go to Supabase Dashboard → Settings → Auth → SMTP Settings and copy the values to Environment Variables'
        },
        { status: 500 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'StudyDocs'}" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      html,
    });

    console.log('📧 Email sent successfully:', info.messageId);

    return NextResponse.json({ 
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

