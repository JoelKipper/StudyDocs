'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import React from 'react';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface UserDetails {
  user: {
    id: string;
    email: string;
    name: string;
    is_admin: boolean;
    is_active: boolean;
    created_at: string;
    last_login: string | null;
    last_login_ip: string | null;
  };
  files: {
    total: number;
    directories: number;
    totalSize: number;
    recent: Array<{
      id: string;
      name: string;
      path: string;
      type: string;
      size: number;
      created_at: string;
    }>;
  };
  loginHistory: Array<{
    id: string;
    created_at: string;
    ip_address: string | null;
    user_agent: string | null;
  }>;
  activitySummary: {
    total: number;
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    byAction: Record<string, number>;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    resource_type: string | null;
    resource_path: string | null;
    ip_address: string | null;
    created_at: string;
    details: any;
  }>;
}

export default function UserDetailsModal({ isOpen, onClose, userId }: UserDetailsModalProps) {
  const { t, language, formatSize } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'login' | 'activity'>('overview');

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDetails();
    }
  }, [isOpen, userId]);

  async function loadUserDetails() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/admin/users/${userId}/details`);
      if (!res.ok) {
        throw new Error('Failed to load user details');
      }
      const data = await res.json();
      setDetails(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {details?.user.name || 'Loading...'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {details?.user.email || ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('close')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-4 font-medium transition-colors relative ${
              activeTab === 'overview'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {language === 'de' ? 'Übersicht' : 'Overview'}
            </span>
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-4 py-4 font-medium transition-colors relative ${
              activeTab === 'files'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {language === 'de' ? 'Dateien' : 'Files'}
            </span>
            {activeTab === 'files' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('login')}
            className={`px-4 py-4 font-medium transition-colors relative ${
              activeTab === 'login'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {language === 'de' ? 'Login-Historie' : 'Login History'}
            </span>
            {activeTab === 'login' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-4 font-medium transition-colors relative ${
              activeTab === 'activity'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {language === 'de' ? 'Aktivitäten' : 'Activities'}
            </span>
            {activeTab === 'activity' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : details ? (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* User Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-6 rounded-xl border border-blue-200 dark:border-blue-800 shadow-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {language === 'de' ? 'Benutzer-Informationen' : 'User Information'}
                        </h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'E-Mail:' : 'Email:'}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{details.user.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'Rolle:' : 'Role:'}</span>
                          <span className="font-medium">
                            {details.user.is_admin ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                {language === 'de' ? 'Admin' : 'Admin'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                {language === 'de' ? 'Benutzer' : 'User'}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'Status:' : 'Status:'}</span>
                          <span className="font-medium">
                            {details.user.is_active ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                {language === 'de' ? 'Aktiv' : 'Active'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                                {language === 'de' ? 'Inaktiv' : 'Inactive'}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'Erstellt am:' : 'Created:'}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {new Date(details.user.created_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'Letzter Login:' : 'Last Login:'}</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {details.user.last_login
                              ? new Date(details.user.last_login).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')
                              : language === 'de' ? 'Nie' : 'Never'}
                          </span>
                        </div>
                        {details.user.last_login_ip && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'Letzte IP:' : 'Last IP:'}</span>
                            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs font-mono">
                              {details.user.last_login_ip}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-6 rounded-xl border border-green-200 dark:border-green-800 shadow-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {language === 'de' ? 'Dateien & Ordner' : 'Files & Folders'}
                        </h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'Dateien:' : 'Files:'}</span>
                          <span className="text-2xl font-bold text-green-900 dark:text-green-100">{details.files.total}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'Ordner:' : 'Directories:'}</span>
                          <span className="text-2xl font-bold text-green-900 dark:text-green-100">{details.files.directories}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-green-200 dark:border-green-800">
                          <span className="text-gray-600 dark:text-gray-400">{language === 'de' ? 'Gesamtgröße:' : 'Total Size:'}</span>
                          <span className="text-lg font-bold text-green-900 dark:text-green-100">{formatSize(details.files.totalSize)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Activity Summary */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-6 rounded-xl border border-purple-200 dark:border-purple-800 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {language === 'de' ? 'Aktivitäts-Zusammenfassung' : 'Activity Summary'}
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{details.activitySummary.total}</div>
                        <div className="text-sm text-purple-700 dark:text-purple-300">{language === 'de' ? 'Gesamt' : 'Total'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{details.activitySummary.last24Hours}</div>
                        <div className="text-sm text-purple-700 dark:text-purple-300">{language === 'de' ? 'Letzte 24h' : 'Last 24h'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{details.activitySummary.last7Days}</div>
                        <div className="text-sm text-purple-700 dark:text-purple-300">{language === 'de' ? 'Letzte 7 Tage' : 'Last 7 Days'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{details.activitySummary.last30Days}</div>
                        <div className="text-sm text-purple-700 dark:text-purple-300">{language === 'de' ? 'Letzte 30 Tage' : 'Last 30 Days'}</div>
                      </div>
                    </div>
                    {Object.keys(details.activitySummary.byAction).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          {language === 'de' ? 'Nach Aktion:' : 'By Action:'}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(details.activitySummary.byAction)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 10)
                            .map(([action, count]) => (
                              <span
                                key={action}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                              >
                                {action}: {count}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'files' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {language === 'de' ? 'Erstellte Dateien & Ordner' : 'Created Files & Folders'}
                    </h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'de' 
                        ? `${details.files.total} Dateien, ${details.files.directories} Ordner`
                        : `${details.files.total} files, ${details.files.directories} directories`}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Name' : 'Name'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Typ' : 'Type'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Größe' : 'Size'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Erstellt am' : 'Created'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {details.files.recent.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                {language === 'de' ? 'Keine Dateien gefunden' : 'No files found'}
                              </td>
                            </tr>
                          ) : (
                            details.files.recent.map((file) => (
                              <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="p-4">
                                  <div className="font-medium text-gray-900 dark:text-white">{file.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{file.path}</div>
                                </td>
                                <td className="p-4">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                    {file.type === 'file' ? (language === 'de' ? 'Datei' : 'File') : (language === 'de' ? 'Ordner' : 'Directory')}
                                  </span>
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {file.type === 'file' ? formatSize(file.size || 0) : '-'}
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(file.created_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'login' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {language === 'de' ? 'Login-Historie' : 'Login History'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'de' ? 'Letzte 20 Anmeldungen' : 'Last 20 logins'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Zeit' : 'Time'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">IP-Adresse</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">User-Agent</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {details.loginHistory.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                {language === 'de' ? 'Keine Login-Historie gefunden' : 'No login history found'}
                              </td>
                            </tr>
                          ) : (
                            details.loginHistory.map((login) => (
                              <tr key={login.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(login.created_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}
                                </td>
                                <td className="p-4">
                                  <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs font-mono">
                                    {login.ip_address || '-'}
                                  </code>
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  <div className="max-w-md truncate" title={login.user_agent || ''}>
                                    {login.user_agent || '-'}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {language === 'de' ? 'Letzte Aktivitäten' : 'Recent Activities'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'de' ? 'Letzte 10 Aktivitäten' : 'Last 10 activities'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Zeit' : 'Time'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Aktion' : 'Action'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Ressource' : 'Resource'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">IP-Adresse</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {details.recentActivities.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                {language === 'de' ? 'Keine Aktivitäten gefunden' : 'No activities found'}
                              </td>
                            </tr>
                          ) : (
                            details.recentActivities.map((activity) => (
                              <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(activity.created_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}
                                </td>
                                <td className="p-4">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                    {activity.action}
                                  </span>
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {activity.resource_path || activity.resource_type || <span className="text-gray-400">-</span>}
                                </td>
                                <td className="p-4">
                                  {activity.ip_address ? (
                                    <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs font-mono">
                                      {activity.ip_address}
                                    </code>
                                  ) : (
                                    <span className="text-gray-400 text-sm">-</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

