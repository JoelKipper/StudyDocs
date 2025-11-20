'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface FileMetadata {
  createdBy: { id: string; name: string; email: string };
  createdAt: string;
  lastModifiedBy?: { id: string; name: string; email: string };
  lastModifiedAt?: string;
  renamedBy?: { id: string; name: string; email: string };
  renamedAt?: string;
}

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: Date;
    metadata?: FileMetadata;
    isPasswordProtected?: boolean;
  } | null;
}

export default function InfoModal({ isOpen, onClose, item }: InfoModalProps) {
  const { t, formatSize, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && item) {
      // If metadata is already available, use it
      if (item.metadata) {
        setMetadata(item.metadata);
        setLoading(false);
      } else {
        // Otherwise, fetch it from the server
        fetchMetadata();
      }
    } else {
      setMetadata(null);
      setError('');
    }
  }, [isOpen, item]);

  async function fetchMetadata() {
    if (!item) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(item.path)}`);
      const data = await res.json();

      if (res.ok && data.contents) {
        const fileItem = data.contents.find((f: any) => f.path === item.path);
        if (fileItem && fileItem.metadata) {
          setMetadata(fileItem.metadata);
        }
      } else {
        setError(data.error || (language === 'de' ? 'Fehler beim Laden der Metadaten' : 'Error loading metadata'));
      }
    } catch (err: any) {
      setError(err.message || (language === 'de' ? 'Fehler beim Laden der Metadaten' : 'Error loading metadata'));
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !item) return null;

  const displayMetadata = metadata || item.metadata;

  function getFileType(fileName: string, isDirectory: boolean): string {
    if (isDirectory) {
      return language === 'de' ? 'Ordner' : 'Directory';
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    const typeMap: { [key: string]: string } = {
      // Documents
      'pdf': 'PDF Document',
      'doc': 'Microsoft Word Document',
      'docx': 'Microsoft Word Document',
      'xls': 'Microsoft Excel Spreadsheet',
      'xlsx': 'Microsoft Excel Spreadsheet',
      'ppt': 'Microsoft PowerPoint Presentation',
      'pptx': 'Microsoft PowerPoint Presentation',
      'txt': 'Text Document',
      'rtf': 'Rich Text Format',
      'odt': 'OpenDocument Text',
      'ods': 'OpenDocument Spreadsheet',
      'odp': 'OpenDocument Presentation',
      
      // Images
      'jpg': 'JPEG Image',
      'jpeg': 'JPEG Image',
      'png': 'PNG Image',
      'gif': 'GIF Image',
      'bmp': 'Bitmap Image',
      'svg': 'SVG Image',
      'webp': 'WebP Image',
      'ico': 'Icon File',
      
      // Audio
      'mp3': 'MP3 Audio',
      'wav': 'WAV Audio',
      'flac': 'FLAC Audio',
      'aac': 'AAC Audio',
      'ogg': 'OGG Audio',
      'm4a': 'M4A Audio',
      
      // Video
      'mp4': 'MP4 Video',
      'avi': 'AVI Video',
      'mov': 'QuickTime Video',
      'wmv': 'Windows Media Video',
      'flv': 'Flash Video',
      'webm': 'WebM Video',
      'mkv': 'Matroska Video',
      
      // Archives
      'zip': 'ZIP Archive',
      'rar': 'RAR Archive',
      '7z': '7-Zip Archive',
      'tar': 'TAR Archive',
      'gz': 'GZIP Archive',
      'bz2': 'BZIP2 Archive',
      
      // Code
      'js': 'JavaScript File',
      'ts': 'TypeScript File',
      'jsx': 'React JSX File',
      'tsx': 'React TSX File',
      'html': 'HTML Document',
      'css': 'CSS Stylesheet',
      'scss': 'SCSS Stylesheet',
      'sass': 'SASS Stylesheet',
      'json': 'JSON File',
      'xml': 'XML File',
      'yaml': 'YAML File',
      'yml': 'YAML File',
      
      // Programming
      'py': 'Python Script',
      'java': 'Java Source File',
      'cpp': 'C++ Source File',
      'c': 'C Source File',
      'h': 'C Header File',
      'cs': 'C# Source File',
      'php': 'PHP Script',
      'rb': 'Ruby Script',
      'go': 'Go Source File',
      'rs': 'Rust Source File',
      'swift': 'Swift Source File',
      'kt': 'Kotlin Source File',
      
      // Markdown
      'md': 'Markdown Document',
      'markdown': 'Markdown Document',
      
      // Other
      'csv': 'CSV File',
      'exe': 'Windows Executable',
      'dmg': 'macOS Disk Image',
      'pkg': 'macOS Installer Package',
    };
    
    if (extension && typeMap[extension]) {
      return typeMap[extension];
    }
    
    if (extension) {
      return `${extension.toUpperCase()} File`;
    }
    
    return language === 'de' ? 'Datei' : 'File';
  }

  function formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '-';
      }
      return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return '-';
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {language === 'de' ? 'Dateiinformationen' : 'File Information'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-red-600 dark:text-red-400 text-center py-8">{error}</div>
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {language === 'de' ? 'Grundinformationen' : 'Basic Information'}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'de' ? 'Name' : 'Name'}:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[70%] break-words">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'de' ? 'Typ' : 'Type'}:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {getFileType(item.name, item.type === 'directory')}
                    </span>
                  </div>
                  {item.size !== undefined && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t('size')}:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatSize(item.size)}
                      </span>
                    </div>
                  )}
                  {item.modified && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t('modified')}:
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {(() => {
                          try {
                            const date = item.modified instanceof Date ? item.modified : new Date(item.modified);
                            if (isNaN(date.getTime())) {
                              return '-';
                            }
                            return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(date);
                          } catch {
                            return '-';
                          }
                        })()}
                      </span>
                    </div>
                  )}
                  {item.isPasswordProtected && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {language === 'de' ? 'Passwortschutz' : 'Password Protection'}:
                      </span>
                      <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        {language === 'de' ? 'Aktiviert' : 'Enabled'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'de' ? 'Pfad' : 'Path'}:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[70%] break-all">
                      {item.path || (language === 'de' ? 'Root' : 'Root')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              {displayMetadata && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      {language === 'de' ? 'Metadaten' : 'Metadata'}
                    </h3>
                    <div className="space-y-3">
                      {displayMetadata.createdBy && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('createdBy')}:
                          </span>
                          <div className="text-right max-w-[70%]">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {displayMetadata.createdBy.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {displayMetadata.createdBy.email}
                            </div>
                          </div>
                        </div>
                      )}
                      {displayMetadata.createdAt && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {language === 'de' ? 'Erstellt am' : 'Created At'}:
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(displayMetadata.createdAt)}
                          </span>
                        </div>
                      )}
                      {displayMetadata.lastModifiedBy && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {language === 'de' ? 'Zuletzt geändert von' : 'Last Modified By'}:
                          </span>
                          <div className="text-right max-w-[70%]">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {displayMetadata.lastModifiedBy.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {displayMetadata.lastModifiedBy.email}
                            </div>
                          </div>
                        </div>
                      )}
                      {displayMetadata.lastModifiedAt && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('modified')}:
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(displayMetadata.lastModifiedAt)}
                          </span>
                        </div>
                      )}
                      {displayMetadata.renamedBy && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {language === 'de' ? 'Umbenannt von' : 'Renamed By'}:
                          </span>
                          <div className="text-right max-w-[70%]">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {displayMetadata.renamedBy.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {displayMetadata.renamedBy.email}
                            </div>
                          </div>
                        </div>
                      )}
                      {displayMetadata.renamedAt && (
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {language === 'de' ? 'Umbenannt am' : 'Renamed At'}:
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(displayMetadata.renamedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {!displayMetadata && !loading && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  {language === 'de' ? 'Keine Metadaten verfügbar' : 'No metadata available'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

