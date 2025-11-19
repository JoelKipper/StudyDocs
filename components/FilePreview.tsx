'use client';

import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ShareModal from './ShareModal';

interface FilePreviewProps {
  file: { name: string; path: string; type: 'file' | 'directory' } | null;
  onClose: () => void;
}

export default function FilePreview({ file, onClose }: FilePreviewProps) {
  const { t, language } = useLanguage();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | 'text' | 'video' | 'audio' | 'office' | 'unsupported' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [shareModal, setShareModal] = useState<{
    isOpen: boolean;
    itemName: string;
    itemPath: string;
    itemType: 'file' | 'directory';
  }>({
    isOpen: false,
    itemName: '',
    itemPath: '',
    itemType: 'file',
  });

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setPreviewType(null);
      setLoading(false);
      setError('');
      return;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Determine preview type
    if (fileExtension === 'pdf') {
      setPreviewType('pdf');
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(fileExtension)) {
      setPreviewType('image');
    } else if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'sh', 'yaml', 'yml'].includes(fileExtension)) {
      setPreviewType('text');
    } else if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv'].includes(fileExtension)) {
      setPreviewType('video');
    } else if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(fileExtension)) {
      setPreviewType('audio');
    } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(fileExtension)) {
      setPreviewType('office');
    } else {
      setPreviewType('unsupported');
      setLoading(false);
      return;
    }

    // For PDFs, use direct URL (simpler approach)
    if (fileExtension === 'pdf') {
      const url = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
      setPreviewUrl(url);
      setLoading(true); // Will be set to false when object/iframe loads
      setError('');
      
      // Add timeout fallback in case onLoad doesn't fire
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 10000); // 10 seconds timeout
      
      return () => {
        clearTimeout(timeout);
      };
    } else if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(fileExtension)) {
      // For video and audio, use direct URL
      const url = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
      setPreviewUrl(url);
      setLoading(false);
    } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(fileExtension)) {
      // For Office documents, use Microsoft Office Online Viewer
      const url = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
      setPreviewUrl(url);
      setLoading(true);
      
      // Timeout for Office documents
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 10000);
      
      return () => {
        clearTimeout(timeout);
      };
    } else {
      // For other types (images, text), use direct URL
      const url = `/api/files/preview?path=${encodeURIComponent(file.path)}`;
      setPreviewUrl(url);
      setLoading(false);
      
      return () => {
        // Cleanup
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }
  }, [file, language]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && file) {
        onClose();
      }
    }

    if (file) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [file, onClose]);

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
            {language === 'de' ? 'Wählen Sie eine Datei aus, um die Vorschau anzuzeigen' : 'Select a file to view preview'}
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
              {previewType === 'pdf' ? (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              ) : previewType === 'image' ? (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : previewType === 'text' ? (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : previewType === 'video' ? (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : previewType === 'audio' ? (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              ) : previewType === 'office' ? (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {language === 'de' ? 'Vorschau' : 'Preview'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setShareModal({
                  isOpen: true,
                  itemName: file.name,
                  itemPath: file.path,
                  itemType: file.type,
                });
              }}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('share')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <a
              href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
              download={file.name}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('download')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('close')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className={`flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 ${previewType === 'pdf' ? 'p-0 relative' : 'p-4'}`} style={{ position: 'relative', minHeight: '100%' }}>
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">{error}</p>
            </div>
          </div>
        ) : previewType === 'unsupported' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {language === 'de' 
                  ? 'Vorschau für diesen Dateityp nicht verfügbar'
                  : 'Preview not available for this file type'
                }
              </p>
              <a
                href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
                download={file.name}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('download')}
              </a>
            </div>
          </div>
        ) : previewType === 'pdf' && previewUrl ? (
          <div className="w-full h-full relative" style={{ minHeight: '100%', height: '100%' }}>
            {/* Use object tag for better PDF support */}
            <object
              data={previewUrl}
              type="application/pdf"
              className="w-full h-full border-0"
              style={{ 
                width: '100%', 
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
              onLoad={() => {
                setLoading(false);
                setError('');
              }}
              onError={(e) => {
                setLoading(false);
                setError(language === 'de' ? 'Fehler beim Laden der PDF-Datei' : 'Error loading PDF file');
              }}
            >
              {/* Fallback if object doesn't work */}
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                title={file.name}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0
                }}
                onLoad={() => {
                  setLoading(false);
                  setError('');
                }}
                onError={(e) => {
                  setLoading(false);
                  setError(language === 'de' ? 'Fehler beim Laden der PDF-Datei' : 'Error loading PDF file');
                }}
              />
            </object>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">{error}</p>
                </div>
              </div>
            )}
          </div>
        ) : previewType === 'image' && previewUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={previewUrl}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          </div>
        ) : previewType === 'text' && previewUrl ? (
          <TextPreview url={previewUrl} />
        ) : previewType === 'video' && previewUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video
              src={previewUrl}
              controls
              className="max-w-full max-h-full"
              onLoadedData={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(language === 'de' ? 'Fehler beim Laden des Videos' : 'Error loading video');
              }}
            >
              {language === 'de' ? 'Ihr Browser unterstützt das Video-Tag nicht.' : 'Your browser does not support the video tag.'}
            </video>
          </div>
        ) : previewType === 'audio' && previewUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
            <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{file.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {language === 'de' ? 'Audio-Wiedergabe' : 'Audio Player'}
                  </p>
                </div>
              </div>
              <audio
                src={previewUrl}
                controls
                className="w-full"
                onLoadedData={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(language === 'de' ? 'Fehler beim Laden der Audio-Datei' : 'Error loading audio file');
                }}
              >
                {language === 'de' ? 'Ihr Browser unterstützt das Audio-Tag nicht.' : 'Your browser does not support the audio tag.'}
              </audio>
            </div>
          </div>
        ) : previewType === 'office' && previewUrl ? (
          <div className="w-full h-full relative">
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin + previewUrl : previewUrl)}`}
              className="w-full h-full border-0"
              title={file.name}
              onLoad={() => {
                setLoading(false);
                setError('');
              }}
              onError={() => {
                setLoading(false);
                setError(language === 'de' ? 'Fehler beim Laden des Office-Dokuments. Bitte laden Sie die Datei herunter.' : 'Error loading Office document. Please download the file.');
              }}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                  <a
                    href={`/api/files/download?path=${encodeURIComponent(file.path)}`}
                    download={file.name}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {t('download')}
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, itemName: '', itemPath: '', itemType: 'file' })}
        itemName={shareModal.itemName}
        itemPath={shareModal.itemPath}
        itemType={shareModal.itemType}
      />
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadText() {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Failed to load file');
        }
        const text = await res.text();
        setContent(text);
      } catch (err) {
        setError('Failed to load file content');
      } finally {
        setLoading(false);
      }
    }

    loadText();
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full h-full overflow-auto">
      <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono">
        {content}
      </pre>
    </div>
  );
}

