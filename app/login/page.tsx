'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          // User is already logged in, redirect to home
          router.push('/');
          return;
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(userData: any) {
    setUser(userData);
    
    // Check if there's a returnUrl after login
    const returnUrl = searchParams.get('returnUrl');
    if (returnUrl) {
      router.push(decodeURIComponent(returnUrl));
    } else {
      router.push('/');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Lädt...</div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return <LoginForm onLogin={handleLogin} isLoginMode={true} />;
}

