'use client';

import { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { editor } from 'monaco-editor';

interface FileEditorProps {
  file: {
    name: string;
    path: string;
    type: 'file' | 'directory';
    isPasswordProtected?: boolean;
  } | null;
  onClose: () => void;
  onSave?: () => void;
}

export default function FileEditor({ file, onClose, onSave }: FileEditorProps) {
  const { t, language } = useLanguage();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const originalContentRef = useRef<string>('');

  // Get language for Monaco Editor based on file extension
  function getLanguageFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'mjs': 'javascript',
      'cjs': 'javascript',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'scss',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'pl': 'perl',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell',
      'bat': 'batch',
      'md': 'markdown',
      'markdown': 'markdown',
      'tex': 'latex',
      'env': 'plaintext',
      'gitignore': 'plaintext',
      'dockerfile': 'dockerfile',
      'makefile': 'makefile',
      'cmake': 'cmake',
      'sql': 'sql',
      'txt': 'plaintext',
      'log': 'plaintext',
    };
    
    return languageMap[extension] || 'plaintext';
  }

  useEffect(() => {
    if (!file) return;

    async function loadFile() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`/api/files/edit?path=${encodeURIComponent(file.path)}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to load file');
        }
        const data = await res.json();
        setContent(data.content || '');
        originalContentRef.current = data.content || '';
        setHasChanges(false);
      } catch (err: any) {
        setError(err.message || 'Error loading file');
      } finally {
        setLoading(false);
      }
    }

    loadFile();
  }, [file]);

  async function handleSave() {
    if (!file || !hasChanges) return;

    try {
      setSaving(true);
      setError('');

      const currentContent = editorRef.current?.getValue() || content;

      const res = await fetch('/api/files/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: file.path,
          content: currentContent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error saving file');
      }

      originalContentRef.current = currentContent;
      setHasChanges(false);
      if (onSave) {
        onSave();
      }
    } catch (err: any) {
      setError(err.message || 'Error saving file');
    } finally {
      setSaving(false);
    }
  }

  function handleEditorChange(value: string | undefined) {
    if (value !== undefined) {
      setContent(value);
      setHasChanges(value !== originalContentRef.current);
    }
  }


  if (!file) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            {language === 'de' ? 'Keine Datei zum Bearbeiten ausgewählt' : 'No file selected for editing'}
          </p>
        </div>
      </div>
    );
  }

  const detectedLanguage = getLanguageFromFileName(file.name);
  const isDarkMode = typeof window !== 'undefined' && 
    (document.documentElement.classList.contains('dark') || 
     window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2">
            {file.name}
            {file.isPasswordProtected && (
              <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title>{language === 'de' ? 'Passwortgeschützt' : 'Password Protected'}</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9V7a4 4 0 118 0v2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 13h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2z" />
              </svg>
            )}
            {hasChanges && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                {language === 'de' ? '(Geändert)' : '(Modified)'}
              </span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {language === 'de' ? 'Speichern...' : 'Saving...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {language === 'de' ? 'Speichern' : 'Save'}
                </>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
            </div>
          </div>
        ) : (
          <Editor
            height="100%"
            language={detectedLanguage}
            value={content}
            theme={isDarkMode ? 'vs-dark' : 'light'}
            onChange={handleEditorChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              // Add keyboard shortcut for save (Ctrl/Cmd + S)
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                handleSave();
              });
            }}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              tabSize: 2,
              insertSpaces: true,
              formatOnPaste: true,
              formatOnType: true,
            }}
          />
        )}
      </div>
    </div>
  );
}

