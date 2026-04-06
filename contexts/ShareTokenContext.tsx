'use client';

import { createContext, useContext } from 'react';

export const ShareTokenContext = createContext<string | null>(null);

export function useShareToken(): string | null {
  return useContext(ShareTokenContext);
}

export function appendShareToUrl(url: string, shareToken: string | null): string {
  if (!shareToken) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}shareToken=${encodeURIComponent(shareToken)}`;
}
