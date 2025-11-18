'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, getTranslation, formatFileSize } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof import('@/lib/translations').translations.de) => string;
  formatSize: (bytes: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('de');

  useEffect(() => {
    // Load saved language
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('studydocs-language') as Language | null;
      if (savedLanguage && (savedLanguage === 'de' || savedLanguage === 'en')) {
        setLanguageState(savedLanguage);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('studydocs-language', lang);
    }
  };

  const t = (key: keyof typeof import('@/lib/translations').translations.de) => {
    return getTranslation(language, key);
  };

  const formatSize = (bytes: number) => {
    return formatFileSize(bytes, language);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatSize }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

