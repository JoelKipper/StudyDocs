'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StorageQuotaProps {
  className?: string;
}

interface StorageData {
  used: number;
  quota: number;
  percentage: number;
}

export default function StorageQuota({ className = '' }: StorageQuotaProps) {
  const { t, formatSize, language } = useLanguage();
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStorage() {
      try {
        const res = await fetch('/api/files/storage');
        if (res.ok) {
          const data = await res.json();
          setStorageData(data);
        } else {
          setError('Fehler beim Laden');
        }
      } catch (err) {
        setError('Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    }

    fetchStorage();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStorage, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !storageData) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
        <span>{t('loading')}</span>
      </div>
    );
  }

  if (error) {
    return null; // Don't show error, just hide the component
  }

  const percentage = Math.min(100, Math.max(0, storageData.percentage));
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <svg 
          className={`w-4 h-4 flex-shrink-0 ${
            isCritical ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-gray-500 dark:text-gray-400'
          }`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
        <div className="flex flex-col min-w-0">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            {formatSize(storageData.used)} / {formatSize(storageData.quota)}
          </div>
          <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isCritical
                  ? 'bg-red-500'
                  : isWarning
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
      {isWarning && (
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            isCritical
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          }`}
          title={
            isCritical
              ? language === 'de'
                ? 'Speicherplatz fast voll!'
                : 'Storage almost full!'
              : language === 'de'
              ? 'Speicherplatz wird knapp'
              : 'Storage running low'
          }
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="whitespace-nowrap">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

