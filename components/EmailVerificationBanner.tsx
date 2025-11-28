'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface EmailVerificationBannerProps {
  user: {
    id: string;
    email: string;
    emailVerified?: boolean;
  };
  onVerificationSent?: () => void;
}

export default function EmailVerificationBanner({ user, onVerificationSent }: EmailVerificationBannerProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (user.emailVerified) {
    return null;
  }

  async function handleResendVerification() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: language === 'de'
            ? 'Verifizierungs-E-Mail wurde gesendet. Bitte prüfen Sie Ihr Postfach.'
            : 'Verification email has been sent. Please check your inbox.',
        });
        if (onVerificationSent) {
          onVerificationSent();
        }
      } else {
        setMessage({
          type: 'error',
          text: data.error || (language === 'de'
            ? 'Fehler beim Senden der E-Mail'
            : 'Error sending email'),
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: language === 'de'
          ? 'Fehler beim Senden der E-Mail'
          : 'Error sending email',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {language === 'de'
              ? 'E-Mail-Adresse nicht verifiziert'
              : 'Email address not verified'}
          </h3>
          <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            <p>
              {language === 'de'
                ? 'Bitte verifizieren Sie Ihre E-Mail-Adresse, um alle Funktionen nutzen zu können.'
                : 'Please verify your email address to access all features.'}
            </p>
          </div>
          {message && (
            <div className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {message.text}
            </div>
          )}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              className="bg-yellow-400 dark:bg-yellow-500 hover:bg-yellow-500 dark:hover:bg-yellow-600 text-yellow-900 dark:text-yellow-900 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? (language === 'de' ? 'Wird gesendet...' : 'Sending...')
                : (language === 'de' ? 'E-Mail erneut senden' : 'Resend Email')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

