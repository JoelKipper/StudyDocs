'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import FileManager from '@/components/FileManager';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initialPath, setInitialPath] = useState<string>('');
  const [initialFile, setInitialFile] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    checkAuth();
    
    // Check for path parameter in URL
    const pathParam = searchParams.get('path');
    if (pathParam) {
      setInitialPath(decodeURIComponent(pathParam));
    }
    
    // Check for file parameter in URL (for share links)
    const fileParam = searchParams.get('file');
    if (fileParam) {
      setInitialFile(decodeURIComponent(fileParam));
    }
  }, [searchParams]);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  // Refresh user data (e.g., after email verification)
  async function refreshUser() {
    await checkAuth();
  }

  async function handleLogin(userData: any) {
    setUser(userData);
    
    // Check if there's a returnUrl after login
    const returnUrl = searchParams.get('returnUrl');
    if (returnUrl) {
      router.push(decodeURIComponent(returnUrl));
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Lädt...</div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page if not authenticated
    router.push('/login');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Weiterleitung...</div>
      </div>
    );
  }

  return <FileManager user={user} onLogout={handleLogout} initialPath={initialPath} initialFile={initialFile} />;
}

