'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: data.message || (language === 'de' 
            ? 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.'
            : 'If an account with this email exists, a reset link has been sent.')
        });
        setEmail('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || (language === 'de' 
            ? 'Fehler beim Senden der E-Mail'
            : 'Error sending email')
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: language === 'de' 
          ? 'Verbindungsfehler'
          : 'Connection error'
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200/50 dark:border-gray-700/50 animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-2">
            {language === 'de' ? 'Passwort zurücksetzen' : 'Reset Password'}
          </h1>
          <h2 className="text-lg text-gray-600 dark:text-gray-400">
            {language === 'de' 
              ? 'Geben Sie Ihre E-Mail-Adresse ein'
              : 'Enter your email address'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {language === 'de' ? 'E-Mail-Adresse' : 'Email Address'}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white transition-all duration-200 shadow-sm hover:shadow-md"
              placeholder={language === 'de' ? 'ihre@email.de' : 'your@email.com'}
            />
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-sm ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            }`}>
              <div className="flex items-start gap-2">
                {message.type === 'success' ? (
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span>{message.text}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{language === 'de' ? 'Wird gesendet...' : 'Sending...'}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{language === 'de' ? 'Reset-Link senden' : 'Send Reset Link'}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {language === 'de' 
              ? 'Wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts per E-Mail.'
              : 'We will send you a link to reset your password via email.'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors duration-200"
          >
            {language === 'de' ? 'Zurück zur Anmeldung' : 'Back to Login'}
          </button>
        </div>
      </div>
    </div>
  );
}

