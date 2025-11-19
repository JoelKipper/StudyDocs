'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations, type Language as LangType } from '@/lib/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Theme = 'light' | 'dark' | 'system';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'hotkeys' | 'language' | 'theme'>('hotkeys');
  const [theme, setTheme] = useState<Theme | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] md:max-h-[90vh] h-[100vh] md:h-auto overflow-hidden animate-scale-in flex flex-col"
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
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('hotkeys')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'hotkeys'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t('keyboardShortcuts')}
          </button>
          <button
            onClick={() => setActiveTab('language')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'language'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t('language')}
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
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

