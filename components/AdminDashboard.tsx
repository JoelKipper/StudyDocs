'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmModal from './ConfirmModal';
import UserDetailsModal from './UserDetailsModal';

interface AdminDashboardProps {
  user: {
    id: string;
    email: string;
    name: string;
    isAdmin?: boolean;
  };
  onClose: () => void;
}

interface Stats {
  users: {
    total: number;
    active: number;
    admins: number;
  };
  files: {
    total: number;
    directories: number;
    totalStorage: number;
  };
  activity: {
    last24Hours: number;
  };
  security: {
    blockedIps: number;
  };
}

interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  last_login_ip: string | null;
}

interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string | null;
  blocked_at: string;
  expires_at: string | null;
  is_active: boolean;
  blocker: {
    name: string;
    email: string;
  } | null;
}

interface Activity {
  id: string;
  action: string;
  resource_type: string | null;
  resource_path: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: any;
  created_at: string;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export default function AdminDashboard({ user, onClose }: AdminDashboardProps) {
  const { t, language, formatSize } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ips' | 'activity' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState('');
  
  // IP Block form
  const [showBlockIpModal, setShowBlockIpModal] = useState(false);
  const [ipAddress, setIpAddress] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockExpires, setBlockExpires] = useState('');
  
  // User edit form
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userUpdates, setUserUpdates] = useState<{ is_admin?: boolean; is_active?: boolean }>({});
  
  // System settings
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilters, setUserFilters] = useState<{
    status: 'all' | 'active' | 'inactive';
    role: 'all' | 'admin' | 'user';
  }>({ status: 'all', role: 'all' });
  const [activityFilters, setActivityFilters] = useState<{
    action: string;
    dateFrom: string;
    dateTo: string;
  }>({ action: 'all', dateFrom: '', dateTo: '' });
  const [ipSearchQuery, setIpSearchQuery] = useState('');
  
  // Pagination and sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  
  // Confirmation modals
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string[];
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
    closeOnConfirm?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    closeOnConfirm: true,
  });
  
  // User details modal
  const [userDetailsModal, setUserDetailsModal] = useState<{
    isOpen: boolean;
    userId: string;
  }>({
    isOpen: false,
    userId: '',
  });

  useEffect(() => {
    loadData();
    setCurrentPage(1); // Reset to first page when switching tabs
    setSearchQuery('');
    setSortConfig(null);
  }, [activeTab]);

  // Filter and sort functions
  function filterAndSortUsers(usersList: User[]): User[] {
    let filtered = [...usersList];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (userFilters.status !== 'all') {
      filtered = filtered.filter(u => 
        userFilters.status === 'active' ? u.is_active : !u.is_active
      );
    }

    // Role filter
    if (userFilters.role !== 'all') {
      filtered = filtered.filter(u => 
        userFilters.role === 'admin' ? u.is_admin : !u.is_admin
      );
    }

    // Sort
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof User];
        let bVal: any = b[sortConfig.key as keyof User];

        if (sortConfig.key === 'last_login') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  function filterAndSortActivities(activitiesList: Activity[]): Activity[] {
    let filtered = [...activitiesList];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.action.toLowerCase().includes(query) ||
        a.resource_path?.toLowerCase().includes(query) ||
        a.user?.name.toLowerCase().includes(query) ||
        a.user?.email.toLowerCase().includes(query) ||
        a.ip_address?.toLowerCase().includes(query)
      );
    }

    // Action filter
    if (activityFilters.action !== 'all') {
      filtered = filtered.filter(a => a.action === activityFilters.action);
    }

    // Date filters
    if (activityFilters.dateFrom) {
      const fromDate = new Date(activityFilters.dateFrom);
      filtered = filtered.filter(a => new Date(a.created_at) >= fromDate);
    }
    if (activityFilters.dateTo) {
      const toDate = new Date(activityFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(a => new Date(a.created_at) <= toDate);
    }

    // Sort
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof Activity];
        let bVal: any = b[sortConfig.key as keyof Activity];

        if (sortConfig.key === 'created_at') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  function filterIps(ipsList: BlockedIp[]): BlockedIp[] {
    let filtered = [...ipsList];

    if (ipSearchQuery.trim()) {
      const query = ipSearchQuery.toLowerCase();
      filtered = filtered.filter(ip => 
        ip.ip_address.toLowerCase().includes(query) ||
        ip.reason?.toLowerCase().includes(query) ||
        ip.blocker?.name.toLowerCase().includes(query) ||
        ip.blocker?.email.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof BlockedIp];
        let bVal: any = b[sortConfig.key as keyof BlockedIp];

        if (sortConfig.key === 'blocked_at' || sortConfig.key === 'expires_at') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  function handleSort(key: string) {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' 
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  }

  function getSortedUsers() {
    return filterAndSortUsers(users);
  }

  function getSortedActivities() {
    return filterAndSortActivities(activities);
  }

  function getSortedIps() {
    return filterIps(blockedIps);
  }

  // Pagination functions
  function getPaginatedItems<T>(items: T[]): T[] {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  function getTotalPages(items: number): number {
    return Math.ceil(items / itemsPerPage);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Failed to load statistics');
        const data = await res.json();
        setStats(data);
      } else if (activeTab === 'users') {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        setUsers(data.users || []);
      } else if (activeTab === 'ips') {
        const res = await fetch('/api/admin/blocked-ips');
        if (!res.ok) throw new Error('Failed to load blocked IPs');
        const data = await res.json();
        setBlockedIps(data.blockedIps || []);
      } else if (activeTab === 'activity') {
        const res = await fetch('/api/admin/activity?limit=1000');
        if (!res.ok) throw new Error('Failed to load activity logs');
        const data = await res.json();
        setActivities(data.activities || []);
      } else if (activeTab === 'settings') {
        setLoading(false);
        setSettingsLoading(true);
        try {
          const res = await fetch('/api/admin/settings');
          if (!res.ok) throw new Error('Failed to load system settings');
          const data = await res.json();
          setSystemSettings(data.settings || {});
        } catch (err: any) {
          setError(err.message);
        } finally {
          setSettingsLoading(false);
        }
        return;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBlockIp() {
    if (!ipAddress.trim()) {
      setError('IP-Adresse ist erforderlich');
      return;
    }

    try {
      const res = await fetch('/api/admin/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: ipAddress.trim(),
          reason: blockReason.trim() || null,
          expiresAt: blockExpires || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Sperren der IP');
      }

      setShowBlockIpModal(false);
      setIpAddress('');
      setBlockReason('');
      setBlockExpires('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUnblockIp(ipId: string) {
    try {
      const res = await fetch(`/api/admin/blocked-ips?id=${ipId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Fehler beim Entsperren der IP');
      }

      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUpdateUser(userId: string, updates?: { is_admin?: boolean; is_active?: boolean }) {
    try {
      const updatesToApply = updates || userUpdates;
      
      if (Object.keys(updatesToApply).length === 0) {
        throw new Error(t('noChangesMade'));
      }

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          updates: updatesToApply,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Aktualisieren des Benutzers');
      }

      setEditingUser(null);
      setUserUpdates({});
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleActivateUser(userId: string) {
    await handleUpdateUser(userId, { is_active: true });
  }

  async function handleDeactivateUser(userId: string) {
    setConfirmModal({
      isOpen: true,
      title: t('deactivateUser'),
      message: t('confirmDeactivateUser') + '\n\n' + (language === 'de' ? 'Der Benutzer kann sich danach nicht mehr anmelden.' : 'The user will not be able to log in after this.'),
      type: 'warning',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/users?userId=${userId}&permanent=false`, {
            method: 'DELETE',
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || t('errorDeactivatingUser'));
          }

          loadData();
        } catch (err: any) {
          setError(err.message);
        }
      },
    });
  }

  async function handleDeleteUser(userId: string) {
    setConfirmModal({
      isOpen: true,
      title: t('permanentlyDeleteUser'),
      message: t('confirmDeleteUser'),
      details: language === 'de' 
        ? [
            'Alle Dateien und Ordner des Benutzers',
            'Alle Aktivitäts-Logs',
            'Alle Share-Links',
            'Der Benutzer-Account',
          ]
        : [
            'All user files and folders',
            'All activity logs',
            'All share links',
            'The user account',
          ],
      type: 'danger',
      onConfirm: () => {
        // Close first modal first
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {},
        });
        
        // Use setTimeout to ensure state update completes before opening second modal
        setTimeout(() => {
          setConfirmModal({
            isOpen: true,
            title: language === 'de' ? 'Letzte Bestätigung' : 'Final Confirmation',
            message: t('confirmDeleteUserFinal') + '\n\n' + (language === 'de' ? 'ALLE Dateien und Ordner werden unwiderruflich gelöscht!' : 'ALL files and folders will be permanently deleted!'),
            type: 'danger',
            onConfirm: async () => {
              try {
                console.log('[AdminDashboard] Deleting user:', userId);
                setError(''); // Clear any previous errors
                
                const res = await fetch(`/api/admin/users?userId=${userId}&permanent=true`, {
                  method: 'DELETE',
                });

                console.log('[AdminDashboard] Delete response status:', res.status);

                const data = await res.json();
                console.log('[AdminDashboard] Delete response data:', data);

                if (!res.ok) {
                  console.error('[AdminDashboard] Delete error:', data);
                  throw new Error(data.error || t('errorDeletingUser'));
                }

                console.log('[AdminDashboard] User deleted successfully, reloading data...');
                // Close modal
                setConfirmModal({ ...confirmModal, isOpen: false });
                // Reload data
                loadData();
              } catch (err: any) {
                console.error('[AdminDashboard] Error in delete:', err);
                setError(err.message || t('errorDeletingUser'));
                // Keep modal open to show error
              }
            },
          });
        }, 200);
      },
    });
  }

  if (!user.isAdmin) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('adminDashboard')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label={t('close')}
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
              {t('overview')}
            </span>
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-4 font-medium transition-colors relative ${
              activeTab === 'users'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {language === 'de' ? 'Benutzer' : 'Users'}
            </span>
            {activeTab === 'users' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ips')}
            className={`px-4 py-4 font-medium transition-colors relative ${
              activeTab === 'ips'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              {language === 'de' ? 'Gesperrte IPs' : 'Blocked IPs'}
            </span>
            {activeTab === 'ips' && (
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
              {language === 'de' ? 'Aktivitäts-Logs' : 'Activity Logs'}
            </span>
            {activeTab === 'activity' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-4 font-medium transition-colors relative ${
              activeTab === 'settings'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('settings')}
            </span>
            {activeTab === 'settings' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-6 rounded-xl border border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                        {language === 'de' ? 'Benutzer' : 'Users'}
                      </h3>
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                      {stats.users.total}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{stats.users.active} {language === 'de' ? 'aktiv' : 'active'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>{stats.users.admins} {language === 'de' ? 'Admins' : 'admins'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-6 rounded-xl border border-green-200 dark:border-green-800 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        {language === 'de' ? 'Dateien' : 'Files'}
                      </h3>
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-green-900 dark:text-green-100 mb-2">
                      {stats.files.total}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        <span>{formatSize(stats.files.totalStorage)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-6 rounded-xl border border-purple-200 dark:border-purple-800 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                        {language === 'de' ? 'Aktivität' : 'Activity'}
                      </h3>
                      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-2">
                      {stats.activity.last24Hours}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">
                      {language === 'de' ? 'Letzte 24 Stunden' : 'Last 24 hours'}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 p-6 rounded-xl border border-red-200 dark:border-red-800 shadow-lg hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                        {language === 'de' ? 'Gesperrte IPs' : 'Blocked IPs'}
                      </h3>
                      <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-red-900 dark:text-red-100 mb-2">
                      {stats.security.blockedIps}
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      {language === 'de' ? 'Aktive Sperren' : 'Active blocks'}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      {language === 'de' ? 'Benutzer-Verwaltung' : 'User Management'}
                    </h3>
                    
                    {/* Search and Filters */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
                      <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={language === 'de' ? 'Suche nach Name oder E-Mail...' : 'Search by name or email...'}
                              value={searchQuery}
                              onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                              }}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        </div>
                        
                        {/* Status Filter */}
                        <select
                          value={userFilters.status}
                          onChange={(e) => {
                            setUserFilters({ ...userFilters, status: e.target.value as any });
                            setCurrentPage(1);
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="all">{language === 'de' ? 'Alle Status' : 'All Status'}</option>
                          <option value="active">{language === 'de' ? 'Aktiv' : 'Active'}</option>
                          <option value="inactive">{language === 'de' ? 'Inaktiv' : 'Inactive'}</option>
                        </select>
                        
                        {/* Role Filter */}
                        <select
                          value={userFilters.role}
                          onChange={(e) => {
                            setUserFilters({ ...userFilters, role: e.target.value as any });
                            setCurrentPage(1);
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="all">{language === 'de' ? 'Alle Rollen' : 'All Roles'}</option>
                          <option value="admin">{language === 'de' ? 'Admin' : 'Admin'}</option>
                          <option value="user">{language === 'de' ? 'Benutzer' : 'User'}</option>
                        </select>
                        
                        {/* Items per page */}
                        <select
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="10">10</option>
                          <option value="25">25</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              <th 
                                className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => handleSort('name')}
                              >
                                <div className="flex items-center gap-2">
                                  {language === 'de' ? 'Name' : 'Name'}
                                  {sortConfig?.key === 'name' && (
                                    <svg className={`w-4 h-4 ${sortConfig.direction === 'asc' ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  )}
                                </div>
                              </th>
                              <th 
                                className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => handleSort('email')}
                              >
                                <div className="flex items-center gap-2">
                                  {language === 'de' ? 'E-Mail' : 'Email'}
                                  {sortConfig?.key === 'email' && (
                                    <svg className={`w-4 h-4 ${sortConfig.direction === 'asc' ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  )}
                                </div>
                              </th>
                              <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Rolle' : 'Role'}</th>
                              <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Status' : 'Status'}</th>
                              <th 
                                className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => handleSort('last_login')}
                              >
                                <div className="flex items-center gap-2">
                                  {language === 'de' ? 'Letzter Login' : 'Last Login'}
                                  {sortConfig?.key === 'last_login' && (
                                    <svg className={`w-4 h-4 ${sortConfig.direction === 'asc' ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  )}
                                </div>
                              </th>
                              <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">IP-Adresse</th>
                              <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Aktionen' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {getPaginatedItems(getSortedUsers()).map((u) => (
                              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="p-4">
                                  <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                                </td>
                                <td className="p-4">
                                  <div className="text-gray-600 dark:text-gray-400">{u.email}</div>
                                </td>
                                <td className="p-4">
                                  {u.is_admin ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                      </svg>
                                      {language === 'de' ? 'Admin' : 'Admin'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                      {language === 'de' ? 'Benutzer' : 'User'}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4">
                                  {u.is_active ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                      {language === 'de' ? 'Aktiv' : 'Active'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                      <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                                      {language === 'de' ? 'Inaktiv' : 'Inactive'}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {u.last_login
                                    ? new Date(u.last_login).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')
                                    : <span className="text-gray-400">{language === 'de' ? 'Nie' : 'Never'}</span>}
                                </td>
                                <td className="p-4">
                                  {u.last_login_ip ? (
                                    <div className="flex items-center gap-2">
                                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs font-mono">
                                        {u.last_login_ip}
                                      </code>
                                      <button
                                        onClick={() => {
                                          setIpAddress(u.last_login_ip || '');
                                          setBlockReason(language === 'de' ? `IP von Benutzer: ${u.email}` : `IP from user: ${u.email}`);
                                          setShowBlockIpModal(true);
                                        }}
                                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                        title={language === 'de' ? 'Diese IP blockieren' : 'Block this IP'}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-sm">-</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  <div className="flex gap-2 flex-wrap">
                                    <button
                                      onClick={() => {
                                        setEditingUser(u);
                                        setUserUpdates({ is_admin: u.is_admin, is_active: u.is_active });
                                      }}
                                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                      title={t('edit')}
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    {u.id !== user.id && (
                                      <>
                                        {u.is_active ? (
                                          <button
                                            onClick={() => handleDeactivateUser(u.id)}
                                            className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                            title={language === 'de' ? 'Benutzer deaktivieren' : 'Deactivate user'}
                                          >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleActivateUser(u.id)}
                                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                            title={language === 'de' ? 'Benutzer aktivieren' : 'Activate user'}
                                          >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeleteUser(u.id)}
                                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                          title={language === 'de' ? 'Benutzer permanent löschen' : 'Permanently delete user'}
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Pagination */}
                    {(() => {
                      const filteredUsers = getSortedUsers();
                      const totalPages = getTotalPages(filteredUsers.length);
                      if (totalPages <= 1) return null;
                      
                      return (
                        <div className="mt-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {language === 'de' 
                              ? `Zeige ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredUsers.length)} von ${filteredUsers.length} Benutzern`
                              : `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredUsers.length)} of ${filteredUsers.length} users`}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {language === 'de' ? 'Zurück' : 'Previous'}
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter(page => {
                                if (totalPages <= 7) return true;
                                if (page === 1 || page === totalPages) return true;
                                if (Math.abs(page - currentPage) <= 1) return true;
                                return false;
                              })
                              .map((page, idx, arr) => (
                                <React.Fragment key={page}>
                                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                                    <span className="px-2 text-gray-500">...</span>
                                  )}
                                  <button
                                    onClick={() => setCurrentPage(page)}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg ${
                                      currentPage === page
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    {page}
                                  </button>
                                </React.Fragment>
                              ))}
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {language === 'de' ? 'Weiter' : 'Next'}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {activeTab === 'ips' && (
                <div>
                  <div className="mb-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                        {language === 'de' ? 'Gesperrte IP-Adressen' : 'Blocked IP Addresses'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {language === 'de' ? 'Verwalten Sie gesperrte IP-Adressen' : 'Manage blocked IP addresses'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIpAddress('');
                        setBlockReason('');
                        setBlockExpires('');
                        setShowBlockIpModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {language === 'de' ? 'IP sperren' : 'Block IP'}
                    </button>
                  </div>

                  {/* Search and Filters */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={language === 'de' ? 'Suche nach IP-Adresse, Grund...' : 'Search by IP address, reason...'}
                            value={ipSearchQuery}
                            onChange={(e) => {
                              setIpSearchQuery(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th 
                              className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              onClick={() => handleSort('ip_address')}
                            >
                              <div className="flex items-center gap-2">
                                IP-Adresse
                                {sortConfig?.key === 'ip_address' && (
                                  <svg className={`w-4 h-4 ${sortConfig.direction === 'asc' ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                )}
                              </div>
                            </th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Grund' : 'Reason'}</th>
                            <th 
                              className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              onClick={() => handleSort('blocked_at')}
                            >
                              <div className="flex items-center gap-2">
                                {language === 'de' ? 'Gesperrt am' : 'Blocked At'}
                                {sortConfig?.key === 'blocked_at' && (
                                  <svg className={`w-4 h-4 ${sortConfig.direction === 'asc' ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                )}
                              </div>
                            </th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Läuft ab' : 'Expires'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Gesperrt von' : 'Blocked By'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Aktionen' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {(() => {
                            const filteredIps = getSortedIps();
                            if (filteredIps.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    {language === 'de' ? 'Keine gesperrten IP-Adressen gefunden' : 'No blocked IP addresses found'}
                                  </td>
                                </tr>
                              );
                            }
                            return getPaginatedItems(filteredIps).map((ip) => (
                              <tr key={ip.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="p-4">
                                  <code className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg text-sm font-mono">
                                    {ip.ip_address}
                                  </code>
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-400">
                                  {ip.reason || <span className="text-gray-400">-</span>}
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(ip.blocked_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}
                                </td>
                                <td className="p-4">
                                  {ip.expires_at ? (
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {new Date(ip.expires_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                      {language === 'de' ? 'Permanent' : 'Permanent'}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {ip.blocker ? (
                                    <div>
                                      <div className="font-medium">{ip.blocker.name}</div>
                                      <div className="text-xs text-gray-500">{ip.blocker.email}</div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  {ip.is_active && (
                                    <button
                                      onClick={() => handleUnblockIp(ip.id)}
                                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      {language === 'de' ? 'Entsperren' : 'Unblock'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Pagination */}
                  {(() => {
                    const filteredIps = getSortedIps();
                    const totalPages = getTotalPages(filteredIps.length);
                    if (totalPages <= 1) return null;
                    
                    return (
                      <div className="mt-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {language === 'de' 
                            ? `Zeige ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredIps.length)} von ${filteredIps.length} IPs`
                            : `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredIps.length)} of ${filteredIps.length} IPs`}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {language === 'de' ? 'Zurück' : 'Previous'}
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                              if (totalPages <= 7) return true;
                              if (page === 1 || page === totalPages) return true;
                              if (Math.abs(page - currentPage) <= 1) return true;
                              return false;
                            })
                            .map((page, idx, arr) => (
                              <React.Fragment key={page}>
                                {idx > 0 && arr[idx - 1] !== page - 1 && (
                                  <span className="px-2 text-gray-500">...</span>
                                )}
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                                    currentPage === page
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            ))}
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {language === 'de' ? 'Weiter' : 'Next'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'activity' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                      {language === 'de' ? 'Aktivitäts-Logs' : 'Activity Logs'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'de' ? 'Übersicht über alle Systemaktivitäten' : 'Overview of all system activities'}
                    </p>
                  </div>
                  
                  {/* Search and Filters */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={language === 'de' ? 'Suche nach Aktion, Benutzer, IP...' : 'Search by action, user, IP...'}
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setCurrentPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      
                      <select
                        value={activityFilters.action}
                        onChange={(e) => {
                          setActivityFilters({ ...activityFilters, action: e.target.value });
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="all">{language === 'de' ? 'Alle Aktionen' : 'All Actions'}</option>
                        {Array.from(new Set(activities.map(a => a.action))).map(action => (
                          <option key={action} value={action}>{action}</option>
                        ))}
                      </select>
                      
                      <input
                        type="date"
                        value={activityFilters.dateFrom}
                        onChange={(e) => {
                          setActivityFilters({ ...activityFilters, dateFrom: e.target.value });
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={language === 'de' ? 'Von' : 'From'}
                      />
                      
                      <input
                        type="date"
                        value={activityFilters.dateTo}
                        onChange={(e) => {
                          setActivityFilters({ ...activityFilters, dateTo: e.target.value });
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={language === 'de' ? 'Bis' : 'To'}
                      />
                      
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th 
                              className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              onClick={() => handleSort('created_at')}
                            >
                              <div className="flex items-center gap-2">
                                {language === 'de' ? 'Zeit' : 'Time'}
                                {sortConfig?.key === 'created_at' && (
                                  <svg className={`w-4 h-4 ${sortConfig.direction === 'asc' ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                )}
                              </div>
                            </th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Benutzer' : 'User'}</th>
                            <th 
                              className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              onClick={() => handleSort('action')}
                            >
                              <div className="flex items-center gap-2">
                                {language === 'de' ? 'Aktion' : 'Action'}
                                {sortConfig?.key === 'action' && (
                                  <svg className={`w-4 h-4 ${sortConfig.direction === 'asc' ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                )}
                              </div>
                            </th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">{language === 'de' ? 'Ressource' : 'Resource'}</th>
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">IP-Adresse</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {(() => {
                            const filteredActivities = getSortedActivities();
                            if (filteredActivities.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    {language === 'de' ? 'Keine Aktivitäten gefunden' : 'No activities found'}
                                  </td>
                                </tr>
                              );
                            }
                            return getPaginatedItems(filteredActivities).map((activity) => (
                              <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(activity.created_at).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}
                                </td>
                                <td className="p-4">
                                  {activity.user ? (
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white">{activity.user.name}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">{activity.user.email}</div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
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
                                    <div className="flex items-center gap-2">
                                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded text-xs font-mono">
                                        {activity.ip_address}
                                      </code>
                                      <button
                                        onClick={() => {
                                          setIpAddress(activity.ip_address || '');
                                          setBlockReason(language === 'de' ? `IP von Aktivität: ${activity.action}` : `IP from activity: ${activity.action}`);
                                          setShowBlockIpModal(true);
                                        }}
                                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                        title={language === 'de' ? 'Diese IP blockieren' : 'Block this IP'}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-sm">-</span>
                                  )}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Pagination */}
                  {(() => {
                    const filteredActivities = getSortedActivities();
                    const totalPages = getTotalPages(filteredActivities.length);
                    if (totalPages <= 1) return null;
                    
                    return (
                      <div className="mt-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {language === 'de' 
                            ? `Zeige ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredActivities.length)} von ${filteredActivities.length} Aktivitäten`
                            : `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredActivities.length)} of ${filteredActivities.length} activities`}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {language === 'de' ? 'Zurück' : 'Previous'}
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                              if (totalPages <= 7) return true;
                              if (page === 1 || page === totalPages) return true;
                              if (Math.abs(page - currentPage) <= 1) return true;
                              return false;
                            })
                            .map((page, idx, arr) => (
                              <React.Fragment key={page}>
                                {idx > 0 && arr[idx - 1] !== page - 1 && (
                                  <span className="px-2 text-gray-500">...</span>
                                )}
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                                    currentPage === page
                                      ? 'bg-blue-600 text-white'
                                      : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            ))}
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {language === 'de' ? 'Weiter' : 'Next'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'settings' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                      {language === 'de' ? 'System-Einstellungen' : 'System Settings'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'de' ? 'Verwalten Sie System-weite Einstellungen' : 'Manage system-wide settings'}
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Allow Registration */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {language === 'de' ? 'Registrierung erlauben' : 'Allow Registration'}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {language === 'de' 
                                ? 'Ermöglicht neuen Benutzern die Registrierung' 
                                : 'Allows new users to register'}
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={systemSettings.allow_registration === 'true'}
                            onChange={async (e) => {
                              const newValue = e.target.checked ? 'true' : 'false';
                              try {
                                setSettingsLoading(true);
                                const res = await fetch('/api/admin/settings', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ key: 'allow_registration', value: newValue }),
                                });
                                if (!res.ok) throw new Error('Failed to update setting');
                                setSystemSettings({ ...systemSettings, allow_registration: newValue });
                              } catch (err: any) {
                                setError(err.message);
                              } finally {
                                setSettingsLoading(false);
                              }
                            }}
                            className="sr-only peer"
                            disabled={settingsLoading}
                          />
                          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Allow Login */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {language === 'de' ? 'Login erlauben' : 'Allow Login'}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {language === 'de' 
                                ? 'Ermöglicht Benutzern sich anzumelden' 
                                : 'Allows users to log in'}
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={systemSettings.allow_login === 'true'}
                            onChange={async (e) => {
                              const newValue = e.target.checked ? 'true' : 'false';
                              try {
                                setSettingsLoading(true);
                                const res = await fetch('/api/admin/settings', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ key: 'allow_login', value: newValue }),
                                });
                                if (!res.ok) throw new Error('Failed to update setting');
                                setSystemSettings({ ...systemSettings, allow_login: newValue });
                              } catch (err: any) {
                                setError(err.message);
                              } finally {
                                setSettingsLoading(false);
                              }
                            }}
                            className="sr-only peer"
                            disabled={settingsLoading}
                          />
                          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Enable reCAPTCHA */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {language === 'de' ? 'reCAPTCHA aktivieren' : 'Enable reCAPTCHA'}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {language === 'de' 
                                ? 'Aktiviert Human Captcha (reCAPTCHA v3) für Login und Registrierung' 
                                : 'Enables Human Captcha (reCAPTCHA v3) for login and registration'}
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={systemSettings.enable_recaptcha === 'true'}
                            onChange={async (e) => {
                              const newValue = e.target.checked ? 'true' : 'false';
                              try {
                                setSettingsLoading(true);
                                const res = await fetch('/api/admin/settings', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ key: 'enable_recaptcha', value: newValue }),
                                });
                                if (!res.ok) throw new Error('Failed to update setting');
                                setSystemSettings({ ...systemSettings, enable_recaptcha: newValue });
                              } catch (err: any) {
                                setError(err.message);
                              } finally {
                                setSettingsLoading(false);
                              }
                            }}
                            className="sr-only peer"
                            disabled={settingsLoading}
                          />
                          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Block IP Modal */}
      {showBlockIpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {language === 'de' ? 'IP-Adresse sperren' : 'Block IP Address'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  IP-Adresse *
                </label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="192.168.1.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {language === 'de' ? 'Grund (optional)' : 'Reason (optional)'}
                </label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {language === 'de' ? 'Läuft ab (optional, leer = permanent)' : 'Expires (optional, empty = permanent)'}
                </label>
                <input
                  type="datetime-local"
                  value={blockExpires}
                  onChange={(e) => setBlockExpires(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowBlockIpModal(false);
                    setIpAddress('');
                    setBlockReason('');
                    setBlockExpires('');
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleBlockIp}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {language === 'de' ? 'Sperren' : 'Block'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {language === 'de' ? 'Benutzer bearbeiten' : 'Edit User'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={userUpdates.is_admin ?? editingUser.is_admin}
                    onChange={(e) => setUserUpdates({ ...userUpdates, is_admin: e.target.checked })}
                    className="rounded"
                  />
                  <span>{language === 'de' ? 'Admin' : 'Admin'}</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={userUpdates.is_active ?? editingUser.is_active}
                    onChange={(e) => setUserUpdates({ ...userUpdates, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <span>{language === 'de' ? 'Aktiv' : 'Active'}</span>
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setUserUpdates({});
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleUpdateUser(editingUser.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        showDetails={confirmModal.details}
        type={confirmModal.type || 'warning'}
        confirmText={confirmModal.type === 'danger' ? (language === 'de' ? 'Löschen' : 'Delete') : undefined}
      />

      {/* User Details Modal */}
      <UserDetailsModal
        isOpen={userDetailsModal.isOpen}
        onClose={() => setUserDetailsModal({ isOpen: false, userId: '' })}
        userId={userDetailsModal.userId}
      />
    </div>
  );
}

