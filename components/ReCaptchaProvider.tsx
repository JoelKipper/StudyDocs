'use client';

import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { ReactNode } from 'react';

interface ReCaptchaProviderProps {
  children: ReactNode;
}

export default function ReCaptchaProvider({ children }: ReCaptchaProviderProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // If no site key is configured, render children without reCAPTCHA
  if (!siteKey) {
    return <>{children}</>;
  }

  // Determine language based on browser or default to 'de'
  const getLanguage = () => {
    if (typeof window !== 'undefined') {
      const browserLang = navigator.language || (navigator as any).userLanguage;
      if (browserLang.startsWith('de')) return 'de';
      if (browserLang.startsWith('en')) return 'en';
    }
    return 'de'; // Default
  };

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={siteKey}
      language={getLanguage()}
      scriptProps={{
        async: false,
        defer: false,
        appendTo: 'head',
        nonce: undefined,
      }}
      useRecaptchaNet={false} // Use www.google.com instead of www.recaptcha.net
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}

