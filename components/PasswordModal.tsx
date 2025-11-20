'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  itemName: string;
  itemType: 'file' | 'directory';
  mode: 'set' | 'verify' | 'remove'; // set = set password, verify = verify password, remove = remove password
  error?: string;
}

export default function PasswordModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType,
  mode,
  error: externalError,
}: PasswordModalProps) {
  const { t, language } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setError('');
      // Focus password input after modal opens
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'set') {
      if (!password.trim()) {
        setError(language === 'de' ? 'Passwort ist erforderlich' : 'Password is required');
        return;
      }
      if (password.length < 4) {
        setError(language === 'de' ? 'Passwort muss mindestens 4 Zeichen lang sein' : 'Password must be at least 4 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError(language === 'de' ? 'Passwörter stimmen nicht überein' : 'Passwords do not match');
        return;
      }
      onConfirm(password);
    } else if (mode === 'verify') {
      if (!password.trim()) {
        setError(language === 'de' ? 'Passwort ist erforderlich' : 'Password is required');
        return;
      }
      onConfirm(password);
    } else if (mode === 'remove') {
      // For remove mode, password is the current password to verify before removal
      if (!password.trim()) {
        setError(language === 'de' ? 'Bitte geben Sie das aktuelle Passwort ein, um den Schutz zu entfernen' : 'Please enter the current password to remove protection');
        return;
      }
      onConfirm(password);
    }
  }

  if (!isOpen) return null;

  const title = 
    mode === 'set' 
      ? (language === 'de' ? 'Passwort-Schutz aktivieren' : 'Enable Password Protection')
      : mode === 'verify'
      ? (language === 'de' ? 'Passwort eingeben' : 'Enter Password')
      : (language === 'de' ? 'Passwort-Schutz entfernen' : 'Remove Password Protection');

  const description =
    mode === 'set'
      ? (language === 'de' 
          ? `Geben Sie ein Passwort ein, um ${itemType === 'file' ? 'die Datei' : 'den Ordner'} "${itemName}" zu schützen.`
          : `Enter a password to protect ${itemType === 'file' ? 'the file' : 'the folder'} "${itemName}".`)
      : mode === 'verify'
      ? (language === 'de'
          ? `${itemType === 'file' ? 'Die Datei' : 'Der Ordner'} "${itemName}" ist passwortgeschützt. Bitte geben Sie das Passwort ein.`
          : `${itemType === 'file' ? 'The file' : 'The folder'} "${itemName}" is password protected. Please enter the password.`)
      : (language === 'de'
          ? `Geben Sie das aktuelle Passwort ein, um den Schutz von ${itemType === 'file' ? 'der Datei' : 'dem Ordner'} "${itemName}" zu entfernen.`
          : `Enter the current password to remove protection from ${itemType === 'file' ? 'the file' : 'the folder'} "${itemName}".`);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {description}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {mode === 'set' || mode === 'verify' 
                    ? (language === 'de' ? 'Passwort' : 'Password')
                    : (language === 'de' ? 'Aktuelles Passwort' : 'Current Password')}
                </label>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={language === 'de' ? 'Passwort eingeben' : 'Enter password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {mode === 'set' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'de' ? 'Passwort bestätigen' : 'Confirm Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError('');
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder={language === 'de' ? 'Passwort wiederholen' : 'Confirm password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  {mode === 'set'
                    ? (language === 'de' ? 'Schützen' : 'Protect')
                    : mode === 'verify'
                    ? (language === 'de' ? 'Bestätigen' : 'Confirm')
                    : (language === 'de' ? 'Entfernen' : 'Remove')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

