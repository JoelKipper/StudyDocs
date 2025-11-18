'use client';

import { useState } from 'react';

interface CreateDirectoryProps {
  currentPath: string;
  onCreated: () => void;
}

export default function CreateDirectory({ currentPath, onCreated }: CreateDirectoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-directory',
          path: currentPath,
          name: name.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Fehler beim Erstellen');
        return;
      }

      setName('');
      setIsOpen(false);
      onCreated();
    } catch (err) {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Neues Verzeichnis erstellen"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-1.5 items-center animate-scale-in"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Verzeichnisname"
        autoFocus
        className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-w-[150px]"
      />
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="p-1.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Erstellen"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 dark:border-green-400"></div>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setIsOpen(false);
          setName('');
          setError('');
        }}
        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Abbrechen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 animate-fade-in whitespace-nowrap">{error}</div>
      )}
    </form>
  );
}
