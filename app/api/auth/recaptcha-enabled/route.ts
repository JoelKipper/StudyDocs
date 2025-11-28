import { NextRequest, NextResponse } from 'next/server';
import { getSystemSettingBoolean } from '@/lib/system-settings';

/**
 * Public endpoint to check if reCAPTCHA is enabled
 * Used by LoginForm to determine if reCAPTCHA should be used
 */
export async function GET(request: NextRequest) {
  try {
    const enableRecaptcha = await getSystemSettingBoolean('enable_recaptcha', true);
    return NextResponse.json({ enabled: enableRecaptcha });
  } catch (error: any) {
    console.error('Error checking reCAPTCHA setting:', error);
    // Default to enabled on error
    return NextResponse.json({ enabled: true });
  }
}

