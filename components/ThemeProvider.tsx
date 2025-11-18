'use client';

import { useEffect } from 'react';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme on mount - this ensures theme is applied even if script didn't run
    function applyTheme() {
      if (typeof window === 'undefined') return;
      
      const savedTheme = localStorage.getItem('studydocs-theme') as 'light' | 'dark' | 'system' | null;
      const root = document.documentElement;
      
      // Only apply theme if user has explicitly set one
      if (savedTheme === 'dark') {
        root.classList.add('dark');
      } else if (savedTheme === 'light') {
        root.classList.remove('dark');
      } else if (savedTheme === 'system') {
        // System preference
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
      // If no theme is saved, don't set anything - let browser/system default handle it
    }

    // Apply immediately
    applyTheme();

    // Listen for system theme changes (only if theme is 'system' or not set)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const currentTheme = localStorage.getItem('studydocs-theme') as 'light' | 'dark' | 'system' | null;
      if (currentTheme === 'system' || !currentTheme) {
        const root = document.documentElement;
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return <>{children}</>;
}

