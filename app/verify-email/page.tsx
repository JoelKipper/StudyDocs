'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage(language === 'de' 
        ? 'Kein Verifizierungs-Token gefunden'
        : 'No verification token found');
      return;
    }

    // Verify email
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(language === 'de'
            ? 'E-Mail-Adresse wurde erfolgreich verifiziert!'
            : 'Email address has been successfully verified!');
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.error || (language === 'de'
            ? 'Fehler bei der Verifizierung'
            : 'Verification error'));
        }
      })
      .catch((error) => {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(language === 'de'
          ? 'Fehler bei der Verifizierung'
          : 'Verification error');
      });
  }, [searchParams, router, language]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200/50 dark:border-gray-700/50">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {language === 'de' ? 'Verifizierung läuft...' : 'Verifying...'}
              </h1>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {language === 'de' ? 'Erfolgreich verifiziert!' : 'Successfully verified!'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {language === 'de' 
                  ? 'Sie werden in 3 Sekunden weitergeleitet...'
                  : 'You will be redirected in 3 seconds...'}
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {language === 'de' ? 'Verifizierung fehlgeschlagen' : 'Verification failed'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
              <button
                onClick={() => router.push('/')}
                className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                {language === 'de' ? 'Zur Startseite' : 'Go to homepage'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

