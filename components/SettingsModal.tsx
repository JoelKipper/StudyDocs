'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations, type Language as LangType } from '@/lib/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: { id: string; name: string; email: string };
  onUserUpdate?: () => void;
}

type Theme = 'light' | 'dark' | 'system';

export default function SettingsModal({ isOpen, onClose, user, onUserUpdate }: SettingsModalProps) {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profile' | 'hotkeys' | 'language' | 'theme'>('profile');
  const [theme, setTheme] = useState<Theme | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Profile form state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    // Load saved settings - NEVER set default, only load what user has explicitly chosen
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('studydocs-theme') as Theme | null;
      
      // Only load if user has explicitly set a theme
      if (savedTheme) {
        setTheme(savedTheme);
      }
      // If no theme is saved, don't set anything - let user choose
      
      // Language is handled by LanguageProvider
    }
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const updateData: { name?: string; email?: string; currentPassword?: string; newPassword?: string } = {};
      
      // Only include name if it actually changed
      if (profileName.trim() !== user?.name.trim()) {
        updateData.name = profileName.trim();
      }
      
      // Only include email if it actually changed
      if (profileEmail.trim().toLowerCase() !== user?.email.toLowerCase()) {
        updateData.email = profileEmail.trim();
      }
      
      // Only include password if new password is provided
      if (newPassword && newPassword.trim()) {
        if (newPassword !== confirmPassword) {
          setProfileError(t('passwordsDoNotMatch'));
          setProfileLoading(false);
          return;
        }
        if (!currentPassword) {
          setProfileError(t('currentPasswordRequired'));
          setProfileLoading(false);
          return;
        }
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      if (Object.keys(updateData).length === 0) {
        setProfileError(t('noChanges'));
        setProfileLoading(false);
        return;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (res.ok) {
        setProfileSuccess(t('profileUpdated'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onUserUpdate) {
          onUserUpdate();
        }
        // Reload page to update user data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setProfileError(data.error || t('errorUpdatingProfile'));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setProfileError(t('errorUpdatingProfile'));
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    // Apply theme and save to localStorage - only when user explicitly sets it
    if (typeof window !== 'undefined' && theme !== null) {
      const root = document.documentElement;
      
      // Save to localStorage
      localStorage.setItem('studydocs-theme', theme);
      
      // Apply theme
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else if (theme === 'system') {
        // System preference
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    }
  }, [theme]);

  // Language is handled by LanguageProvider, no need for separate effect

  if (!isOpen) return null;

  const hotkeys = [
    { key: 'Ctrl/Cmd + A', description: t('shortcutSelectAll') },
    { key: 'Ctrl/Cmd + C', description: t('shortcutCopy') },
    { key: 'Ctrl/Cmd + X', description: t('shortcutCut') },
    { key: 'Ctrl/Cmd + V', description: t('shortcutPaste') },
    { key: 'Ctrl/Cmd + N', description: t('shortcutNewFolder') },
    { key: 'Ctrl/Cmd + U', description: t('shortcutUpload') },
    { key: 'Ctrl/Cmd + Z', description: t('shortcutUndo') },
    { key: 'Delete / Backspace', description: t('shortcutDelete') },
    { key: 'F2', description: t('shortcutRename') },
    { key: 'Enter', description: t('shortcutOpen') },
    { key: '↑ ↓', description: t('shortcutNavigate') },
    { key: '→', description: t('shortcutEnterFolder') },
    { key: '←', description: t('shortcutGoUp') },
    { key: 'Ctrl/Cmd + F', description: t('shortcutSearch') },
    { key: 'Escape', description: t('shortcutEscape') },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 h-[90vh] md:h-[85vh] overflow-hidden animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settingsTitle')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('close')}
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'profile'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t('profile')}
          </button>
          <button
            onClick={() => setActiveTab('hotkeys')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'hotkeys'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t('keyboardShortcuts')}
          </button>
          <button
            onClick={() => setActiveTab('language')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'language'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t('language')}
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'theme'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t('appearance')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('profileInformation')}</h3>
                
                {/* Name */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('name')}
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('email')}
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('changePassword')}</h3>
                  
                  {/* Current Password */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('currentPassword')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={t('enterCurrentPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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

                  {/* New Password */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('newPassword')}
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={t('enterNewPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        {showNewPassword ? (
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

                  {/* Confirm Password */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('confirmPassword')}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={t('confirmNewPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
                </div>

                {/* Error/Success Messages */}
                {profileError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p>
                  </div>
                )}
                {profileSuccess && (
                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400">{profileSuccess}</p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {profileLoading ? t('saving') : t('save')}
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeTab === 'hotkeys' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('availableShortcuts')}</p>
              <div className="space-y-2">
                {hotkeys.map((hotkey, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{hotkey.description}</span>
                    <kbd className="px-3 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg shadow-sm">
                      {hotkey.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'language' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('selectLanguage')}
              </p>
              <div className="space-y-3">
                <label className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <input
                    type="radio"
                    name="language"
                    value="de"
                    checked={language === 'de'}
                    onChange={(e) => setLanguage(e.target.value as LangType)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">{t('german')}</span>
                </label>
                <label className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <input
                    type="radio"
                    name="language"
                    value="en"
                    checked={language === 'en'}
                    onChange={(e) => setLanguage(e.target.value as LangType)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">{t('english')}</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('selectAppearance')}
              </p>
              <div className="space-y-3">
                <label className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={theme === 'light'}
                    onChange={(e) => setTheme(e.target.value as Theme)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="ml-3 flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('light')}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{language === 'de' ? 'Helles Erscheinungsbild' : 'Light appearance'}</span>
                  </div>
                </label>
                <label className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={theme === 'dark'}
                    onChange={(e) => setTheme(e.target.value as Theme)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="ml-3 flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('dark')}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{language === 'de' ? 'Dunkles Erscheinungsbild' : 'Dark appearance'}</span>
                  </div>
                </label>
                <label className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <input
                    type="radio"
                    name="theme"
                    value="system"
                    checked={theme === 'system'}
                    onChange={(e) => setTheme(e.target.value as Theme)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="ml-3 flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{t('system')}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{language === 'de' ? 'Systemeinstellung verwenden' : 'Use system setting'}</span>
                  </div>
                </label>
                {theme === null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    {t('noThemeSelected')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

