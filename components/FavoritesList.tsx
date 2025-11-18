'use client';

import { useState, useEffect } from 'react';
import FileIcon from './FileIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface FavoriteItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
  addedAt: number;
}

interface FavoritesListProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  userId: string;
  onFavoriteRemoved?: () => void;
  refreshKey?: number;
  onFileDoubleClick?: (filePath: string, fileName: string) => void;
}

export default function FavoritesList({ currentPath, onNavigate, userId, onFavoriteRemoved, refreshKey, onFileDoubleClick }: FavoritesListProps) {
  const { t, language } = useLanguage();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  // Reload favorites when userId or refreshKey changes
  useEffect(() => {
    loadFavorites();
  }, [userId, refreshKey]);

  async function loadFavorites() {
    try {
      const res = await fetch('/api/files/favorites');
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  }

  async function removeFavorite(itemPath: string) {
    try {
      const res = await fetch(`/api/files/favorites?path=${encodeURIComponent(itemPath)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFavorites(prev => prev.filter(fav => fav.path !== itemPath));
        if (onFavoriteRemoved) {
          onFavoriteRemoved();
        }
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {language === 'de' 
            ? 'Noch keine Favoriten hinzugefügt'
            : 'No favorites added yet'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {language === 'de'
            ? 'Rechtsklicken Sie auf eine Datei oder einen Ordner, um sie zu Favoriten hinzuzufügen'
            : 'Right-click on a file or folder to add it to favorites'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {favorites.map((favorite, index) => {
        const isActive = currentPath === favorite.path;
        const isDirectory = favorite.type === 'directory';
        
        return (
          <div
            key={favorite.path}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 animate-slide-down-stagger ${
              isActive
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
            }`}
            style={{
              animationDelay: `${index * 30}ms`,
            }}
          >
            <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${
              isActive ? 'text-white' : isDirectory ? 'text-blue-500' : 'text-gray-400'
            }`}>
              <FileIcon 
                fileName={favorite.name} 
                isDirectory={isDirectory}
                className="w-5 h-5"
              />
            </div>
            <button
              onClick={() => {
                if (isDirectory) {
                  onNavigate(favorite.path);
                } else {
                  // For files, navigate to parent directory
                  const parentPath = favorite.path.split('/').slice(0, -1).join('/');
                  onNavigate(parentPath);
                }
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isDirectory && onFileDoubleClick) {
                  onFileDoubleClick(favorite.path, favorite.name);
                }
              }}
              className="flex-1 text-left truncate min-w-0"
            >
              {favorite.name}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFavorite(favorite.path);
              }}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 ${
                isActive ? 'text-white hover:bg-blue-700' : 'text-gray-400'
              }`}
              title={language === 'de' ? 'Aus Favoriten entfernen' : 'Remove from favorites'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

