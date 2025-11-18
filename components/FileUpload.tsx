'use client';

import { useState, useRef } from 'react';
import ReplaceModal from './ReplaceModal';

interface FileUploadProps {
  currentPath: string;
  onUploaded: () => void;
}

export default function FileUpload({ currentPath, onUploaded }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [replaceModal, setReplaceModal] = useState<{ isOpen: boolean; file: File | null }>({
    isOpen: false,
    file: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, skipCheck: boolean = false) {
    setError('');
    setUploading(true);
    setProgress(0);

    try {
      // Check if file exists (unless we're replacing)
      if (!skipCheck) {
        const checkRes = await fetch(
          `/api/files/check?fileName=${encodeURIComponent(file.name)}&path=${encodeURIComponent(currentPath)}`
        );
        const checkData = await checkRes.json();
        
        if (checkData.exists) {
          setUploading(false);
          setReplaceModal({ isOpen: true, file });
          return;
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', currentPath);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Fehler beim Hochladen');
        setProgress(0);
        return;
      }

      setTimeout(() => {
        onUploaded();
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 300);
    } catch (err) {
      setError('Verbindungsfehler');
      setProgress(0);
    } finally {
      setTimeout(() => setUploading(false), 500);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
  }

  function handleReplaceConfirm() {
    if (replaceModal.file) {
      uploadFile(replaceModal.file, true);
      setReplaceModal({ isOpen: false, file: null });
    }
  }

  return (
    <>
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${
            uploading
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
          title="Datei hochladen"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span className="hidden sm:inline">{progress}%</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="hidden sm:inline">Hochladen</span>
            </>
          )}
        </label>
        {uploading && progress > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && (
          <div className="absolute top-full left-0 mt-2 text-xs text-red-600 dark:text-red-400 animate-fade-in whitespace-nowrap">
            {error}
          </div>
        )}
      </div>
      <ReplaceModal
        isOpen={replaceModal.isOpen}
        onClose={() => {
          setReplaceModal({ isOpen: false, file: null });
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
        onConfirm={handleReplaceConfirm}
        fileName={replaceModal.file?.name || ''}
      />
    </>
  );
}
