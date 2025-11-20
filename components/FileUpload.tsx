'use client';

import { useState, useRef } from 'react';
import ReplaceModal from './ReplaceModal';

interface FileUploadProps {
  currentPath: string;
  onUploaded: () => void;
  onFolderUpload?: (files: File[]) => void;
  children?: React.ReactNode;
}

export default function FileUpload({ currentPath, onUploaded, onFolderUpload, children }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [replaceModal, setReplaceModal] = useState<{ isOpen: boolean; file: File | null }>({
    isOpen: false,
    file: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, skipCheck: boolean = false) {
    setError('');
    setUploading(true);
    setProgress(0);

    try {
      // Check if file has no extension - if so, create a folder instead
      const hasExtension = (() => {
        const name = file.name.trim();
        const lastDotIndex = name.lastIndexOf('.');
        // Has extension if: there's a dot, it's not at the start, and there's at least one character after it
        return lastDotIndex > 0 && lastDotIndex < name.length - 1;
      })();
      
      if (!hasExtension) {
        // Create a folder with the file name
        try {
          const createRes = await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create-directory',
              path: currentPath,
              name: file.name,
            }),
          });

          const createData = await createRes.json();

          if (!createRes.ok) {
            const errorMessage = createData.error || '';
            if (!errorMessage.includes('existiert bereits') && !errorMessage.includes('already exists')) {
              setError(errorMessage || 'Fehler beim Erstellen des Ordners');
              setUploading(false);
              return;
            }
          }
          
          // Refresh file list
          setTimeout(() => {
            onUploaded();
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }, 300);
          
          setUploading(false);
          return;
        } catch (err) {
          setError('Fehler beim Erstellen des Ordners');
          setUploading(false);
          return;
        }
      }
      
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Upload files one by one
    for (const file of files) {
      await uploadFile(file);
    }
  }

  async function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    
    // If onFolderUpload callback is provided, use it (for FileManager)
    // Even if files.length === 0 (empty folder), we still want to create the folder
    if (onFolderUpload) {
      onFolderUpload(files);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
      return;
    }
    
    if (files.length === 0) {
      return;
    }

    // Otherwise, upload files one by one (fallback)
    for (const file of files) {
      await uploadFile(file);
    }
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
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id={`file-upload-${currentPath}`}
        />
        <input
          ref={folderInputRef}
          type="file"
          {...({ webkitdirectory: '', directory: '' } as any)}
          multiple
          onChange={handleFolderSelect}
          disabled={uploading}
          className="hidden"
          id={`folder-upload-${currentPath}`}
        />
        {children ? (
          <label
            htmlFor={`file-upload-${currentPath}`}
            className={`cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Datei hochladen"
            onContextMenu={(e) => {
              e.preventDefault();
              folderInputRef.current?.click();
            }}
          >
            {children}
          </label>
        ) : (
          <div className="flex items-center gap-1">
            <label
              htmlFor={`file-upload-${currentPath}`}
              className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer ${
                uploading
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Datei hochladen"
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </label>
            <label
              htmlFor={`folder-upload-${currentPath}`}
              className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer ${
                uploading
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Ordner hochladen (mit allen Dateien im Ordner)"
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              )}
            </label>
          </div>
        )}
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
