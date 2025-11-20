'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SearchFilters {
  fileType: 'all' | 'file' | 'directory';
  fileExtensions?: string[];
  minSize?: number;
  maxSize?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClear: () => void;
}

export default function SearchBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  onClear,
}: SearchBarProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard shortcut: Ctrl/Cmd + F
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsExpanded(true);
      }
      if (e.key === 'Escape' && isExpanded) {
        onClear();
        setIsExpanded(false);
        setShowFilters(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, onClear]);

  // Close filter panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        showFilters &&
        filterPanelRef.current &&
        !filterPanelRef.current.contains(target) &&
        !searchInputRef.current?.contains(target) &&
        !filterButtonRef.current?.contains(target)
      ) {
        setShowFilters(false);
      }
    }

    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilters]);

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          placeholder={t('searchPlaceholder')}
          className="block w-full pl-10 pr-14 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        {searchQuery && (
          <button
            onClick={onClear}
            className="absolute inset-y-0 right-8 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        <button
          ref={filterButtonRef}
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-0 top-1/2 -translate-y-1/2 pr-3 flex items-center ${
            showFilters || filters.fileType !== 'all' || (filters.fileExtensions && filters.fileExtensions.length > 0) || filters.minSize || filters.maxSize || filters.dateFrom || filters.dateTo
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
          title={t('filters')}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div
          ref={filterPanelRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-4 animate-slide-down"
        >
          <div className="space-y-4">
            {/* File Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fileType')}
              </label>
              <select
                value={filters.fileType}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    fileType: e.target.value as 'all' | 'file' | 'directory',
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              >
                <option value="all">{t('allTypes')}</option>
                <option value="file">{t('filesOnly')}</option>
                <option value="directory">{t('directoriesOnly')}</option>
              </select>
            </div>

            {/* File Extensions Filter */}
            {filters.fileType === 'file' || filters.fileType === 'all' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('fileExtensions') || 'Dateitypen'}
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { ext: 'pdf', label: 'PDF' },
                      { ext: 'doc', label: 'DOC' },
                      { ext: 'docx', label: 'DOCX' },
                      { ext: 'xls', label: 'XLS' },
                      { ext: 'xlsx', label: 'XLSX' },
                      { ext: 'ppt', label: 'PPT' },
                      { ext: 'pptx', label: 'PPTX' },
                      { ext: 'txt', label: 'TXT' },
                      { ext: 'md', label: 'Markdown' },
                      { ext: 'jpg', label: 'JPG' },
                      { ext: 'jpeg', label: 'JPEG' },
                      { ext: 'png', label: 'PNG' },
                      { ext: 'gif', label: 'GIF' },
                      { ext: 'mp4', label: 'MP4' },
                      { ext: 'mp3', label: 'MP3' },
                      { ext: 'zip', label: 'ZIP' },
                      { ext: 'js', label: 'JavaScript' },
                      { ext: 'ts', label: 'TypeScript' },
                      { ext: 'html', label: 'HTML' },
                      { ext: 'css', label: 'CSS' },
                      { ext: 'java', label: 'Java' },
                      { ext: 'py', label: 'Python' },
                    ].map(({ ext, label }) => (
                      <label
                        key={ext}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 rounded px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={filters.fileExtensions?.includes(ext) || false}
                          onChange={(e) => {
                            const currentExtensions = filters.fileExtensions || [];
                            if (e.target.checked) {
                              onFiltersChange({
                                ...filters,
                                fileExtensions: [...currentExtensions, ext],
                              });
                            } else {
                              onFiltersChange({
                                ...filters,
                                fileExtensions: currentExtensions.filter((e) => e !== ext),
                              });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {label} (.{ext})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {filters.fileExtensions && filters.fileExtensions.length > 0 && (
                  <button
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        fileExtensions: undefined,
                      })
                    }
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t('clearExtensions') || 'Alle auswählen'}
                  </button>
                )}
              </div>
            ) : null}

            {/* Size Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fileSize')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('minSize')} (KB)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t('minSize')}
                    value={filters.minSize ? Math.round(filters.minSize / 1024).toString() : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow numbers (including empty string)
                      if (value === '' || /^\d+$/.test(value)) {
                        onFiltersChange({
                          ...filters,
                          minSize: value ? parseInt(value) * 1024 : undefined,
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      // Allow: backspace, delete, tab, escape, enter
                      if ([8, 9, 27, 13, 46].includes(e.keyCode) ||
                          // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                          (e.keyCode === 65 && (e.ctrlKey || e.metaKey)) ||
                          (e.keyCode === 67 && (e.ctrlKey || e.metaKey)) ||
                          (e.keyCode === 86 && (e.ctrlKey || e.metaKey)) ||
                          (e.keyCode === 88 && (e.ctrlKey || e.metaKey)) ||
                          // Allow: home, end, left, right, up, down
                          (e.keyCode >= 35 && e.keyCode <= 40)) {
                        return;
                      }
                      // Allow only numbers (0-9) from both keyboard and numpad
                      if ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105)) {
                        return;
                      }
                      e.preventDefault();
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const paste = (e.clipboardData || (window as any).clipboardData).getData('text');
                      const numbersOnly = paste.replace(/\D/g, '');
                      if (numbersOnly) {
                        onFiltersChange({
                          ...filters,
                          minSize: parseInt(numbersOnly) * 1024,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('maxSize')} (KB)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t('maxSize')}
                    value={filters.maxSize ? Math.round(filters.maxSize / 1024).toString() : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow numbers (including empty string)
                      if (value === '' || /^\d+$/.test(value)) {
                        onFiltersChange({
                          ...filters,
                          maxSize: value ? parseInt(value) * 1024 : undefined,
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      // Allow: backspace, delete, tab, escape, enter
                      if ([8, 9, 27, 13, 46].includes(e.keyCode) ||
                          // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                          (e.keyCode === 65 && (e.ctrlKey || e.metaKey)) ||
                          (e.keyCode === 67 && (e.ctrlKey || e.metaKey)) ||
                          (e.keyCode === 86 && (e.ctrlKey || e.metaKey)) ||
                          (e.keyCode === 88 && (e.ctrlKey || e.metaKey)) ||
                          // Allow: home, end, left, right, up, down
                          (e.keyCode >= 35 && e.keyCode <= 40)) {
                        return;
                      }
                      // Allow only numbers (0-9) from both keyboard and numpad
                      if ((e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105)) {
                        return;
                      }
                      e.preventDefault();
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const paste = (e.clipboardData || (window as any).clipboardData).getData('text');
                      const numbersOnly = paste.replace(/\D/g, '');
                      if (numbersOnly) {
                        onFiltersChange({
                          ...filters,
                          maxSize: parseInt(numbersOnly) * 1024,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('modifiedDate')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="date"
                    value={
                      filters.dateFrom
                        ? new Date(filters.dateFrom).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        dateFrom: e.target.value ? new Date(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={
                      filters.dateTo
                        ? new Date(filters.dateTo).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        dateTo: e.target.value ? new Date(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            <button
              onClick={() => {
                onFiltersChange({
                  fileType: 'all',
                  fileExtensions: undefined,
                  minSize: undefined,
                  maxSize: undefined,
                  dateFrom: undefined,
                  dateTo: undefined,
                });
              }}
              className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('resetFilters')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

