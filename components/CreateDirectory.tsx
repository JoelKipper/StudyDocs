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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
        title="Neues Verzeichnis erstellen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span className="hidden sm:inline">Neues Verzeichnis</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 items-center animate-scale-in bg-white dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-600 shadow-lg"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Verzeichnisname"
        autoFocus
        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
      />
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Erstellen</span>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setIsOpen(false);
          setName('');
          setError('');
        }}
        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm font-medium transition-colors"
      >
        Abbrechen
      </button>
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 animate-fade-in">{error}</div>
      )}
    </form>
  );
}
