'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleShare() {
      const token = params.token as string;

      if (!token) {
        setError(language === 'de' ? 'Ungültiger Link' : 'Invalid link');
        setLoading(false);
        return;
      }

      try {
        // Get share data from API
        const res = await fetch(`/api/files/share?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || (language === 'de' ? 'Link nicht gefunden oder abgelaufen' : 'Link not found or expired'));
          setLoading(false);
          return;
        }

        // Check if user is logged in
        const userRes = await fetch('/api/auth/me');
        const userData = await userRes.json();

        if (!userRes.ok || !userData.user) {
          // User is not logged in, redirect to login with return URL
          const returnUrl = encodeURIComponent(`/share/${token}`);
          router.push(`/?returnUrl=${returnUrl}`);
          return;
        }

        // User is logged in, navigate to the shared item
        // Navigate to the file manager with the path
        window.location.href = `/?path=${encodeURIComponent(data.itemPath)}`;
      } catch (err) {
        console.error('Error handling share:', err);
        setError(language === 'de' ? 'Fehler beim Laden' : 'Error loading');
        setLoading(false);
      }
    }

    handleShare();
  }, [params.token, router, language]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {language === 'de' ? 'Wird geladen...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {language === 'de' ? 'Fehler' : 'Error'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {language === 'de' ? 'Zur Startseite' : 'Go to Home'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

