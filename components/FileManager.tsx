'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import FileTree from './FileTree';
import FileUpload from './FileUpload';
import ContextMenu from './ContextMenu';
import DeleteModal from './DeleteModal';
import ReplaceModal from './ReplaceModal';
import Toast from './Toast';
import SearchBar from './SearchBar';
import SettingsModal from './SettingsModal';
import ShareModal from './ShareModal';
import FilePreview from './FilePreview';
import FileIcon from './FileIcon';
import StorageQuota from './StorageQuota';
import FavoritesList from './FavoritesList';
import { useLanguage } from '@/contexts/LanguageContext';

interface FileMetadata {
  createdBy: { id: string; name: string; email: string };
  createdAt: string;
  lastModifiedBy?: { id: string; name: string; email: string };
  lastModifiedAt?: string;
  renamedBy?: { id: string; name: string; email: string };
  renamedAt?: string;
}

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  metadata?: FileMetadata;
}

type SortField = 'name' | 'size' | 'type' | 'modified';
type SortDirection = 'asc' | 'desc';

interface FileManagerProps {
  user: { id: string; name: string; email: string };
  onLogout: () => void;
  initialPath?: string;
  initialFile?: string;
}

export default function FileManager({ user, onLogout, initialPath, initialFile: initialFileProp }: FileManagerProps) {
  const { t, formatSize, language } = useLanguage();
  const storageKey = `studydocs-path-${user.id}`;
  
  // Load saved path from localStorage on mount, or use initialPath if provided
  const [currentPath, setCurrentPath] = useState(() => {
    if (initialPath) {
      return initialPath;
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return saved || '';
    }
    return '';
  });
  
  // Track if initialFile has been processed
  const [initialFileProcessed, setInitialFileProcessed] = useState(false);
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]); // All files for global search
  const [recursiveFiles, setRecursiveFiles] = useState<FileItem[]>([]); // All files recursively from current path
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [refreshFolderPath, setRefreshFolderPath] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: FileItem | null;
    isEmpty: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
    isEmpty: false,
  });
  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    item: FileItem | null;
    items: FileItem[];
  }>({
    visible: false,
    item: null,
    items: [],
  });
  const [renamingItem, setRenamingItem] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [creatingNewDirectory, setCreatingNewDirectory] = useState<FileItem | null>(null);
  const [newDirectoryName, setNewDirectoryName] = useState('');
  const newDirectoryInputRef = useRef<HTMLInputElement>(null);
  const [pendingRenameDirectory, setPendingRenameDirectory] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; id: number } | null>(null);
  const toastIdCounter = useRef(0);
  
  // Helper function to show toast with auto-incrementing ID
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, id: ++toastIdCounter.current });
  }, []);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<{
    fileType: 'all' | 'file' | 'directory';
    fileExtensions?: string[];
    minSize?: number;
    maxSize?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }>({
    fileType: 'all',
  });
  const [copiedItems, setCopiedItems] = useState<FileItem[]>([]);
  const [isCopyMode, setIsCopyMode] = useState(false); // true = copy, false = cut
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [actionHistory, setActionHistory] = useState<Array<{ type: string; data: any }>>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileListRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`studydocs-sidebar-width-${user.id}`);
      return saved ? parseInt(saved, 10) : 256; // 256px = w-64
    }
    return 256;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`studydocs-sidebar-collapsed-${user.id}`);
      return saved === 'true';
    }
    return false;
  });
  const [pullToRefresh, setPullToRefresh] = useState({ isPulling: false, distance: 0 });
  const pullStartY = useRef<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<FileItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const [externalDragTarget, setExternalDragTarget] = useState<string | null>(null);
  const [internalDragOver, setInternalDragOver] = useState(false);
  const [replaceModal, setReplaceModal] = useState<{
    isOpen: boolean;
    file: File | null;
    targetPath: string;
  }>({
    isOpen: false,
    file: null,
    targetPath: '',
  });
  const [uploadQueue, setUploadQueue] = useState<Array<{ file: File; targetPath: string; relativePath?: string; folderName?: string }>>([]);
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
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'tree' | 'favorites'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`studydocs-sidebar-tab-${user.id}`);
      return (saved === 'favorites' ? 'favorites' : 'tree') as 'tree' | 'favorites';
    }
    return 'tree';
  });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [previewWidth, setPreviewWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`studydocs-preview-width-${user.id}`);
      return saved ? parseInt(saved, 10) : 50; // 50% default
    }
    return 50;
  });
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 }); // Virtualisierung: nur sichtbare Zeilen rendern
  const fileListContainerRef = useRef<HTMLDivElement>(null);
  const [filesLoaded, setFilesLoaded] = useState(false); // Track when files are loaded to trigger animation
  
  // Marquee selection state
  const [marqueeSelection, setMarqueeSelection] = useState<{
    isActive: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Save path to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, currentPath);
    }
  }, [currentPath, storageKey]);

  // Save sidebar width to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`studydocs-sidebar-width-${user.id}`, sidebarWidth.toString());
    }
  }, [sidebarWidth, user.id]);

  // Save sidebar collapsed state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`studydocs-sidebar-collapsed-${user.id}`, sidebarCollapsed.toString());
    }
  }, [sidebarCollapsed, user.id]);


  // Save preview width to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`studydocs-preview-width-${user.id}`, previewWidth.toString());
    }
  }, [previewWidth, user.id]);

  // Handle sidebar resize (Desktop only)
  useEffect(() => {
    if (isMobile) return; // Don't allow resizing on mobile
    
    function handleMouseMove(e: MouseEvent) {
      if (!isResizing) return;
      
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    }

    function handleMouseUp() {
      setIsResizing(false);
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, isMobile]);

  // Handle preview resize
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isResizingPreview) return;
      
      const containerWidth = window.innerWidth - sidebarWidth;
      if (containerWidth <= 0) return; // Prevent division by zero
      
      // Calculate position relative to the container (after sidebar)
      const relativeX = e.clientX - sidebarWidth;
      // Convert to percentage
      const percentage = (relativeX / containerWidth) * 100;
      // Clamp between 0 and 100
      const clampedWidth = Math.max(0, Math.min(100, percentage));
      setPreviewWidth(clampedWidth);
    }

    function handleMouseUp(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      setIsResizingPreview(false);
    }

    if (isResizingPreview) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'none';
    } else {
      document.body.style.pointerEvents = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };
  }, [isResizingPreview, sidebarWidth]);

  useEffect(() => {
    loadFiles();
    // Reset visible range when path changes - will be updated when files load
    setVisibleRange({ start: 0, end: 100 });
    setFilesLoaded(false); // Reset animation trigger when path changes
  }, [currentPath]);

  // Update visible range when files change
  useEffect(() => {
    if (loading) return;
    
    const sorted = getSortedFiles();
    
    // If less than 100 files, show all
    if (sorted.length <= 100) {
      setVisibleRange({ start: 0, end: sorted.length });
      return;
    }
    
    // For more than 100 files, ensure at least first 100 are visible
    setVisibleRange((prev) => {
      if (prev.end === 0 || prev.end < 50) {
        return { start: 0, end: 100 };
      }
      return prev;
    });
  }, [files, sortField, sortDirection, loading]);

  // Marquee selection handlers - defined before useEffect
  const handleMarqueeMouseMove = useCallback((e: MouseEvent) => {
    if (!marqueeSelection?.isActive || !marqueeStartRef.current) return;

    const container = fileListContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top + container.scrollTop;

    setMarqueeSelection({
      isActive: true,
      startX: marqueeStartRef.current.x,
      startY: marqueeStartRef.current.y,
      endX,
      endY,
    });

    // Update selection in real-time as marquee moves
    const sorted = getSortedFiles();
    const newSelection = new Set<string>();

    const minX = Math.min(marqueeStartRef.current.x, endX);
    const maxX = Math.max(marqueeStartRef.current.x, endX);
    const minY = Math.min(marqueeStartRef.current.y, endY);
    const maxY = Math.max(marqueeStartRef.current.y, endY);

    sorted.forEach((file) => {
      const row = container.querySelector(`tr[data-file-path="${file.path}"]`) as HTMLElement;
      if (row) {
        const rowRect = row.getBoundingClientRect();
        const rowTop = rowRect.top - rect.top + container.scrollTop;
        const rowBottom = rowTop + rowRect.height;
        const rowLeft = rowRect.left - rect.left;
        const rowRight = rowLeft + rowRect.width;

        // Check if row intersects with marquee rectangle
        const intersects =
          rowLeft < maxX &&
          rowRight > minX &&
          rowTop < maxY &&
          rowBottom > minY;

        if (intersects) {
          newSelection.add(file.path);
        }
      }
    });

    setSelectedItems(newSelection);
  }, [marqueeSelection]);

  const handleMarqueeMouseUp = useCallback(() => {
    if (marqueeSelection?.isActive) {
      setMarqueeSelection(null);
      marqueeStartRef.current = null;
    }
  }, [marqueeSelection]);

  // Marquee selection event listeners
  useEffect(() => {
    if (marqueeSelection?.isActive) {
      document.addEventListener('mousemove', handleMarqueeMouseMove);
      document.addEventListener('mouseup', handleMarqueeMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMarqueeMouseMove);
        document.removeEventListener('mouseup', handleMarqueeMouseUp);
      };
    }
  }, [marqueeSelection, handleMarqueeMouseMove, handleMarqueeMouseUp]);

  // Virtualisierung: Intersection Observer für Lazy Loading beim Scrollen
  useEffect(() => {
    if (!fileListContainerRef.current || loading) return;

    const sorted = getSortedFiles();
    if (sorted.length === 0) return;

    const container = fileListContainerRef.current;
    const rows = container.querySelectorAll('tbody tr[data-index]');
    if (rows.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);
            // Erweitere sichtbaren Bereich mit Buffer
            setVisibleRange((prev: { start: number; end: number }) => ({
              start: Math.max(0, Math.min(prev.start, index - 10)),
              end: Math.min(sorted.length, Math.max(prev.end, index + 10)),
            }));
          }
        });
      },
      {
        root: container,
        rootMargin: '200px', // Buffer für frühes Laden
        threshold: 0.1,
      }
    );

    rows.forEach((row: Element) => observer.observe(row));

    return () => {
      rows.forEach((row: Element) => observer.unobserve(row));
      observer.disconnect();
    };
  }, [files, sortField, sortDirection, loading, visibleRange]);

  // When files are loaded and we have an initialFile (from share link), open it in preview
  useEffect(() => {
    if (initialFileProp && files.length > 0 && !previewFile && !loading && !initialFileProcessed) {
      const file = files.find(f => f.name === initialFileProp && f.type === 'file');
      if (file) {
        setPreviewFile(file);
        setInitialFileProcessed(true);
      }
    }
  }, [files, initialFileProp, previewFile, loading, initialFileProcessed]);

  // When files are loaded and we have a pending rename directory, set it to rename mode
  useEffect(() => {
    if (pendingRenameDirectory && files.length > 0 && !renamingItem && !creatingNewDirectory) {
      const directory = files.find(f => f.path === pendingRenameDirectory);
      if (directory) {
        setRenamingItem(directory);
        setRenameValue(directory.name);
        setPendingRenameDirectory(null);
        // Focus input after state update, but don't select the text
        setTimeout(() => {
          renameInputRef.current?.focus();
          // Move cursor to end instead of selecting
          if (renameInputRef.current) {
            const length = renameInputRef.current.value.length;
            renameInputRef.current.setSelectionRange(length, length);
          }
        }, 50);
      }
    }
  }, [files, pendingRenameDirectory, renamingItem, creatingNewDirectory]);

  useEffect(() => {
    setSelectedItems(new Set());
    lastSelectedIndexRef.current = null;
  }, [currentPath]);

  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; completed: number; current: string } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Array<{ fileName: string; error: string }>>([]);

  useEffect(() => {
    async function processUploadQueue() {
      // Prevent multiple simultaneous uploads
      if (uploadQueue.length === 0 || replaceModal.isOpen || isProcessingUpload) {
        return;
      }

      setIsProcessingUpload(true);
      const { file, targetPath, relativePath, folderName } = uploadQueue[0];
      const totalFiles = uploadQueue.length;
      
      // Clear upload progress first - we'll set it only if file doesn't exist
      setUploadProgress(null);
      
      try {
        // Check if file exists FIRST, before showing upload progress
        let fileExists = false;
        try {
          const checkRes = await fetch(
            `/api/files/check?fileName=${encodeURIComponent(file.name)}&path=${encodeURIComponent(targetPath)}`
          );
          
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.exists) {
              fileExists = true;
            }
          }
        } catch (error) {
          // Continue with upload even if check fails
        }
        
        // If file exists, show replace modal and don't show upload progress
        if (fileExists) {
          setReplaceModal({ isOpen: true, file, targetPath });
          setIsProcessingUpload(false);
          return;
        }
        
        // File doesn't exist, proceed with upload - NOW show upload progress
        setUploadProgress({
          total: totalFiles,
          completed: 0,
          current: file.name
        });

        // Validate file before upload
        if (!file || file.size === undefined) {
          // Skip this file and continue with next
          setUploadQueue((queue) => queue.slice(1));
          setIsProcessingUpload(false);
          return;
        }
        
        // Only skip files that are truly invalid (no name at all)
        // Allow files without extension or type - they might be valid text files or other formats
        if (!file.name || file.name.trim() === '') {
          // Skip this file and continue with next
          setUploadQueue((queue) => queue.slice(1));
          setIsProcessingUpload(false);
          return;
        }
        
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
                path: targetPath,
                name: file.name,
              }),
            });

            const createData = await createRes.json();

            if (!createRes.ok) {
              const errorMessage = createData.error || '';
              if (!errorMessage.includes('existiert bereits') && !errorMessage.includes('already exists')) {
                throw new Error(errorMessage || 'Fehler beim Erstellen des Ordners');
              }
            }
            
            // Invalidate cache and refresh file list and tree
            invalidateCache(targetPath);
            
            // Also invalidate tree cache for the parent folder
            if (typeof window !== 'undefined') {
              try {
                const treeCacheKey = `studydocs-tree-${user.id}-${targetPath || 'root'}`;
                localStorage.removeItem(treeCacheKey);
              } catch (error) {
                // Ignore errors
              }
            }
            
            await loadFiles();
            
            // Refresh the parent folder in tree to show the new folder
            setRefreshFolderPath(targetPath);
            setTimeout(() => setRefreshFolderPath(null), 100);
            setTreeRefreshKey((k) => k + 1);
            
            // Remove this item from queue and continue with next
            setUploadQueue((queue) => queue.slice(1));
            setIsProcessingUpload(false);
            return;
          } catch (err: any) {
            // Remove this item from queue and continue with next
            setUploadQueue((queue) => queue.slice(1));
            setIsProcessingUpload(false);
            return;
          }
        }
        
        // For 0-byte files, create a minimal buffer to ensure FormData works
        // Some browsers have issues with truly empty files in FormData
        let fileToUpload: File = file;
        if (file.size === 0) {
          // Create a new File object with a minimal content for 0-byte files
          // Use a single space character to ensure the file has content
          const emptyBlob = new Blob([' '], { type: file.type || 'text/plain' });
          fileToUpload = new File([emptyBlob], file.name, {
            type: file.type || 'text/plain',
            lastModified: file.lastModified || Date.now()
          });
        }
        
        // File doesn't exist, upload it
        const formData = new FormData();
        formData.append('file', fileToUpload);
        
        // If this is a folder upload, preserve the folder structure
        let uploadPath: string;
        if (relativePath && folderName) {
          // targetPath already contains the folder name (set in handleFolderUpload)
          // relativePath contains the path within the folder (including subdirectories and filename)
          // So we just need: targetPath/relativePath
          uploadPath = targetPath ? `${targetPath}/${relativePath}` : relativePath;
        } else {
          // For regular files, include the filename in the path
          // API will check if path ends with filename and handle accordingly
          uploadPath = targetPath ? `${targetPath}/${file.name}` : file.name;
        }
        
        // Validate and clean the path
        uploadPath = uploadPath.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
        
        formData.append('path', uploadPath);

        let res: Response;
        let timeoutId: NodeJS.Timeout | null = null;
        try {
          // Use a timeout to prevent hanging requests
          const controller = new AbortController();
          timeoutId = setTimeout(() => {
            controller.abort();
          }, 60000); // 60 second timeout
          
          res = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
            // Don't set Content-Type header - browser will set it automatically with boundary for FormData
          });
          
          if (timeoutId) clearTimeout(timeoutId);
        } catch (fetchError: any) {
          if (timeoutId) clearTimeout(timeoutId);
          
          // Check if it's an abort (timeout)
          if (fetchError.name === 'AbortError' || fetchError instanceof DOMException) {
            throw new Error('Upload-Timeout: Die Verbindung dauerte zu lange');
          }
          
          // Check if it's a size issue
          if (file.size > 100 * 1024 * 1024) { // 100MB
            throw new Error(`Datei zu groß (${Math.round(file.size / 1024 / 1024)}MB). Maximale Größe: 100MB`);
          }
          
          // More specific error message
          const errorMsg = fetchError.message || 'Verbindung fehlgeschlagen';
          if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
            throw new Error(`Netzwerkfehler: Die Verbindung zum Server konnte nicht hergestellt werden. Bitte prüfe, ob der Server läuft.`);
          }
          
          throw new Error(`Netzwerkfehler: ${errorMsg}`);
        }

        // Check if response is ok before trying to parse JSON
        if (!res.ok) {
          let errorMessage = 'Fehler beim Hochladen';
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            // If JSON parsing fails, use status text
            errorMessage = res.statusText || `HTTP ${res.status}`;
          }
          throw new Error(errorMessage);
        }

        const data = await res.json();

        // Invalidate cache and tree cache for the target path
        invalidateCache(targetPath);
        if (typeof window !== 'undefined') {
          try {
            const treeCacheKey = `studydocs-tree-${user.id}-${targetPath || 'root'}`;
            localStorage.removeItem(treeCacheKey);
          } catch (error) {
            // Ignore errors
          }
        }
        
        // Refresh the parent folder in tree to show the new file
        setRefreshFolderPath(targetPath);
        setTimeout(() => setRefreshFolderPath(null), 100);

        // Update progress after successful upload
        if (uploadProgress) {
          const newCompleted = uploadProgress.completed + 1;
          const remainingFiles = uploadQueue.length - 1; // -1 because we just processed one
          const nextFile = remainingFiles > 0 ? uploadQueue[1]?.file.name : '';
          setUploadProgress({
            total: uploadProgress.total,
            completed: newCompleted,
            current: nextFile || ''
          });
        }
      } catch (error: any) {
        // Only show error for real errors, not temporary issues
        const errorMessage = error.message || 'Unbekannter Fehler';
        if (!errorMessage.includes('network') && !errorMessage.includes('timeout') && !errorMessage.includes('fetch')) {
          setUploadErrors(prev => [...prev, { fileName: file.name, error: errorMessage }]);
        }
      } finally {
        // Process next file in queue
        setUploadQueue((queue) => {
          return queue.slice(1);
        });
        setIsProcessingUpload(false);
      }
    }

    if (uploadQueue.length > 0 && !replaceModal.isOpen && !isProcessingUpload) {
      // Add small delay to prevent race conditions
      const timeoutId = setTimeout(() => {
        processUploadQueue();
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [uploadQueue, replaceModal.isOpen, isProcessingUpload, uploadProgress]);

  async function uploadSingleFile(file: File, targetPath: string) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', targetPath);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Hochladen');
      }
      return { success: true, fileName: file.name };
    } catch (error: any) {
      return { success: false, fileName: file.name, error: error.message };
    }
  }

  // Define handleFolderUpload first so it can be used by handleExternalFilesDrop
  const handleFolderUpload = useCallback(async (files: File[], targetPathOverride?: string) => {
    let folderName: string;
    
    // If folder is empty (no files), we need to ask for folder name
    if (files.length === 0) {
      // For empty folders, we can't extract the name from webkitRelativePath
      // Ask the user for the folder name, or use a default name
      const userInput = prompt('Bitte geben Sie den Namen für den leeren Ordner ein (oder lassen Sie leer für Standard-Namen):');
      if (userInput === null) {
        // User cancelled
        return;
      }
      if (userInput && userInput.trim()) {
        folderName = userInput.trim();
      } else {
        // Use default name if user left it empty
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
        folderName = `New Folder ${timestamp}`;
      }
    } else {
      // Filter out only truly invalid files (no name at all)
      const validFiles = files.filter(file => {
        // Only skip files without names
        if (!file.name || file.name.trim() === '') {
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) {
        // Even if no valid files, we still want to create a folder
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
        folderName = `New Folder ${timestamp}`;
      } else {
        // Extract folder name from first file's webkitRelativePath
        const firstFile = validFiles[0];
        const firstRelativePath = (firstFile as any).webkitRelativePath;
        
        if (!firstRelativePath) {
          // If no webkitRelativePath, create a folder with a default name
          const now = new Date();
          const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
          folderName = `Uploaded Folder ${timestamp}`;
        } else {
          folderName = firstRelativePath.split('/')[0];
        }
      }
    }

    // Use targetPathOverride if provided (for drag-and-drop), otherwise use currentPath
    const uploadTargetPath = targetPathOverride !== undefined ? targetPathOverride : currentPath;

    // First, create the folder with the same name
    try {
      const createRes = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-directory',
          path: uploadTargetPath,
          name: folderName,
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        // If folder already exists, that's okay - continue with upload
        const errorMessage = createData.error || '';
        if (!errorMessage.includes('existiert bereits') && !errorMessage.includes('already exists')) {
          showToast(errorMessage || t('errorDeleting'), 'error');
          return;
        }
      }
    } catch (err) {
      showToast(t('serverError'), 'error');
      return;
    }

    // Construct the target path for files (inside the newly created folder)
    const targetFolderPath = uploadTargetPath ? `${uploadTargetPath}/${folderName}` : folderName;

    // If there are files to upload, upload them directly
    if (files.length > 0) {
      // Filter out only truly invalid files (no name at all)
      const validFiles = files.filter(file => {
        if (!file.name || file.name.trim() === '') {
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        // Don't limit - upload ALL files
        const filesToUpload = validFiles;
        
        // Show progress
        setUploadProgress({
          total: filesToUpload.length,
          completed: 0,
          current: filesToUpload[0]?.name || ''
        });

        // Upload files directly one by one
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];
          const fileRelativePath = (file as any).webkitRelativePath;
          
          // Determine the relative path within the folder
          let pathWithinFolder: string;
          if (fileRelativePath) {
            // Remove the folder name from the path to get the relative path within the folder
            if (fileRelativePath.startsWith(`${folderName}/`)) {
              pathWithinFolder = fileRelativePath.substring(folderName.length + 1);
            } else if (fileRelativePath === folderName) {
              // File is directly in the folder root
              pathWithinFolder = file.name;
            } else {
              // Fallback: use the file name
              pathWithinFolder = file.name;
            }
          } else {
            // If no webkitRelativePath, just use the file name
            pathWithinFolder = file.name;
          }
          
          // Construct the full upload path - ensure it includes the filename at the end
          let uploadPath: string;
          if (pathWithinFolder.includes('/')) {
            // Path already includes subdirectories and filename
            uploadPath = `${targetFolderPath}/${pathWithinFolder}`;
          } else {
            // Just filename, add it to the target path
            uploadPath = `${targetFolderPath}/${pathWithinFolder}`;
          }
          
          // Clean up the path
          uploadPath = uploadPath.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
          
          // Update progress
          setUploadProgress(prev => prev ? {
            ...prev,
            current: file.name,
            completed: i
          } : null);
          
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', uploadPath);
            
            const res = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData,
            });
            
            const data = await res.json();
            
            if (res.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error: any) {
            errorCount++;
          }
        }
        
        // Clear progress
        setUploadProgress(null);
        
        // Show result
        if (errorCount === 0) {
          showToast(`${successCount} Dateien erfolgreich hochgeladen.`, 'success');
        } else {
          showToast(`${successCount} Dateien hochgeladen, ${errorCount} Fehler.`, 'error');
        }
        
        // Invalidate cache and refresh file list and tree
        invalidateCache(targetFolderPath);
        invalidateCache(uploadTargetPath);
        
        // Also invalidate tree cache for the parent folder
        if (typeof window !== 'undefined') {
          try {
            const treeCacheKey = `studydocs-tree-${user.id}-${uploadTargetPath || 'root'}`;
            localStorage.removeItem(treeCacheKey);
          } catch (error) {
            // Ignore errors
          }
        }
        
        await loadFiles();
        
        // Refresh the parent folder in tree to show the new folder and files
        setRefreshFolderPath(uploadTargetPath);
        setTimeout(() => setRefreshFolderPath(null), 100);
        setTreeRefreshKey((k) => k + 1);
      } else {
        // Folder created but no valid files to upload
        invalidateCache(uploadTargetPath);
        
        // Also invalidate tree cache for the parent folder
        if (typeof window !== 'undefined') {
          try {
            const treeCacheKey = `studydocs-tree-${user.id}-${uploadTargetPath || 'root'}`;
            localStorage.removeItem(treeCacheKey);
          } catch (error) {
            // Ignore errors
          }
        }
        
        showToast(`Ordner "${folderName}" wurde erstellt.`, 'success');
        await loadFiles();
        
        // Refresh the parent folder in tree to show the new folder
        setRefreshFolderPath(uploadTargetPath);
        setTimeout(() => setRefreshFolderPath(null), 100);
        setTreeRefreshKey((k) => k + 1);
      }
    } else {
      // Empty folder was created
      invalidateCache(uploadTargetPath);
      
      // Also invalidate tree cache for the parent folder
      if (typeof window !== 'undefined') {
        try {
          const treeCacheKey = `studydocs-tree-${user.id}-${uploadTargetPath || 'root'}`;
          localStorage.removeItem(treeCacheKey);
        } catch (error) {
          // Ignore errors
        }
      }
      
      showToast(`Ordner "${folderName}" wurde erstellt.`, 'success');
      await loadFiles();
      
      // Refresh the parent folder in tree to show the new folder
      setRefreshFolderPath(uploadTargetPath);
      setTimeout(() => setRefreshFolderPath(null), 100);
      setTreeRefreshKey((k) => k + 1);
    }
  }, [currentPath, showToast, t, loadFiles, setTreeRefreshKey]);
  
  // Wrapper for handleFolderUpload that uses currentPath (for button uploads)
  const handleFolderUploadWithCurrentPath = useCallback(async (files: File[]) => {
    return handleFolderUpload(files, currentPath);
  }, [handleFolderUpload, currentPath]);

  // Helper function to extract files with folder structure from a DragEvent
  const extractFilesWithFolderStructure = useCallback(async (e: DragEvent | React.DragEvent): Promise<File[]> => {
    const files: File[] = [];
    
    // IMPORTANT: dataTransfer.items is only available during the drop event
    // and might be null/undefined if accessed incorrectly
    const dataTransfer = e.dataTransfer;
    if (!dataTransfer) {
      return files;
    }
    
    // Try to get files with folder structure using DataTransferItem API
    // Check if items is available (it's a DataTransferItemList, not an array)
    const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
    
    if (items.length > 0) {
      
      // Process items to preserve folder structure
      async function processItem(item: DataTransferItem, path: string = ''): Promise<void> {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            if (entry.isFile) {
              const file = await new Promise<File>((resolve) => {
                (entry as FileSystemFileEntry).file(resolve);
              });
              // Create a File object with webkitRelativePath
              const relativePath = path ? `${path}/${file.name}` : file.name;
              const fileWithPath = new File([file], file.name, { type: file.type });
              (fileWithPath as any).webkitRelativePath = relativePath;
              files.push(fileWithPath);
            } else if (entry.isDirectory) {
              const dirEntry = entry as FileSystemDirectoryEntry;
              const dirName = dirEntry.name;
              const newPath = path ? `${path}/${dirName}` : dirName;
              
              // Read directory contents recursively
              await processDirectoryEntry(dirEntry, newPath);
            }
          }
        }
      }
      
      async function processDirectoryEntry(dirEntry: FileSystemDirectoryEntry, path: string): Promise<void> {
        const reader = dirEntry.createReader();
        const readEntries = (): Promise<void> => {
          return new Promise((resolve) => {
            reader.readEntries((entries) => {
              if (entries.length === 0) {
                resolve();
                return;
              }
              const promises = entries.map((entry) => {
                if (entry.isFile) {
                  return new Promise<void>((fileResolve) => {
                    (entry as FileSystemFileEntry).file((file) => {
                      const relativePath = `${path}/${file.name}`;
                      const fileWithPath = new File([file], file.name, { type: file.type });
                      (fileWithPath as any).webkitRelativePath = relativePath;
                      files.push(fileWithPath);
                      fileResolve();
                    });
                  });
                } else if (entry.isDirectory) {
                  const newPath = `${path}/${entry.name}`;
                  return processDirectoryEntry(entry as FileSystemDirectoryEntry, newPath);
                }
                return Promise.resolve();
              });
              Promise.all(promises).then(() => readEntries().then(resolve));
            });
          });
        };
        await readEntries();
      }
      
      try {
        for (const item of items) {
          await processItem(item);
        }
      } catch (error) {
        // Fallback to regular files on error
        const regularFiles = Array.from(e.dataTransfer?.files || []);
        files.push(...regularFiles);
      }
    } else {
      // Fallback to regular files if DataTransferItem API is not available
      const regularFiles = Array.from(e.dataTransfer?.files || []);
      files.push(...regularFiles);
    }
    
    return files;
  }, []);

  const handleExternalFilesDrop = useCallback(async (files: File[], targetPath: string) => {
    // Check if this is a folder upload (has webkitRelativePath)
    const filesWithRelativePath = files.filter(f => (f as any).webkitRelativePath);
    const hasRelativePaths = filesWithRelativePath.length > 0;
    
    if (hasRelativePaths && files.length > 0) {
      // This is a folder upload, use handleFolderUpload logic
      await handleFolderUpload(files, targetPath);
      return;
    } else {
      // If user dragged a folder but webkitRelativePath is missing, show a helpful message
      if (files.length === 1 && files[0].name && !files[0].name.includes('.')) {
        // Single file without extension might be a folder
        showToast('⚠️ Drag-and-Drop unterstützt keine Ordnerstruktur. Bitte verwenden Sie das Ordner-Icon (📁) in der Toolbar für Ordner-Uploads.', 'info');
      } else if (files.length > 1) {
        // Multiple files might be from a folder
        showToast('⚠️ Drag-and-Drop unterstützt keine Ordnerstruktur. Bitte verwenden Sie das Ordner-Icon (📁) in der Toolbar, um einen Ordner mit allen Dateien hochzuladen.', 'info');
      }
    }
    
    // Regular file upload - add all files to queue
    // Limit to prevent memory issues with too many files
    const maxFiles = 100;
    const filesToUpload = files.slice(0, maxFiles);
    
    if (files.length > maxFiles) {
      showToast(`${files.length} Dateien ausgewählt, nur die ersten ${maxFiles} werden hochgeladen.`, 'info');
    }
    
    setUploadQueue((prevQueue) => [...prevQueue, ...filesToUpload.map(file => ({ file, targetPath }))]);
  }, [showToast, handleFolderUpload, currentPath]);

  // Wrapper function that accepts a DragEvent and extracts files with folder structure
  const handleExternalDropWithEvent = useCallback(async (e: React.DragEvent, targetPath: string) => {
    try {
      const files = await extractFilesWithFolderStructure(e);
      
      if (files.length > 0) {
        await handleExternalFilesDrop(files, targetPath);
      } else {
        // If no files were extracted but files exist in dataTransfer, try fallback
        const regularFiles = Array.from(e.dataTransfer?.files || []);
        if (regularFiles.length > 0) {
          showToast('⚠️ Drag-and-Drop unterstützt keine Ordnerstruktur. Bitte verwenden Sie das Ordner-Icon (📁) in der Toolbar für Ordner-Uploads.', 'info');
          await handleExternalFilesDrop(regularFiles, targetPath);
        }
      }
    } catch (error) {
      // Fallback to regular files
      const regularFiles = Array.from(e.dataTransfer?.files || []);
      if (regularFiles.length > 0) {
        await handleExternalFilesDrop(regularFiles, targetPath);
      }
    }
  }, [extractFilesWithFolderStructure, handleExternalFilesDrop, showToast]);

  async function handleReplaceConfirm() {
    if (replaceModal.file && replaceModal.targetPath) {
      // Close replace modal first
      const fileToUpload = replaceModal.file;
      const targetPath = replaceModal.targetPath;
      setReplaceModal({ isOpen: false, file: null, targetPath: '' });
      
      // Now show upload progress and start upload
      setUploadProgress({
        total: 1,
        completed: 0,
        current: fileToUpload.name
      });
      
      // Upload file with replacement
      await uploadSingleFile(fileToUpload, targetPath);
      
      // Update progress to completed
      setUploadProgress({
        total: 1,
        completed: 1,
        current: fileToUpload.name
      });
      
      // Process next file in queue
      setUploadQueue((queue) => queue.slice(1));
      
      // Refresh file list
      invalidateCache(targetPath);
      if (typeof window !== 'undefined') {
        try {
          const treeCacheKey = `studydocs-tree-${user.id}-${targetPath || 'root'}`;
          localStorage.removeItem(treeCacheKey);
        } catch (error) {
          // Ignore errors
        }
      }
      loadFiles();
      setRefreshFolderPath(targetPath);
      setTimeout(() => setRefreshFolderPath(null), 100);
      setTreeRefreshKey((k) => k + 1);
    }
  }

  function handleReplaceCancel() {
    // Skip this file and process next
    setUploadQueue((queue) => queue.slice(1));
    setReplaceModal({ isOpen: false, file: null, targetPath: '' });
  }

  // Track upload results
  useEffect(() => {
    if (uploadQueue.length === 0 && replaceModal.isOpen === false && !isProcessingUpload) {
      // All files processed, invalidate cache and refresh only current directory (not the entire tree)
      invalidateCache(currentPath);
      
      // Also invalidate tree cache for current path
      if (typeof window !== 'undefined') {
        try {
          const treeCacheKey = `studydocs-tree-${user.id}-${currentPath || 'root'}`;
          localStorage.removeItem(treeCacheKey);
        } catch (error) {
          // Ignore errors
        }
      }
      
      loadFiles();
      
      // Refresh the tree for current path
      setRefreshFolderPath(currentPath);
      setTimeout(() => setRefreshFolderPath(null), 100);
      setTreeRefreshKey((k) => k + 1);
      
      // Show summary toast
      if (uploadProgress) {
        if (uploadProgress.total > 1) {
          // Multiple files
          const successCount = uploadProgress.total - uploadErrors.length;
          if (uploadErrors.length === 0) {
            showToast(`${uploadProgress.total} ${t('filesUploadedSuccess')}`, 'success');
          } else {
            showToast(`${successCount} ${t('filesUploadedPartial')} ${uploadProgress.total} ${t('filesUploaded')}. ${uploadErrors.length} ${t('errors')}.`, 'error');
          }
        } else {
          // Single file
          if (uploadErrors.length === 0) {
            showToast(t('fileUploaded'), 'success');
          } else {
            showToast(t('errorUploadingFile'), 'error');
          }
        }
        setUploadProgress(null);
        setUploadErrors([]);
      }
    }
  }, [uploadQueue.length, replaceModal.isOpen, isProcessingUpload, uploadProgress, uploadErrors.length]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to close modals even in inputs
        if (e.key === 'Escape') {
          if (renamingItem) {
            cancelRename();
          }
          if (creatingNewDirectory) {
            cancelCreateDirectory();
          }
        }
        return;
      }

      // Ctrl/Cmd + A: Select all (toggle - if all selected, deselect all)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const filesToSelect = isGlobalSearch ? allFiles : files;
        if (filesToSelect.length === 0) return;
        
        // Check if all items are already selected
        const allSelected = filesToSelect.every(f => selectedItems.has(f.path));
        
        if (allSelected) {
          // Deselect all
          setSelectedItems(new Set());
        } else {
          // Select all
          setSelectedItems(new Set(filesToSelect.map(f => f.path)));
        }
        return;
      }

      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        const selectedFiles = (isGlobalSearch ? allFiles : files).filter(f => selectedItems.has(f.path));
        if (selectedFiles.length > 0) {
          setCopiedItems(selectedFiles);
          setIsCopyMode(true);
          showToast(`${selectedFiles.length} ${t('itemsCopied')}`, 'success');
        }
        return;
      }

      // Ctrl/Cmd + X: Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        const selectedFiles = (isGlobalSearch ? allFiles : files).filter(f => selectedItems.has(f.path));
        if (selectedFiles.length > 0) {
          setCopiedItems(selectedFiles);
          setIsCopyMode(false);
          showToast(`${selectedFiles.length} ${t('itemsCut')}`, 'success');
        }
        return;
      }

      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (copiedItems.length > 0) {
          handlePaste();
        }
        return;
      }

      // Ctrl/Cmd + N: New directory
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateDirectory();
        return;
      }

      // Ctrl/Cmd + U: Upload
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fileInput?.click();
        return;
      }

      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (actionHistory.length > 0) {
          handleUndo();
        }
        return;
      }

      // Delete / Backspace: Delete selected items
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItems.size > 0) {
        e.preventDefault();
        const selectedFiles = (isGlobalSearch ? allFiles : files).filter(f => selectedItems.has(f.path));
        if (selectedFiles.length > 0) {
          setDeleteModal({ visible: true, item: null, items: selectedFiles });
        }
        return;
      }

      // F2: Rename selected item
      if (e.key === 'F2' && selectedItems.size === 1) {
        e.preventDefault();
        const selectedFile = (isGlobalSearch ? allFiles : files).find(f => selectedItems.has(f.path));
        if (selectedFile) {
          handleRename(selectedFile);
        }
        return;
      }

      // Enter: Open selected item or first item (preview for files)
      if (e.key === 'Enter') {
        e.preventDefault();
        const sortedFilesList = getSortedFiles();
        const filesToUse = isGlobalSearch ? allFiles : sortedFilesList;
        if (selectedItems.size > 0) {
          const selectedFile = filesToUse.find(f => selectedItems.has(f.path));
          if (selectedFile) {
            if (selectedFile.type === 'directory') {
              navigateToPath(selectedFile.path);
            } else {
              // Open preview instead of downloading
              setPreviewFile(selectedFile);
            }
          }
        } else if (filesToUse.length > 0) {
          // Open first item if nothing selected
          const firstItem = filesToUse[0];
          if (firstItem.type === 'directory') {
            navigateToPath(firstItem.path);
          } else {
            // Open preview instead of downloading
            setPreviewFile(firstItem);
          }
        }
        return;
      }

      // Arrow Keys: Navigate through files
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const sortedFilesList = getSortedFiles();
        const filesToUse = isGlobalSearch ? allFiles : sortedFilesList;
        if (filesToUse.length === 0) return;

        let newIndex = focusedIndex;
        if (newIndex === null) {
          // Start from first item or first selected
          if (selectedItems.size > 0) {
            const firstSelected = filesToUse.findIndex(f => selectedItems.has(f.path));
            newIndex = firstSelected >= 0 ? firstSelected : 0;
          } else {
            newIndex = 0;
          }
        }

        if (e.key === 'ArrowDown') {
          newIndex = Math.min(newIndex + 1, filesToUse.length - 1);
        } else if (e.key === 'ArrowUp') {
          newIndex = Math.max(newIndex - 1, 0);
        } else if (e.key === 'ArrowRight') {
          // Navigate into directory
          const currentFile = filesToUse[newIndex];
          if (currentFile && currentFile.type === 'directory') {
            navigateToPath(currentFile.path);
            return;
          }
        } else if (e.key === 'ArrowLeft') {
          // Navigate up
          if (currentPath) {
            navigateUp();
            return;
          }
        }

        setFocusedIndex(newIndex);
        const focusedFile = filesToUse[newIndex];
        if (focusedFile) {
          // Select the focused item
          setSelectedItems(new Set([focusedFile.path]));
          // Scroll into view
          setTimeout(() => {
            const row = document.querySelector(`[data-file-path="${focusedFile.path}"]`) as HTMLElement;
            row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedItems,
    files,
    allFiles,
    isGlobalSearch,
    copiedItems,
    currentPath,
    actionHistory,
    focusedIndex,
    renamingItem,
    creatingNewDirectory,
  ]);

  // Handle external file drag and drop
  useEffect(() => {
    function handleDragOver(e: DragEvent) {
      // Check if dragging files from external source
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
        setExternalDragOver(true);
      }
    }

    function handleDragLeave(e: DragEvent) {
      // Only reset if leaving the window
      if (!e.relatedTarget || (e.relatedTarget as Node).nodeName === 'HTML') {
        setExternalDragOver(false);
        setExternalDragTarget(null);
      }
    }

    async function handleDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      setExternalDragOver(false);
      
      const files = await extractFilesWithFolderStructure(e);
      
      if (files.length > 0) {
        // Use currentPath as fallback if no specific target was set
        const target = externalDragTarget !== null ? externalDragTarget : currentPath;
        console.log('Calling handleExternalFilesDrop with', files.length, 'files');
        handleExternalFilesDrop(files, target);
      }
      setExternalDragTarget(null);
    }

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [externalDragTarget, currentPath, handleExternalFilesDrop]);


  // Cache helper functions
  const getCacheKey = (path: string) => `studydocs-files-${user.id}-${path || 'root'}`;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedFiles = (path: string): FileItem[] | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cacheKey = getCacheKey(path);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      // Return cached data if still valid
      if (age < CACHE_DURATION) {
        return data;
      }
      
      // Remove expired cache
      localStorage.removeItem(cacheKey);
      return null;
    } catch (error) {
      return null;
    }
  };

  const setCachedFiles = (path: string, files: FileItem[]) => {
    if (typeof window === 'undefined') return;
    try {
      const cacheKey = getCacheKey(path);
      const cacheData = {
        data: files,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      // Ignore localStorage errors (quota exceeded, etc.)
    }
  };

  const invalidateCache = (path?: string) => {
    if (typeof window === 'undefined') return;
    try {
      if (path) {
        // Invalidate specific path and all parent paths
        const parts = path.split('/').filter(Boolean);
        let currentPath = '';
        const keysToRemove: string[] = [getCacheKey(path)];
        
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          keysToRemove.push(getCacheKey(currentPath));
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } else {
        // Invalidate all caches for this user
        const prefix = `studydocs-files-${user.id}-`;
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      // Ignore errors
    }
  };

  async function loadFilesRecursive(dirPath: string): Promise<FileItem[]> {
    const allFiles: FileItem[] = [];
    
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      
      if (res.ok) {
        const contents = data.contents || [];
        
        for (const item of contents) {
          allFiles.push(item);
          
          // If it's a directory, recursively get its contents
          if (item.type === 'directory') {
            const subFiles = await loadFilesRecursive(item.path);
            allFiles.push(...subFiles);
          }
        }
      }
    } catch (error) {
      // Error loading directory
    }
    
    return allFiles;
  }

  async function loadFiles() {
    setLoading(true);
    setFilesLoaded(false); // Reset animation trigger - items will be hidden
    
    // Try to load from cache first for instant display
    const cachedFiles = getCachedFiles(currentPath);
    if (cachedFiles) {
      setFiles(cachedFiles);
      setFocusedIndex(null);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFilesLoaded(true);
        });
      });
      setLoading(false);
    }
    
    // Always fetch fresh data in the background
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
      const data = await res.json();
      
      if (res.ok) {
        const freshFiles = data.contents || [];
        setFiles(freshFiles);
        setCachedFiles(currentPath, freshFiles);
        setFocusedIndex(null); // Reset focus when loading new directory
        
        // Trigger animation immediately after state update using requestAnimationFrame
        if (!cachedFiles) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setFilesLoaded(true);
            });
          });
        }
      }
    } catch (error) {
      // Error loading files - if we have cached data, keep using it
      if (!cachedFiles) {
        setFiles([]);
      }
    } finally {
      setLoading(false);
    }
  }

  function navigateToPath(path: string) {
    setCurrentPath(path);
    setSelectedFile(null);
    setPreviewFile(null); // Close preview when navigating to a different folder
  }

  function navigateUp() {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
    setSelectedFile(null);
    setPreviewFile(null); // Close preview when navigating up
  }

  function navigateToBreadcrumb(index: number) {
    const parts = currentPath.split('/').filter(Boolean);
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
    setSelectedFile(null);
    setPreviewFile(null); // Close preview when navigating via breadcrumb
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  // Global search function
  async function performGlobalSearch() {
    if (!searchQuery.trim() && 
        searchFilters.fileType === 'all' && 
        !searchFilters.minSize && 
        !searchFilters.maxSize && 
        !searchFilters.dateFrom && 
        !searchFilters.dateTo) {
      setIsGlobalSearch(false);
      return;
    }

    setIsGlobalSearch(true);
    setSearchLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      }
      if (searchFilters.fileType !== 'all') {
        params.append('type', searchFilters.fileType);
      }
      if (searchFilters.fileExtensions && searchFilters.fileExtensions.length > 0) {
        params.append('extensions', searchFilters.fileExtensions.join(','));
      }
      if (searchFilters.minSize !== undefined) {
        params.append('minSize', (searchFilters.minSize / 1024).toString());
      }
      if (searchFilters.maxSize !== undefined) {
        params.append('maxSize', (searchFilters.maxSize / 1024).toString());
      }
      if (searchFilters.dateFrom) {
        params.append('dateFrom', searchFilters.dateFrom.toISOString().split('T')[0]);
      }
      if (searchFilters.dateTo) {
        params.append('dateTo', searchFilters.dateTo.toISOString().split('T')[0]);
      }

      const res = await fetch(`/api/files/search?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        // Convert ISO date strings back to Date objects
        const results = (data.results || []).map((file: FileItem) => ({
          ...file,
          modified: file.modified ? new Date(file.modified) : undefined,
        }));
        setAllFiles(results);
      } else {
        showToast(data.error || t('noResults'), 'error');
        setAllFiles([]);
      }
    } catch (error) {
      showToast(t('noResults'), 'error');
      setAllFiles([]);
    } finally {
      setSearchLoading(false);
    }
  }

  // Load recursive files when search or filters are active
  useEffect(() => {
    const hasActiveSearchOrFilter = 
      searchQuery.trim() !== '' ||
      searchFilters.fileType !== 'all' ||
      (searchFilters.fileExtensions && searchFilters.fileExtensions.length > 0) ||
      searchFilters.minSize !== undefined ||
      searchFilters.maxSize !== undefined ||
      searchFilters.dateFrom !== undefined ||
      searchFilters.dateTo !== undefined;

    if (hasActiveSearchOrFilter && !isGlobalSearch) {
      // Set loading state for recursive file loading
      setSearchLoading(true);
      
      // Load all files recursively from current path
      loadFilesRecursive(currentPath)
        .then((allRecursiveFiles) => {
          setRecursiveFiles(allRecursiveFiles);
        })
        .catch((error) => {
          // Error loading recursive files
          setRecursiveFiles([]);
        })
        .finally(() => {
          setSearchLoading(false);
        });
    } else {
      // Clear recursive files when no search/filter is active
      setRecursiveFiles([]);
      if (!isGlobalSearch) {
        setSearchLoading(false);
      }
    }
  }, [currentPath, searchQuery, searchFilters, isGlobalSearch]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performGlobalSearch();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchFilters]);

  function filterFiles(filesToFilter: FileItem[]): FileItem[] {
    // If global search is active, use allFiles instead
    if (isGlobalSearch) {
      return allFiles;
    }

    // If search or filters are active, use recursive files from current path
    const hasActiveSearchOrFilter = 
      searchQuery.trim() !== '' ||
      searchFilters.fileType !== 'all' ||
      (searchFilters.fileExtensions && searchFilters.fileExtensions.length > 0) ||
      searchFilters.minSize !== undefined ||
      searchFilters.maxSize !== undefined ||
      searchFilters.dateFrom !== undefined ||
      searchFilters.dateTo !== undefined;

    // Use recursive files if search/filter is active, otherwise use current folder files
    // Only filter files that are under the current path
    let filesToUse = filesToFilter;
    if (hasActiveSearchOrFilter && recursiveFiles.length > 0) {
      // Filter recursive files to only include those under current path
      const currentPathPrefix = currentPath ? `${currentPath}/` : '';
      filesToUse = recursiveFiles.filter((file) => {
        // Include files that are in the current path or its subdirectories
        if (currentPath === '') {
          return true; // Root: include all files
        }
        return file.path.startsWith(currentPathPrefix) || file.path === currentPath;
      });
    }

    let filtered = [...filesToUse];

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((file) =>
        file.name.toLowerCase().includes(query) ||
        file.path.toLowerCase().includes(query)
      );
    }

    // File type filter
    if (searchFilters.fileType !== 'all') {
      filtered = filtered.filter((file) => file.type === searchFilters.fileType);
    }

    // File extensions filter
    if (searchFilters.fileExtensions && searchFilters.fileExtensions.length > 0) {
      filtered = filtered.filter((file) => {
        if (file.type !== 'file') return false;
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        return searchFilters.fileExtensions!.includes(fileExtension);
      });
    }

    // Size filter
    if (searchFilters.minSize !== undefined) {
      filtered = filtered.filter((file) => (file.size || 0) >= searchFilters.minSize!);
    }
    if (searchFilters.maxSize !== undefined) {
      filtered = filtered.filter((file) => (file.size || 0) <= searchFilters.maxSize!);
    }

    // Date filter
    if (searchFilters.dateFrom) {
      const fromDate = new Date(searchFilters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((file) => {
        if (!file.modified) return false;
        const fileDate = new Date(file.modified);
        fileDate.setHours(0, 0, 0, 0);
        return fileDate >= fromDate;
      });
    }
    if (searchFilters.dateTo) {
      const toDate = new Date(searchFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((file) => {
        if (!file.modified) return false;
        const fileDate = new Date(file.modified);
        return fileDate <= toDate;
      });
    }

    return filtered;
  }

  function getSortedFiles() {
    const filtered = filterFiles(files);
    const sorted = filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'size') {
        comparison = (a.size || 0) - (b.size || 0);
      } else if (sortField === 'type') {
        comparison = a.type.localeCompare(b.type);
      } else if (sortField === 'modified') {
        const aDate = a.modified ? new Date(a.modified).getTime() : 0;
        const bDate = b.modified ? new Date(b.modified).getTime() : 0;
        comparison = aDate - bDate;
      }
      
      // Directories first
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function formatDate(date?: Date): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getFileExtension(name: string): string {
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
  }

  function toggleSelection(path: string) {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }

  // Marquee selection handlers
  const handleMarqueeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start marquee selection if clicking on empty space (not on a file row or other interactive element)
    const target = e.target as HTMLElement;
    if (target.closest('tr') || target.closest('button') || target.closest('input') || target.closest('a') || target.closest('th') || target.closest('td')) {
      return;
    }

    // Prevent marquee selection on mobile
    if (isMobile) return;

    // Don't start if clicking on the table itself (only on empty space)
    if (target.closest('table')) {
      return;
    }

    const container = fileListContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top + container.scrollTop;

    marqueeStartRef.current = { x: startX, y: startY };
    setMarqueeSelection({
      isActive: true,
      startX,
      startY,
      endX: startX,
      endY: startY,
    });

    e.preventDefault();
    e.stopPropagation();
  }, [isMobile]);

  function selectRange(startIndex: number, endIndex: number) {
    const sorted = getSortedFiles();
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      for (let i = start; i <= end; i++) {
        if (sorted[i]) {
          newSet.add(sorted[i].path);
        }
      }
      return newSet;
    });
  }

  function handleRowClick(file: FileItem, e: React.MouseEvent) {
    // Don't navigate if clicking on checkbox or action buttons
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('button')) {
      return;
    }

    // Check for Cmd (Mac) or Ctrl (Windows/Linux) key
    const isMetaKey = e.metaKey || e.ctrlKey;
    const isShiftKey = e.shiftKey;

    // Ignore double clicks in onClick handler - they're handled by onDoubleClick
    if (e.detail === 2) {
      // Clear any pending click timer
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      return;
    }

    // Handle Shift + Click: Range selection
    if (isShiftKey && !isMetaKey) {
      e.preventDefault();
      e.stopPropagation();
      const sorted = getSortedFiles();
      const currentIndex = sorted.findIndex(f => f.path === file.path);
      
      if (currentIndex !== -1) {
        if (lastSelectedIndexRef.current !== null) {
          // Select range from last selected to current
          selectRange(lastSelectedIndexRef.current, currentIndex);
        } else {
          // If no last selection, just select this one
          toggleSelection(file.path);
          lastSelectedIndexRef.current = currentIndex;
        }
      }
      return;
    }

    // Handle Cmd/Ctrl + Click: Toggle selection
    if (isMetaKey) {
      e.preventDefault();
      e.stopPropagation();
      const sorted = getSortedFiles();
      const currentIndex = sorted.findIndex(f => f.path === file.path);
      toggleSelection(file.path);
      lastSelectedIndexRef.current = currentIndex;
      return;
    }

    // Normal click: Navigate or clear selection
    // Clear any existing timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // Delay navigation to detect double clicks
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      // Single click - execute action
      if (file.type === 'directory') {
        // Navigate directly into directory on single click
        navigateToPath(file.path);
        setIsGlobalSearch(false);
        setSearchQuery('');
        setSearchFilters({ fileType: 'all' });
        // Clear selection on navigation
        setSelectedItems(new Set());
        lastSelectedIndexRef.current = null;
      } else {
        // For global search results, navigate to parent directory
        if (isGlobalSearch) {
          const parentPath = file.path.split('/').slice(0, -1).join('/');
          navigateToPath(parentPath);
          setIsGlobalSearch(false);
          setSearchQuery('');
          setSearchFilters({ fileType: 'all' });
          setSelectedItems(new Set());
          lastSelectedIndexRef.current = null;
        } else {
          // Normal click on file: clear selection and navigate to parent (or preview)
          setSelectedItems(new Set());
          lastSelectedIndexRef.current = null;
        }
      }
    }, 200); // 200ms delay to detect double clicks
  }

  function handleShare(item: FileItem) {
    setShareModal({
      isOpen: true,
      itemName: item.name,
      itemPath: item.path,
      itemType: item.type,
    });
  }

  async function handleToggleFavorite(item: FileItem) {
    const isFavorite = favorites.has(item.path);
    
    try {
      if (isFavorite) {
        // Remove from favorites
        const res = await fetch(`/api/files/favorites?path=${encodeURIComponent(item.path)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setFavorites(prev => {
            const newSet = new Set(prev);
            newSet.delete(item.path);
            return newSet;
          });
          showToast(`"${item.name}" ${t('removedFromFavorites')}`, 'success' 
          );
          // Refresh favorites list if we're on the favorites tab
          if (sidebarTab === 'favorites') {
            setTreeRefreshKey((k) => k + 1);
          }
        }
      } else {
        // Add to favorites
        const res = await fetch('/api/files/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemPath: item.path,
            itemName: item.name,
            itemType: item.type,
          }),
        });
        if (res.ok) {
          setFavorites(prev => new Set(prev).add(item.path));
          showToast(`"${item.name}" ${t('addedToFavorites')}`, 'success' 
          );
          // Refresh favorites list if we're on the favorites tab
          if (sidebarTab === 'favorites') {
            setTreeRefreshKey((k) => k + 1);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      showToast(t('errorUpdatingFavorites'), 'error' 
      );
    }
  }

  function handleContextMenu(file: FileItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item: file,
      isEmpty: false,
    });
  }

  function handleEmptyContextMenu(e: React.MouseEvent) {
    // Don't show empty context menu if clicking on a table row
    const target = e.target as HTMLElement;
    if (target.closest('tr') || target.closest('thead')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item: null,
      isEmpty: true,
    });
  }

  function handleCreateDirectoryFromContext() {
    // Create a temporary directory item for the new directory
    const tempDirectory: FileItem = {
      name: '',
      path: 'NEW_DIRECTORY_TEMP',
      type: 'directory',
    };
    setCreatingNewDirectory(tempDirectory);
    setNewDirectoryName('');
    // Focus input after state update
    setTimeout(() => {
      newDirectoryInputRef.current?.focus();
    }, 0);
  }

  function handleCreateDirectory() {
    handleCreateDirectoryFromContext();
  }

  async function confirmCreateDirectory() {
    if (!newDirectoryName.trim()) {
      setCreatingNewDirectory(null);
      setNewDirectoryName('');
      return;
    }

    const name = newDirectoryName.trim();
    
    // Check if name has a file extension
    const hasExtension = (() => {
      const lastDotIndex = name.lastIndexOf('.');
      // Has extension if: there's a dot, it's not at the start, and there's at least one character after it
      return lastDotIndex > 0 && lastDotIndex < name.length - 1;
    })();

    // Clear the input immediately for better UX
    setCreatingNewDirectory(null);
    const nameToCreate = name;
    setNewDirectoryName('');

    try {
      if (hasExtension) {
        // Create a file (empty file)
        const formData = new FormData();
        const emptyFile = new File([''], nameToCreate, { type: 'text/plain' });
        formData.append('file', emptyFile);
        formData.append('path', currentPath);

        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || t('serverError'), 'error');
          return;
        }

        invalidateCache(currentPath);
        
        // Also invalidate tree cache for the parent folder (files don't appear in tree, but parent might need refresh)
        if (typeof window !== 'undefined') {
          try {
            const treeCacheKey = `studydocs-tree-${user.id}-${currentPath || 'root'}`;
            localStorage.removeItem(treeCacheKey);
          } catch (error) {
            // Ignore errors
          }
        }
        
        await loadFiles();
        
        // Refresh the parent folder in tree to show the new file
        setRefreshFolderPath(currentPath);
        setTimeout(() => setRefreshFolderPath(null), 100);
        setTreeRefreshKey((k) => k + 1);
        
        showToast(`${t('file')} "${nameToCreate}" ${t('created')}`, 'success');
      } else {
        // Create a directory
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create-directory',
            path: currentPath,
            name: nameToCreate,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || t('errorDeleting'), 'error');
          return;
        }
        
        invalidateCache(currentPath);
        
        // Also invalidate tree cache for the parent folder
        if (typeof window !== 'undefined') {
          try {
            const treeCacheKey = `studydocs-tree-${user.id}-${currentPath || 'root'}`;
            localStorage.removeItem(treeCacheKey);
          } catch (error) {
            // Ignore errors
          }
        }
        
        await loadFiles();
        
        // Refresh the parent folder in tree to show the new directory
        setRefreshFolderPath(currentPath);
        setTimeout(() => setRefreshFolderPath(null), 100);
        setTreeRefreshKey((k) => k + 1);
        
        showToast(`${t('directory')} "${nameToCreate}" ${t('created')}`, 'success');
      }
    } catch (err) {
      showToast(t('serverError'), 'error');
    }
  }

  function cancelCreateDirectory() {
    setCreatingNewDirectory(null);
    setNewDirectoryName('');
  }

  function handleNewDirectoryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      confirmCreateDirectory();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelCreateDirectory();
    }
  }

  function handleRename(item: FileItem) {
    setRenamingItem(item);
    
    // Keep the full name including extension in the input
    setRenameValue(item.name);
    
    // Focus input after state update and select only the name without extension
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        
        // For files, select only the name without extension
        if (item.type === 'file') {
          const lastDotIndex = item.name.lastIndexOf('.');
          if (lastDotIndex > 0) {
            // Select from start to the dot (name without extension)
            renameInputRef.current.setSelectionRange(0, lastDotIndex);
          } else {
            // No extension found, select all
            renameInputRef.current.select();
          }
        } else {
          // For directories, select all
          renameInputRef.current.select();
        }
      }
    }, 0);
  }

  async function confirmRename() {
    if (!renamingItem || !renameValue.trim()) {
      setRenamingItem(null);
      setRenameValue('');
      return;
    }

    const oldName = renamingItem.name;
    const newName = renameValue.trim();
    
    // Check if name actually changed
    if (newName === oldName) {
      setRenamingItem(null);
      setRenameValue('');
      return;
    }

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          path: renamingItem.path,
          newName: newName,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Save to history for undo
        setActionHistory(prev => [...prev, {
          type: 'rename',
          data: { 
            item: renamingItem,
            oldName: oldName,
            newName: newName
          }
        }]);

        // Update files state immediately with the new name
        const parentPath = renamingItem.path.split('/').slice(0, -1).join('/');
        const normalizedParentPath = parentPath || '';
        const normalizedCurrentPath = currentPath || '';
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        
        // If the renamed item is in the current directory, update the file list immediately
        if (normalizedParentPath === normalizedCurrentPath) {
          setFiles(prevFiles => 
            prevFiles.map(file => 
              file.path === renamingItem.path 
                ? { ...file, name: newName, path: newPath }
                : file
            )
          );
        }
        
        // Invalidate cache for both parent and current path
        invalidateCache(normalizedParentPath);
        invalidateCache(normalizedCurrentPath);
        
        // Also refresh from server to ensure consistency
        loadFiles();
        
        // Refresh the parent folder in tree
        if (normalizedParentPath || normalizedParentPath === '') {
          setRefreshFolderPath(normalizedParentPath);
          setTimeout(() => setRefreshFolderPath(null), 100);
        }
        
        setRenamingItem(null);
        setRenameValue('');
        showToast(t('fileRenamed'), 'success');
      } else {
        showToast(data.error || t('errorRenaming'), 'error');
        setRenamingItem(null);
        setRenameValue('');
      }
    } catch (error) {
      console.error('Fehler beim Umbenennen:', error);
      showToast(t('errorRenaming'), 'error');
      setRenamingItem(null);
      setRenameValue('');
    }
  }

  function cancelRename() {
    setRenamingItem(null);
    setRenameValue('');
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      confirmRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  }

  function openDeleteModal(item: FileItem) {
    setDeleteModal({ visible: true, item, items: [item] });
  }

  function openBulkDeleteModal() {
    const selectedFiles = files.filter(f => selectedItems.has(f.path));
    if (selectedFiles.length === 0) return;
    setDeleteModal({ visible: true, item: null, items: selectedFiles });
  }

  async function confirmDelete() {
    const itemsToDelete = deleteModal.items.length > 0 ? deleteModal.items : (deleteModal.item ? [deleteModal.item] : []);
    if (itemsToDelete.length === 0) return;

    try {
      // Delete all items
      const deletePromises = itemsToDelete.map(item =>
        fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', path: item.path }),
        })
      );

      const results = await Promise.all(deletePromises);
      const errors: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const data = await res.json();
        if (!res.ok) {
          errors.push(itemsToDelete[i].name);
        }
      }

      if (errors.length > 0) {
        showToast(`${t('errorDeleting')}: ${errors.length} ${t('itemsSelected')}`, 'error' 
        );
      } else {
        const count = itemsToDelete.length;
        showToast(`${count} ${t('itemsDeleted')}`, 'success' 
        );
      }

      // Save to history for undo - store items with their full data for potential restoration
      setActionHistory(prev => [...prev, {
        type: 'delete',
        data: { items: itemsToDelete.map(item => ({ ...item })) }
      }]);

      // Clear selection
      setSelectedItems(new Set());
      
      // Remove deleted items from tree (only refresh affected folders, not entire tree)
      // Collect unique parent paths to avoid duplicate refreshes
      const parentPaths = new Set<string>();
      itemsToDelete.forEach(item => {
        const parentPath = item.path.split('/').slice(0, -1).join('/');
        if (parentPath || parentPath === '') {
          parentPaths.add(parentPath);
        }
      });
      
      // Invalidate cache for all affected parent paths
      parentPaths.forEach(parentPath => {
        invalidateCache(parentPath);
        setRefreshFolderPath(parentPath);
        setTimeout(() => setRefreshFolderPath(null), 100);
      });
      
      // Also invalidate current path cache
      invalidateCache(currentPath);
      loadFiles();
      // Don't refresh entire tree - only affected folders are refreshed
      // setTreeRefreshKey((k) => k + 1);
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      showToast(t('errorDeleting'), 'error');
    } finally {
      setDeleteModal({ visible: false, item: null, items: [] });
    }
  }

  async function handleCopy() {
    const selectedFiles = (isGlobalSearch ? allFiles : files).filter(f => selectedItems.has(f.path));
    if (selectedFiles.length > 0) {
      setCopiedItems(selectedFiles);
      setIsCopyMode(true);
      showToast(`${selectedFiles.length} ${t('itemsCopied')}`, 'success');
    }
  }

  async function handleCut() {
    const selectedFiles = (isGlobalSearch ? allFiles : files).filter(f => selectedItems.has(f.path));
    if (selectedFiles.length > 0) {
      setCopiedItems(selectedFiles);
      setIsCopyMode(false);
      showToast(`${selectedFiles.length} ${t('itemsCut')}`, 'success');
    }
  }

  async function handlePaste() {
    if (copiedItems.length === 0) return;

    try {
      showToast(`${copiedItems.length} ${t('itemsSelected')} ${t('pasting')} ${isCopyMode ? t('copied') : t('moved')}...`, 'info');

      const action = isCopyMode ? 'copy' : 'move';
      const errors: string[] = [];
      const successfulItems: FileItem[] = [];

      for (const item of copiedItems) {
        try {
          const res = await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: action,
              path: item.path,
              targetPath: currentPath,
            }),
          });

          if (!res.ok) {
            const data = await res.json();
            errors.push(item.name);
            console.error(`Fehler beim ${isCopyMode ? 'Kopieren' : 'Verschieben'} von ${item.name}:`, data.error);
          } else {
            successfulItems.push(item);
          }
        } catch (error: any) {
          errors.push(item.name);
          console.error(`Fehler beim ${isCopyMode ? 'Kopieren' : 'Verschieben'} von ${item.name}:`, error);
        }
      }

      if (errors.length > 0) {
        showToast(`${t(isCopyMode ? 'errorCopying' : 'errorMoving')}: ${errors.length} ${t('itemsSelected')}`, 'error' 
        );
      } else {
        // Save to history for undo - store the new paths after move/copy
        const newItems = successfulItems.map(item => {
          const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          return { ...item, path: newPath };
        });

        setActionHistory(prev => [...prev, {
          type: isCopyMode ? 'copy' : 'move',
          data: { 
            items: successfulItems,
            newItems: newItems,
            from: successfulItems[0]?.path.split('/').slice(0, -1).join('/') || '',
            to: currentPath 
          }
        }]);

        showToast(`${successfulItems.length} ${t('itemsSelected')} ${t('itemsPasted')} ${isCopyMode ? t('copied') : t('moved')}`, 'success' 
        );

        // Clear copied items if cut mode (keep them for copy mode so user can paste multiple times)
        if (!isCopyMode) {
          setCopiedItems([]);
        }
      }

      // Invalidate cache for source and target paths
      if (successfulItems.length > 0) {
        const sourcePath = successfulItems[0]?.path.split('/').slice(0, -1).join('/') || '';
        invalidateCache(sourcePath);
        invalidateCache(currentPath);
      }
      
      loadFiles();
      setTreeRefreshKey((k) => k + 1);
    } catch (error: any) {
      console.error('Fehler beim Einfügen:', error);
      showToast(error.message || t('errorCopying'), 'error');
    }
  }

  async function handleUndo() {
    if (actionHistory.length === 0) return;

    const lastAction = actionHistory[actionHistory.length - 1];
    
    try {
      showToast(t('undoing'), 'info');

      if (lastAction.type === 'delete') {
        // Undo delete: Recreate items (this is complex - we'd need to restore file contents)
        // For now, just show a message that undo for delete is not fully supported
        showToast('Rückgängig für Löschungen wird noch nicht vollständig unterstützt', 'info' 
        );
        setActionHistory(prev => prev.slice(0, -1));
        invalidateCache(currentPath);
        loadFiles();
        setTreeRefreshKey((k) => k + 1);
        return;
      }

      if (lastAction.type === 'move') {
        // Undo move: Move items back to original location
        const { newItems, from, to } = lastAction.data;
        
        for (const item of newItems) {
          try {
            const res = await fetch('/api/files', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'move',
                path: item.path,
                targetPath: from,
              }),
            });

            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || 'Fehler beim Rückgängig machen');
            }
          } catch (error: any) {
            console.error(`Fehler beim Rückgängig machen von ${item.name}:`, error);
          }
        }

        showToast(t('undoMoveSuccess'), 'success');
        setActionHistory(prev => prev.slice(0, -1));
        
        // Navigate to original location if we're currently in the target location
        invalidateCache(from);
        invalidateCache(to);
        if (currentPath === to) {
          navigateToPath(from);
        } else {
          loadFiles();
        }
        setTreeRefreshKey((k) => k + 1);
        return;
      }

      if (lastAction.type === 'copy') {
        // Undo copy: Delete the copied items
        const { newItems } = lastAction.data;
        
        for (const item of newItems) {
          try {
            const res = await fetch('/api/files', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'delete',
                path: item.path,
              }),
            });

            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || 'Fehler beim Rückgängig machen');
            }
          } catch (error: any) {
            console.error(`Fehler beim Rückgängig machen von ${item.name}:`, error);
          }
        }

        invalidateCache(currentPath);
        showToast(t('undoCopySuccess'), 'success');
        setActionHistory(prev => prev.slice(0, -1));
        loadFiles();
        setTreeRefreshKey((k) => k + 1);
        return;
      }

      if (lastAction.type === 'rename') {
        // Undo rename: Rename back to original name
        const { item, oldName, newName } = lastAction.data;
        const itemPath = item.path.split('/').slice(0, -1).join('/');
        const fullOldPath = itemPath ? `${itemPath}/${oldName}` : oldName;

        try {
          const res = await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'rename',
              path: item.path,
              newName: oldName,
            }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Fehler beim Rückgängig machen');
          }

          showToast(t('undoRenameSuccess'), 'success');
          setActionHistory(prev => prev.slice(0, -1));
          loadFiles();
          setTreeRefreshKey((k) => k + 1);
        } catch (error: any) {
          console.error('Fehler beim Rückgängig machen:', error);
          showToast(error.message || t('undoNotSupported'), 'error');
        }
        return;
      }

      // Unknown action type
      setActionHistory(prev => prev.slice(0, -1));
      loadFiles();
    } catch (error: any) {
      console.error('Fehler beim Rückgängig machen:', error);
      showToast(error.message || t('undoNotSupported'), 'error');
    }
  }

  async function handleDownload(file: FileItem) {
    try {
      // If it's a directory, download as ZIP
      if (file.type === 'directory') {
        showToast(t('creatingZip'), 'info');
        
        const res = await fetch('/api/files/download-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: [file.path] }),
        });

        if (!res.ok) {
          const data = await res.json();
          showToast(data.error || t('zipError'), 'error');
          return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.name}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast(t('fileDownloaded'), 'success');
        return;
      }
      
      // For files, download directly
      const res = await fetch(`/api/files/download?path=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast(t('fileDownloaded'), 'success');
      } else {
        const data = await res.json();
        showToast(data.error || t('downloadError'), 'error');
      }
    } catch (error) {
      console.error('Fehler beim Download:', error);
      showToast(t('downloadError'), 'error');
    }
  }

  async function handleBulkDownload() {
    if (selectedItems.size === 0) return;

    const selectedFiles = files.filter(f => selectedItems.has(f.path));
    if (selectedFiles.length === 0) return;

    try {
      showToast(t('creatingZip'), 'info');

      const paths = selectedFiles.map(f => f.path);
      const res = await fetch('/api/files/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || t('zipError'), 'error');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'download.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(`${selectedFiles.length} ${t('itemsDownloaded')}`, 'success');
    } catch (error) {
      console.error('Fehler beim Bulk-Download:', error);
      showToast(t('downloadError'), 'error');
    }
  }

  function handleDragStart(file: FileItem, e: React.DragEvent) {
    setDraggedItem(file);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.path);
    e.dataTransfer.setData('application/x-item-type', file.type);
    e.dataTransfer.setData('application/x-item-path', file.path);
    e.dataTransfer.setData('application/x-item-name', file.name);
    // Mark that this is from the table, not from the tree
    e.dataTransfer.setData('application/x-drag-source', 'table');
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.innerHTML = file.name;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.padding = '8px 12px';
    dragImage.style.background = 'rgba(59, 130, 246, 0.9)';
    dragImage.style.color = 'white';
    dragImage.style.borderRadius = '6px';
    dragImage.style.fontSize = '14px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }

  function handleDragOver(file: FileItem, e: React.DragEvent) {
    // Check if drag is from tree (external to table)
    const dragSource = e.dataTransfer.getData('application/x-drag-source');
    const draggedPath = draggedItem?.path || e.dataTransfer.getData('application/x-item-path');
    const draggedType = draggedItem?.type || (e.dataTransfer.getData('application/x-item-type') as 'file' | 'directory' | null);
    
    if (file.type === 'directory' && draggedPath && draggedPath !== file.path && draggedType) {
      // For directories: check if target is a subdirectory
      if (draggedType === 'directory') {
        const draggedParent = draggedPath.split('/').slice(0, -1).join('/');
        const isParent = draggedParent === file.path;
        const isSubdirectory = file.path.startsWith(draggedPath + '/');
        
        // Allow if it's the parent directory or if it's not a subdirectory
        if (isParent || (!isSubdirectory && draggedPath !== file.path)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOverItem(file.path);
        }
      } else {
        // For files: allow dropping on any directory
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverItem(file.path);
      }
    }
  }

  function handleDragLeave() {
    setDragOverItem(null);
  }

  async function handleDrop(targetDir: FileItem, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(null);
    
    // Check if drag is from tree (external to table)
    const dragSource = e.dataTransfer.getData('application/x-drag-source');
    const draggedPath = draggedItem?.path || e.dataTransfer.getData('application/x-item-path');
    const draggedName = draggedItem?.name || e.dataTransfer.getData('application/x-item-name');
    const draggedType = draggedItem?.type || (e.dataTransfer.getData('application/x-item-type') as 'file' | 'directory' | null);
    
    if (!draggedPath || targetDir.type !== 'directory') {
      setDraggedItem(null);
      return;
    }
    
    // Don't move item into itself
    if (draggedPath === targetDir.path) {
      setDraggedItem(null);
      return;
    }
    
    // Don't move directory into its own subdirectory
    if (draggedType === 'directory' && targetDir.path.startsWith(draggedPath + '/')) {
      showToast(t('cannotMoveIntoSelf'), 'error');
      setDraggedItem(null);
      return;
    }
    
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          path: draggedPath,
          targetPath: targetDir.path,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Refresh if the move affects the current directory (source or target)
        const draggedParent = draggedPath.split('/').slice(0, -1).join('/');
        const normalizedDraggedParent = draggedParent || '';
        const normalizedCurrentPath = currentPath || '';
        const normalizedTargetPath = targetDir.path || '';
        
        // Update files state immediately if source is the current directory (remove item)
        if (normalizedDraggedParent === normalizedCurrentPath) {
          setFiles(prevFiles => prevFiles.filter(file => file.path !== draggedPath));
        }
        
        // Update files state immediately if target is the current directory (add item)
        // We'll need to construct the new path and add it to the list
        invalidateCache(normalizedTargetPath);
        invalidateCache(normalizedDraggedParent);
        
        if (normalizedTargetPath === normalizedCurrentPath) {
          // The item will be added when we reload, but we can add it optimistically
          // For now, just reload to get the updated list
          loadFiles();
        } else if (normalizedDraggedParent === normalizedCurrentPath) {
          // Only source is current, just reload to ensure consistency
          loadFiles();
        }
        
        // Refresh affected folders in tree (both source and target)
        // Use Set to avoid duplicate refreshes
        const foldersToRefresh = new Set<string>();
        if (normalizedDraggedParent || normalizedDraggedParent === '') {
          foldersToRefresh.add(normalizedDraggedParent);
        }
        if (normalizedTargetPath || normalizedTargetPath === '') {
          foldersToRefresh.add(normalizedTargetPath);
        }
        
        // Refresh each folder in tree
        foldersToRefresh.forEach(folderPath => {
          setRefreshFolderPath(folderPath);
          setTimeout(() => setRefreshFolderPath(null), 100);
        });
        
        showToast(`"${draggedName || draggedPath}" ${t('itemMovedTo')} "${targetDir.name}" ${t('moved')}`, 'success');
      } else {
        showToast(data.error || t('movingError'), 'error');
      }
    } catch (error) {
      console.error('Fehler beim Verschieben:', error);
      showToast(t('movingError'), 'error');
    } finally {
      setDraggedItem(null);
    }
  }

  function handleDragEnd() {
    setDraggedItem(null);
    setDragOverItem(null);
    setInternalDragOver(false);
  }

  function handleExternalDragOver(file: FileItem, e: React.DragEvent) {
    // Check if dragging external files
    if (e.dataTransfer.types.includes('Files') && file.type === 'directory') {
      e.preventDefault();
      e.stopPropagation();
      setExternalDragTarget(file.path);
      setDragOverItem(file.path);
    }
  }

  function handleExternalDragLeave() {
    setExternalDragTarget(null);
    setDragOverItem(null);
  }

  function handleExternalDrop(file: FileItem, e: React.DragEvent) {
    if (e.dataTransfer.files.length > 0 && file.type === 'directory') {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      handleExternalFilesDrop(files, file.path);
      setExternalDragTarget(null);
      setDragOverItem(null);
    }
  }

  function handleRefresh() {
    invalidateCache(currentPath);
    loadFiles();
    // Don't refresh entire tree - only refresh affected folders via refreshFolderPath
    // setTreeRefreshKey((k) => k + 1);
  }

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const sortedFiles = getSortedFiles();

  // Detect mobile viewport
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    }
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile sidebar when navigating
  useEffect(() => {
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [currentPath, isMobile]);

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('appName')}</h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {user.name}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={t('settings')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={t('logout')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isMobile && mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar - File Tree / Favorites - Desktop */}
        {!isMobile && (
          <div
            className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col relative transition-all duration-300 ${
              sidebarCollapsed ? 'w-0 overflow-visible border-r-0' : 'flex-shrink-0'
            }`}
            style={!sidebarCollapsed ? { width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '600px' } : { width: '0px', minWidth: '0px', maxWidth: '0px' }}
          >
          {/* Tabs and Collapse Button */}
          {!sidebarCollapsed && (
            <>
              <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={() => setSidebarTab('tree')}
                  className={`flex-1 px-2 md:px-4 py-2 text-sm font-medium transition-colors ${
                    sidebarTab === 'tree'
                      ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {t('folders')}
                </button>
                <button
                  onClick={() => setSidebarTab('favorites')}
                  className={`flex-1 px-2 md:px-4 py-2 text-sm font-medium transition-colors relative ${
                    sidebarTab === 'favorites'
                      ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {t('favorites')}
                  {favorites.size > 0 && (
                    <span className="absolute top-1 right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {favorites.size}
                    </span>
                  )}
                </button>
                {/* Collapse Button - Desktop only */}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="px-2 md:px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  title={t('hideSidebar')}
                >
                  <svg 
                    className="w-5 h-5 transition-transform duration-300"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {sidebarTab === 'tree' ? (
                <FileTree
                key={`tree-${treeRefreshKey}`}
                currentPath={currentPath}
                onNavigate={navigateToPath}
                onRefresh={handleRefresh}
                onExternalDrop={handleExternalDropWithEvent}
                userId={user.id}
                refreshFolderPath={refreshFolderPath}
                setRefreshFolderPath={setRefreshFolderPath}
                onRename={handleRename}
                onDelete={openDeleteModal}
                onDownload={handleDownload}
                onShare={handleShare}
                onToggleFavorite={handleToggleFavorite}
                isFavorite={(path) => favorites.has(path)}
                onFileDoubleClick={async (filePath: string, fileName: string) => {
                  // Create a FileItem from the file and open it in preview
                  const fileItem: FileItem = {
                    name: fileName,
                    path: filePath,
                    type: 'file',
                  };
                  setPreviewFile(fileItem);
                }}
                onItemDeleted={(itemPath) => {
                  // This callback is called from FileTree when an item is deleted
                  // The item will be removed from the tree via removeItemFromTree
                  // We also refresh the parent folder to update its contents
                  const parentPath = itemPath.split('/').slice(0, -1).join('/');
                  if (parentPath || parentPath === '') {
                    setRefreshFolderPath(parentPath);
                    setTimeout(() => setRefreshFolderPath(null), 100);
                  }
                }}
                onItemRenamed={(oldPath, newName, newPath) => {
                  // This callback is called from FileTree when an item is renamed
                  // The file list will be refreshed by onRefresh in FileTree
                  // No need to do anything here - onRefresh will reload the folder
                }}
                onItemMoved={(oldPath, newPath) => {
                  // This callback is called from FileTree when an item is moved
                  // The item has already been removed from the tree by removeItemFromTree
                  // We just need to refresh the affected folders
                  const oldParent = oldPath.split('/').slice(0, -1).join('/');
                  const newParent = newPath.split('/').slice(0, -1).join('/');
                  
                  // Refresh both source and target folders
                  if (oldParent || oldParent === '') {
                    setRefreshFolderPath(oldParent);
                    setTimeout(() => setRefreshFolderPath(null), 100);
                  }
                  if (newParent || newParent === '') {
                    setTimeout(() => {
                      setRefreshFolderPath(newParent);
                      setTimeout(() => setRefreshFolderPath(null), 100);
                    }, 150);
                  }
                }}
                onCreateDirectory={(parentPath: string) => {
                  // This is now handled directly in FileTree, so we don't need to do anything here
                  // The FileTree component will show the input field directly
                }}
                onMoveItem={async (itemPath: string, targetPath: string) => {
                  try {
                    const res = await fetch('/api/files', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'move',
                        path: itemPath,
                        targetPath: targetPath,
                      }),
                    });

                    const data = await res.json();

                    if (res.ok) {
                      // Refresh if the move affects the current directory (source or target)
                      const draggedParent = itemPath.split('/').slice(0, -1).join('/');
                      const normalizedDraggedParent = draggedParent || '';
                      const normalizedCurrentPath = currentPath || '';
                      const normalizedTargetPath = targetPath || '';
                      
                      // Update files state immediately if source is the current directory (remove item)
                      if (normalizedDraggedParent === normalizedCurrentPath) {
                        setFiles(prevFiles => prevFiles.filter(file => file.path !== itemPath));
                      }
                      
                      // Reload after a short delay to ensure API has processed the move
                      if (normalizedTargetPath === normalizedCurrentPath || normalizedDraggedParent === normalizedCurrentPath) {
                        setTimeout(() => {
                          loadFiles();
                        }, 100);
                      }
                      
                      // Refresh affected folders in tree (both source and target)
                      // Use Set to avoid duplicate refreshes
                      const foldersToRefresh = new Set<string>();
                      if (normalizedDraggedParent || normalizedDraggedParent === '') {
                        foldersToRefresh.add(normalizedDraggedParent);
                      }
                      if (normalizedTargetPath || normalizedTargetPath === '') {
                        foldersToRefresh.add(normalizedTargetPath);
                      }
                      
                      // Refresh each folder in tree
                      foldersToRefresh.forEach(folderPath => {
                        setRefreshFolderPath(folderPath);
                        setTimeout(() => setRefreshFolderPath(null), 100);
                      });
                      // Find item name for toast message
                      const item = files.find(f => f.path === itemPath);
                      const target = files.find(f => f.path === targetPath);
                      showToast(`"${item?.name || t('file')}" ${t('itemMovedTo')} "${target?.name || t('root')}" ${t('moved')}`, 'success'
                      );
                    } else {
                      showToast(data.error || t('errorMoving'), 'error');
                    }
                  } catch (error) {
                    console.error('Fehler beim Verschieben:', error);
                    showToast(t('errorMoving'), 'error');
                  }
                }}
              />
            ) : (
              <FavoritesList
                key={`favorites-${treeRefreshKey}`}
                currentPath={currentPath}
                onNavigate={navigateToPath}
                userId={user.id}
                refreshKey={treeRefreshKey}
                onFileDoubleClick={async (filePath: string, fileName: string) => {
                  // Create a FileItem from the favorite and open it in preview
                  const fileItem: FileItem = {
                    name: fileName,
                    path: filePath,
                    type: 'file',
                  };
                  setPreviewFile(fileItem);
                  // Don't navigate - keep the current view and just show the preview
                }}
                onFavoriteRemoved={() => {
                  // Reload favorites to update the count
                  fetch('/api/files/favorites')
                    .then(res => res.json())
                    .then(data => {
                      setFavorites(new Set(data.favorites.map((f: { path: string }) => f.path)));
                    })
                    .catch(console.error);
                }}
              />
            )}
              </div>
              
              {/* Storage Quota - Bottom of Sidebar */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                <StorageQuota />
              </div>
            </>
          )}
          
          
          {/* Resize Handle - Only on Desktop */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
              className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors ${
                isResizing ? 'bg-blue-500' : 'bg-transparent'
              }`}
              style={{ zIndex: 10 }}
            >
              <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 w-3 h-12 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="w-0.5 h-8 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Mobile Sidebar */}
        {isMobile && (
          <div
            className={`fixed inset-y-0 left-0 z-50 w-80 shadow-2xl bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 ${
              mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => setSidebarTab('tree')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  sidebarTab === 'tree'
                    ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                {t('folders')}
              </button>
              <button
                onClick={() => setSidebarTab('favorites')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                  sidebarTab === 'favorites'
                    ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                {t('favorites')}
                {favorites.size > 0 && (
                  <span className="absolute top-1 right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {favorites.size}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {sidebarTab === 'tree' ? (
                <FileTree
                  key={`tree-${treeRefreshKey}`}
                  currentPath={currentPath}
                  onNavigate={navigateToPath}
                  onRefresh={handleRefresh}
                  onExternalDrop={handleExternalDropWithEvent}
                  userId={user.id}
                  refreshFolderPath={refreshFolderPath}
                  setRefreshFolderPath={setRefreshFolderPath}
                  onRename={handleRename}
                  onDelete={openDeleteModal}
                  onDownload={handleDownload}
                  onShare={handleShare}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={(path) => favorites.has(path)}
                  onItemDeleted={(itemPath) => {
                    // This callback is called from FileTree when an item is deleted
                    // The item will be removed from the tree via removeItemFromTree
                    // We also refresh the parent folder to update its contents
                    const parentPath = itemPath.split('/').slice(0, -1).join('/');
                    if (parentPath || parentPath === '') {
                      setRefreshFolderPath(parentPath);
                      setTimeout(() => setRefreshFolderPath(null), 100);
                    }
                  }}
                  onItemRenamed={(oldPath, newName, newPath) => {
                    // This callback is called from FileTree when an item is renamed
                    // The file list will be refreshed by onRefresh in FileTree
                    // No need to do anything here - onRefresh will reload the folder
                  }}
                  onItemMoved={(oldPath, newPath) => {
                    // This callback is called from FileTree when an item is moved
                    // The item has already been removed from the tree by removeItemFromTree
                    // We just need to refresh the affected folders
                    const oldParent = oldPath.split('/').slice(0, -1).join('/');
                    const newParent = newPath.split('/').slice(0, -1).join('/');
                    
                    // Refresh both source and target folders
                    if (oldParent || oldParent === '') {
                      setRefreshFolderPath(oldParent);
                      setTimeout(() => setRefreshFolderPath(null), 100);
                    }
                    if (newParent || newParent === '') {
                      setTimeout(() => {
                        setRefreshFolderPath(newParent);
                        setTimeout(() => setRefreshFolderPath(null), 100);
                      }, 150);
                    }
                  }}
                  onCreateDirectory={(parentPath: string) => {
                    // This is now handled directly in FileTree, so we don't need to do anything here
                    // The FileTree component will show the input field directly
                  }}
                  onFileDoubleClick={async (filePath: string, fileName: string) => {
                    const fileItem: FileItem = {
                      name: fileName,
                      path: filePath,
                      type: 'file',
                    };
                    setPreviewFile(fileItem);
                  }}
                  onMoveItem={async (itemPath: string, targetPath: string) => {
                    try {
                      const res = await fetch('/api/files', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'move',
                          path: itemPath,
                          targetPath: targetPath,
                        }),
                      });

                      const data = await res.json();

                      if (res.ok) {
                        // Refresh if the move affects the current directory (source or target)
                        const draggedParent = itemPath.split('/').slice(0, -1).join('/');
                        const normalizedDraggedParent = draggedParent || '';
                        const normalizedCurrentPath = currentPath || '';
                        const normalizedTargetPath = targetPath || '';
                        
                        // Update files state immediately if source is the current directory (remove item)
                        if (normalizedDraggedParent === normalizedCurrentPath) {
                          setFiles(prevFiles => prevFiles.filter(file => file.path !== itemPath));
                        }
                        
                        // Reload after a short delay to ensure API has processed the move
                        if (normalizedTargetPath === normalizedCurrentPath || normalizedDraggedParent === normalizedCurrentPath) {
                          setTimeout(() => {
                            loadFiles();
                          }, 100);
                        }
                        
                        // Refresh affected folders in tree
                        if (draggedParent) {
                          setRefreshFolderPath(draggedParent);
                          setTimeout(() => setRefreshFolderPath(null), 100);
                        }
                        if (targetPath) {
                          setRefreshFolderPath(targetPath);
                          setTimeout(() => setRefreshFolderPath(null), 100);
                        }
                        
                        const item = files.find(f => f.path === itemPath);
                        const target = files.find(f => f.path === targetPath);
                        showToast(`"${item?.name || t('file')}" ${t('itemMovedTo')} "${target?.name || t('root')}" ${t('moved')}`, 'success');
                      } else {
                        showToast(data.error || t('errorMoving'), 'error');
                      }
                    } catch (error) {
                      console.error('Fehler beim Verschieben:', error);
                      showToast(t('errorMoving'), 'error');
                    }
                  }}
                />
              ) : (
                <FavoritesList
                  key={`favorites-${treeRefreshKey}`}
                  currentPath={currentPath}
                  onNavigate={navigateToPath}
                  userId={user.id}
                  refreshKey={treeRefreshKey}
                  onFileDoubleClick={async (filePath: string, fileName: string) => {
                    const fileItem: FileItem = {
                      name: fileName,
                      path: filePath,
                      type: 'file',
                    };
                    setPreviewFile(fileItem);
                  }}
                  onFavoriteRemoved={() => {
                    fetch('/api/files/favorites')
                      .then(res => res.json())
                      .then(data => {
                        setFavorites(new Set(data.favorites.map((f: { path: string }) => f.path)));
                      })
                      .catch(console.error);
                  }}
                />
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
              <StorageQuota />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div 
          className={`flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900 relative min-w-0 ${
            externalDragOver || dragOverItem === currentPath ? 'ring-2 ring-blue-500 ring-offset-2' : ''
          }`}
          onDragOver={(e) => {
            // Handle external file drops
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setExternalDragOver(true);
              setExternalDragTarget(currentPath);
              return;
            }
            
            // Check if drag is from tree or table (internal drag)
            const hasTreeDrag = e.dataTransfer.types.includes('application/x-item-path');
            const draggedPath = draggedItem?.path;
            const draggedType = draggedItem?.type;
            
            // Only handle if we have draggedItem (from table) or if it's a tree drag
            if ((draggedPath && draggedType) || hasTreeDrag) {
              // Get the parent directory of the dragged item
              const draggedParent = draggedPath ? draggedPath.split('/').slice(0, -1).join('/') : null;
              
              // Don't allow dropping if the item is already in the current directory
              if (draggedParent === currentPath) {
                return; // Don't show animation if already in the same folder
              }
              
              // For now, allow dropping on current path if it's not the same as dragged path
              // We'll do full validation in onDrop
              if (!draggedPath || draggedPath !== currentPath) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverItem(currentPath);
                setInternalDragOver(true);
              }
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setExternalDragOver(false);
              setExternalDragTarget(null);
              setInternalDragOver(false);
              // Only clear dragOverItem if it's the current path
              if (dragOverItem === currentPath) {
                setDragOverItem(null);
              }
            }
          }}
          onDrop={(e) => {
            // Handle external file drops
            if (e.dataTransfer.files.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              const files = Array.from(e.dataTransfer.files);
              handleExternalFilesDrop(files, currentPath);
              setExternalDragOver(false);
              setExternalDragTarget(null);
              return;
            }
            
            // Handle internal drags (from tree or table) to current path
            const hasTreeDrag = e.dataTransfer.types.includes('application/x-item-path');
            const draggedPath = draggedItem?.path || (hasTreeDrag ? e.dataTransfer.getData('application/x-item-path') : null);
            const draggedName = draggedItem?.name || (hasTreeDrag ? e.dataTransfer.getData('application/x-item-name') : null);
            const draggedType = draggedItem?.type || (hasTreeDrag ? (e.dataTransfer.getData('application/x-item-type') as 'file' | 'directory' | null) : null);
            
            if (draggedPath && draggedType && draggedPath !== currentPath) {
              // Get the parent directory of the dragged item
              const draggedParent = draggedPath.split('/').slice(0, -1).join('/');
              
              // Don't allow dropping if the item is already in the current directory
              if (draggedParent === currentPath) {
                setInternalDragOver(false);
                setDragOverItem(null);
                setDraggedItem(null);
                return;
              }
              
              e.preventDefault();
              e.stopPropagation();
              setDragOverItem(null);
              
              // Don't move directory into its own subdirectory
              if (draggedType === 'directory' && currentPath.startsWith(draggedPath + '/')) {
                setInternalDragOver(false);
                showToast(t('cannotMoveIntoSelf'), 'error');
                setDraggedItem(null);
                return;
              }
              
              // Move item to current path
              setInternalDragOver(false);
              (async () => {
                try {
                  const res = await fetch('/api/files', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'move',
                      path: draggedPath,
                      targetPath: currentPath,
                    }),
                  });

                  const data = await res.json();

                  if (res.ok) {
                    // Refresh both source and target folders in tree
                    const draggedParent = draggedPath.split('/').slice(0, -1).join('/');
                    const normalizedDraggedParent = draggedParent || '';
                    const normalizedCurrentPath = currentPath || '';
                    
                    // Update files state immediately if source is the current directory (remove item)
                    // Note: This shouldn't happen when dropping into current path, but handle it anyway
                    if (normalizedDraggedParent === normalizedCurrentPath) {
                      setFiles(prevFiles => prevFiles.filter(file => file.path !== draggedPath));
                    }
                    
                    // Refresh current directory immediately (item was moved here)
                    loadFiles();
                    
                    // Use Set to avoid duplicate refreshes
                    const foldersToRefresh = new Set<string>();
                    if (normalizedDraggedParent || normalizedDraggedParent === '') {
                      foldersToRefresh.add(normalizedDraggedParent);
                    }
                    if (normalizedCurrentPath || normalizedCurrentPath === '') {
                      foldersToRefresh.add(normalizedCurrentPath);
                    }
                    
                    // Refresh each folder in tree
                    foldersToRefresh.forEach(folderPath => {
                      setRefreshFolderPath(folderPath);
                      setTimeout(() => setRefreshFolderPath(null), 100);
                    });
                    showToast(`"${draggedName || draggedPath}" ${t('itemMovedTo')} "${currentPath.split('/').pop() || 'Root'}" ${t('moved')}`, 'success');
                  } else {
                    showToast(data.error || t('movingError'), 'error');
                  }
                } catch (error) {
                  console.error('Fehler beim Verschieben:', error);
                  showToast(t('movingError'), 'error');
                } finally {
                  setDraggedItem(null);
                }
              })();
            }
          }}
        >
          {/* External Drag Overlay */}
          {externalDragOver && (
            <div className="absolute inset-0 z-50 bg-blue-500/10 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
              <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-2xl border border-blue-500">
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{t('dropFilesHere')}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {externalDragTarget !== null && externalDragTarget !== currentPath
                        ? `In: ${externalDragTarget.split('/').pop() || 'Root'}`
                        : `In: ${currentPath || 'Root'}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Internal Drag Overlay (for drags from tree or table) */}
          {internalDragOver && (
            <div className="absolute inset-0 z-50 bg-green-500/10 border-4 border-dashed border-green-500 flex items-center justify-center pointer-events-none">
              <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-2xl border border-green-500">
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{t('dropHereToMove')}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('into')}: {currentPath.split('/').pop() || t('root')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0 relative">
            <div className="px-2 md:px-4 py-2 flex items-center gap-2 md:gap-4 flex-wrap">
              {/* Navigation */}
              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                {/* Sidebar Expand Button when collapsed - Desktop only */}
                {!isMobile && sidebarCollapsed && (
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                    title={t('showSidebar')}
                  >
                    <svg 
                      className="w-5 h-5 text-blue-600 dark:text-blue-400"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={navigateUp}
                  disabled={!currentPath}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={t('back')}
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={handleRefresh}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title={t('refresh')}
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <div className="hidden md:flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 px-2 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <button
                      onClick={() => navigateToPath('')}
                      className="hover:text-blue-600 dark:hover:text-blue-400 truncate"
                    >
                      {t('root')}
                    </button>
                    {pathParts.map((part, index) => (
                      <div key={index} className="flex items-center gap-1 min-w-0">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <button
                          onClick={() => navigateToBreadcrumb(index)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 truncate"
                        >
                          {part}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Mobile Breadcrumb - Simplified */}
                <div className="md:hidden flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 min-w-0 flex-1">
                  <button
                    onClick={() => navigateToPath('')}
                    className="hover:text-blue-600 dark:hover:text-blue-400 truncate font-medium"
                  >
                    {t('root')}
                  </button>
                  {pathParts.length > 0 && (
                    <>
                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="truncate font-medium">
                        {pathParts[pathParts.length - 1]}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Search Bar - Hidden on mobile (shown in overlay) */}
              <div className="flex-1 max-w-md min-w-0 hidden md:block">
                <SearchBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  filters={searchFilters}
                  onFiltersChange={setSearchFilters}
                  onClear={() => {
                    setSearchQuery('');
                    setSearchFilters({ fileType: 'all' });
                    setIsGlobalSearch(false);
                    setAllFiles([]);
                  }}
                />
                {(searchQuery || searchFilters.fileType !== 'all' || (searchFilters.fileExtensions && searchFilters.fileExtensions.length > 0) || searchFilters.minSize || searchFilters.maxSize || searchFilters.dateFrom || searchFilters.dateTo) && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    {searchLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                        <span>Suche...</span>
                      </>
                    ) : (
                      <>
                        {sortedFiles.length} {sortedFiles.length === 1 ? 'Ergebnis' : 'Ergebnisse'} gefunden
                        {isGlobalSearch ? ' (in allen Ordnern)' : files.length !== sortedFiles.length && ` (von ${files.length} ${files.length === 1 ? 'Element' : 'Elementen'})`}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Spacer to push buttons to the right */}
              <div className="flex-1"></div>

              {/* Actions - Always visible on the right */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Bulk Actions - Always visible, but grayed out when nothing selected */}
                <button
                  onClick={handleBulkDownload}
                  disabled={selectedItems.size === 0}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    selectedItems.size > 0
                      ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      : 'text-gray-400 dark:text-gray-500 opacity-50 cursor-not-allowed'
                  }`}
                  title={selectedItems.size > 0 ? `${selectedItems.size} ${t('itemsDownloaded')}` : t('selectItemsToDownload')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={openBulkDeleteModal}
                  disabled={selectedItems.size === 0}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    selectedItems.size > 0
                      ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'text-gray-400 dark:text-gray-500 opacity-50 cursor-not-allowed'
                  }`}
                  title={selectedItems.size > 0 ? `${selectedItems.size} ${t('itemsSelected')} - ${t('delete')}` : t('selectItemsToDelete')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                {/* Always available buttons - Hidden on mobile (moved to bottom nav) */}
                <button
                  onClick={handleCreateDirectory}
                  className="hidden md:flex p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title={t('createNew')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <div className="hidden md:block">
                  <FileUpload
                    currentPath={currentPath}
                    onUploaded={handleRefresh}
                    onFolderUpload={handleFolderUploadWithCurrentPath}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* File List and Preview Container */}
          <div className="flex-1 flex overflow-hidden pb-16 md:pb-0">
            {/* File List - Table View */}
            {!previewFile && (
              <div 
                ref={fileListContainerRef}
                className="flex flex-col overflow-auto relative flex-1 w-full"
                onContextMenu={handleEmptyContextMenu}
                onMouseDown={handleMarqueeMouseDown}
                style={{ userSelect: marqueeSelection?.isActive ? 'none' : 'auto' }}
                onTouchStart={(e) => {
                  if (isMobile && fileListContainerRef.current?.scrollTop === 0) {
                    pullStartY.current = e.touches[0].clientY;
                  }
                }}
                onTouchMove={(e) => {
                  if (isMobile && pullStartY.current !== null && fileListContainerRef.current?.scrollTop === 0) {
                    const distance = e.touches[0].clientY - pullStartY.current;
                    if (distance > 0) {
                      setPullToRefresh({ isPulling: true, distance: Math.min(distance, 100) });
                    }
                  }
                }}
                onTouchEnd={() => {
                  if (isMobile && pullToRefresh.isPulling && pullToRefresh.distance > 50) {
                    handleRefresh();
                  }
                  setPullToRefresh({ isPulling: false, distance: 0 });
                  pullStartY.current = null;
                }}
              >
                {/* Pull to Refresh Indicator */}
                {isMobile && pullToRefresh.isPulling && (
                  <div 
                    className="absolute top-0 left-0 right-0 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 transition-all duration-200"
                    style={{ 
                      height: `${Math.min(pullToRefresh.distance, 100)}px`,
                      transform: `translateY(-${Math.min(pullToRefresh.distance, 100)}px)`
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {pullToRefresh.distance > 50 ? (
                        <>
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('refresh')}</span>
                        </>
                      ) : (
                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Marquee Selection Rectangle */}
                {marqueeSelection && marqueeSelection.isActive && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-50"
                    style={{
                      left: `${Math.min(marqueeSelection.startX, marqueeSelection.endX)}px`,
                      top: `${Math.min(marqueeSelection.startY, marqueeSelection.endY)}px`,
                      width: `${Math.abs(marqueeSelection.endX - marqueeSelection.startX)}px`,
                      height: `${Math.abs(marqueeSelection.endY - marqueeSelection.startY)}px`,
                    }}
                  />
                )}
                
            {loading || searchLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">
                  {searchLoading ? t('searching') : t('loading')}
                </p>
              </div>
            ) : sortedFiles.length === 0 && !creatingNewDirectory ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  {searchQuery || searchFilters.fileType !== 'all' || (searchFilters.fileExtensions && searchFilters.fileExtensions.length > 0) || searchFilters.minSize || searchFilters.maxSize || searchFilters.dateFrom || searchFilters.dateTo ? (
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  )}
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {searchQuery || searchFilters.fileType !== 'all' || searchFilters.minSize || searchFilters.maxSize || searchFilters.dateFrom || searchFilters.dateTo
                    ? t('noResults')
                    : t('noFiles')}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-2 p-2 w-full">
                  {sortedFiles.map((file, index) => (
                    <div
                      key={file.path}
                      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 transition-all duration-200 ${
                        selectedItems.has(file.path)
                          ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      } ${filesLoaded ? 'animate-slide-down-stagger' : 'opacity-0'}`}
                      style={{ animationDelay: filesLoaded ? `${index * 50}ms` : '0ms' }}
                      onClick={(e) => {
                        if (e.detail === 1) {
                          const timer = setTimeout(() => {
                            if (!clickTimerRef.current) return;
                            handleRowClick(file, e);
                          }, 200);
                          clickTimerRef.current = timer;
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (clickTimerRef.current) {
                          clearTimeout(clickTimerRef.current);
                          clickTimerRef.current = null;
                        }
                        if (file.type === 'directory') {
                          navigateToPath(file.path);
                        } else {
                          setPreviewFile(file);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          item: file,
                          isEmpty: false,
                        });
                      }}
                    >
                      <div className="flex items-center gap-3 w-full overflow-hidden">
                        {selectedItems.size > 0 && (
                          <input
                            type="checkbox"
                            checked={selectedItems.has(file.path)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelection(file.path);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500 checked:bg-blue-600 dark:checked:bg-blue-500 checked:border-blue-600 dark:checked:border-blue-500 flex-shrink-0"
                          />
                        )}
                        <div className="flex-shrink-0">
                          <FileIcon fileName={file.name} isDirectory={file.type === 'directory'} />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0">
                              {renamingItem?.path === file.path ? (
                                <input
                                  ref={renameInputRef}
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={confirmRename}
                                  onKeyDown={handleRenameKeyDown}
                                  className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                file.name
                              )}
                            </p>
                            {file.type === 'file' && file.size !== undefined && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                {formatSize(file.size)}
                              </span>
                            )}
                            {file.type === 'directory' && file.size !== undefined && file.size > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                {formatSize(file.size)}
                              </span>
                            )}
                          </div>
                          {file.metadata?.lastModifiedAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                              {new Date(file.metadata.lastModifiedAt).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {file.type === 'file' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewFile(file);
                              }}
                              className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title={t('open')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            className="p-1.5 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title={t('download')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {creatingNewDirectory && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-blue-50 dark:bg-blue-900/20">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <input
                            ref={newDirectoryInputRef}
                            type="text"
                            value={newDirectoryName}
                            onChange={(e) => setNewDirectoryName(e.target.value)}
                            onBlur={confirmCreateDirectory}
                            onKeyDown={handleNewDirectoryKeyDown}
                            placeholder={t('nameWithExtension')}
                            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            autoFocus
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop Table View */}
                <table className="hidden md:table w-full table-auto">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                  <tr>
                    <th 
                      className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider transition-all duration-300 overflow-hidden ${
                        selectedItems.size > 0 ? 'w-12 opacity-100' : 'w-0 opacity-0'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedItems.size === sortedFiles.length && sortedFiles.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems(new Set(sortedFiles.map(f => f.path)));
                          } else {
                            setSelectedItems(new Set());
                            lastSelectedIndexRef.current = null;
                          }
                        }}
                        className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-0 cursor-pointer transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500 checked:bg-blue-600 dark:checked:bg-blue-500 checked:border-blue-600 dark:checked:border-blue-500"
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('name')}</span>
                        {sortField === 'name' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors hidden md:table-cell"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('type')}</span>
                        {sortField === 'type' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors hidden lg:table-cell"
                      onClick={() => handleSort('size')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>{t('size')}</span>
                        {sortField === 'size' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors hidden xl:table-cell"
                      onClick={() => handleSort('modified')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('modified')}</span>
                        {sortField === 'modified' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden 2xl:table-cell">
                      {t('createdBy')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {creatingNewDirectory && (
                    <tr
                      key="NEW_DIRECTORY_TEMP"
                      className="group cursor-pointer transition-colors bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 animate-slide-down-stagger"
                      style={{
                        animationDelay: '0ms',
                      }}
                    >
                      <td 
                        className={`px-4 py-3 transition-all duration-300 overflow-hidden ${
                          selectedItems.size > 0 ? 'w-auto opacity-100' : 'w-0 opacity-0'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          disabled
                          className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <input
                              ref={newDirectoryInputRef}
                              type="text"
                              value={newDirectoryName}
                              onChange={(e) => setNewDirectoryName(e.target.value)}
                              onKeyDown={handleNewDirectoryKeyDown}
                              onClick={(e) => e.stopPropagation()}
                              placeholder={t('nameWithExtension')}
                              className="w-full px-2 py-1 border border-blue-500 rounded text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                        Ordner
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-right hidden lg:table-cell font-mono">
                        -
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                        -
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden 2xl:table-cell">
                        -
                      </td>
                    </tr>
                  )}
                  {sortedFiles.slice(visibleRange.start, visibleRange.end).map((file, index) => {
                    const actualIndex = visibleRange.start + index;
                    const isSelected = selectedItems.has(file.path);
                    return (
                      <tr
                        key={`${file.path}-${filesLoaded}`}
                        data-file-path={file.path}
                        data-index={actualIndex}
                        style={{
                          animationDelay: filesLoaded ? `${index * 50}ms` : '0ms',
                        }}
                        onClick={(e) => handleRowClick(file, e)}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Clear any pending click timer to prevent selection
                          if (clickTimerRef.current) {
                            clearTimeout(clickTimerRef.current);
                            clickTimerRef.current = null;
                          }
                          // Deselect if file was selected by single click
                          if (selectedItems.has(file.path)) {
                            toggleSelection(file.path);
                          }
                          if (file.type === 'directory') {
                            navigateToPath(file.path);
                            setIsGlobalSearch(false);
                            setSearchQuery('');
                            setSearchFilters({ fileType: 'all' });
                          } else {
                            setPreviewFile(file);
                          }
                        }}
                        onContextMenu={(e) => handleContextMenu(file, e)}
                        draggable={true}
                        onDragStart={(e) => {
                          // Only handle internal drags
                          if (!e.dataTransfer.types.includes('Files')) {
                            handleDragStart(file, e);
                          }
                        }}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => {
                          // Check if drag is from tree (external to table) by checking dataTransfer types
                          const hasTreeDrag = e.dataTransfer.types.includes('application/x-item-path') && !draggedItem;
                          
                          // Handle external file drops
                          if (e.dataTransfer.types.includes('Files') && !draggedItem) {
                            handleExternalDragOver(file, e);
                          } else if (hasTreeDrag || draggedItem) {
                            // Handle drags from tree or internal drags
                            handleDragOver(file, e);
                          }
                        }}
                        onDragLeave={(e) => {
                          // Check if drag is from tree (external to table) by checking dataTransfer types
                          const hasTreeDrag = e.dataTransfer.types.includes('application/x-item-path') && !draggedItem;
                          
                          if (e.dataTransfer.types.includes('Files') && !draggedItem) {
                            handleExternalDragLeave();
                          } else if (hasTreeDrag || draggedItem) {
                            // Handle drags from tree or internal drags
                            handleDragLeave();
                          }
                        }}
                        onDrop={(e) => {
                          // Handle both internal and external drops
                          if (e.dataTransfer.files.length > 0 && !draggedItem) {
                            handleExternalDrop(file, e);
                          } else {
                            handleDrop(file, e);
                          }
                        }}
                        className={`group cursor-pointer transition-colors ${
                          filesLoaded ? 'animate-slide-down-stagger' : 'opacity-0'
                        } ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            : focusedIndex !== null && sortedFiles.findIndex(f => f.path === file.path) === focusedIndex
                            ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500 dark:ring-blue-400'
                            : dragOverItem === file.path && file.type === 'directory'
                            ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-600'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        } ${draggedItem?.path === file.path ? 'opacity-50' : ''}`}
                      >
                        <td 
                          className={`px-4 py-3 transition-all duration-300 overflow-hidden ${
                            selectedItems.size > 0 ? 'w-auto opacity-100' : 'w-0 opacity-0'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              toggleSelection(file.path);
                              const sorted = getSortedFiles();
                              const currentIndex = sorted.findIndex(f => f.path === file.path);
                              lastSelectedIndexRef.current = currentIndex;
                            }}
                            className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-0 cursor-pointer transition-all duration-200 hover:border-blue-400 dark:hover:border-blue-500 checked:bg-blue-600 dark:checked:bg-blue-500 checked:border-blue-600 dark:checked:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                              file.type === 'directory'
                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              {file.type === 'directory' ? (
                                <svg
                                  className="w-5 h-5 text-blue-500 dark:text-blue-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                  />
                                </svg>
                              ) : (
                                <FileIcon 
                                  fileName={file.name} 
                                  isDirectory={false}
                                  className="w-5 h-5 text-blue-500 dark:text-blue-400"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              {renamingItem?.path === file.path ? (
                                <input
                                  ref={renameInputRef}
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={confirmRename}
                                  onKeyDown={handleRenameKeyDown}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 border border-blue-500 rounded text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                              ) : (
                                <div className="flex flex-col min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white truncate">
                                    {file.name}
                                  </div>
                                  {isGlobalSearch && file.path !== file.name && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                      {file.path.split('/').slice(0, -1).join(' / ') || 'Root'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                          {file.type === 'directory' ? 'Ordner' : getFileExtension(file.name) || 'Datei'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-right hidden lg:table-cell font-mono">
                          {file.type === 'directory' 
                            ? (file.size !== undefined && file.size > 0 ? formatFileSize(file.size) : '-')
                            : formatFileSize(file.size || 0)
                          }
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                          {formatDate(file.modified)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden 2xl:table-cell">
                          {file.metadata ? (
                            <div className="space-y-1">
                              <div>
                                <span className="font-medium">{file.metadata.createdBy.name}</span>
                              </div>
                              {file.metadata.renamedBy && (
                                <div className="text-xs text-gray-500 dark:text-gray-500">
                                  <span>Umbenannt von {file.metadata.renamedBy.name}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDownload(file)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title={t('download')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteModal(file);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title={t('delete')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            {/* Virtualisierung: Spacer für nicht gerenderte Zeilen */}
            {sortedFiles.length > visibleRange.end && (
              <div style={{ height: `${(sortedFiles.length - visibleRange.end) * 48}px` }} />
            )}
              </>
            )}
          </div>
            )}

            {/* File Preview - Fullscreen (only shown when file is double-clicked) */}
            {previewFile && (
              <div 
                className="relative flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden min-h-0"
              >
                <FilePreview
                  file={previewFile}
                  onClose={() => setPreviewFile(null)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>

      {/* Context Menu */}
      {contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, item: null, isEmpty: false })}
          onOpen={contextMenu.item && contextMenu.item.type === 'directory' ? () => navigateToPath(contextMenu.item!.path) : undefined}
          onDownload={contextMenu.item && contextMenu.item.type === 'file' ? () => handleDownload(contextMenu.item!) : undefined}
          onDelete={contextMenu.item ? () => openDeleteModal(contextMenu.item!) : undefined}
          onRename={contextMenu.item ? () => handleRename(contextMenu.item!) : undefined}
          onCreateDirectory={contextMenu.isEmpty ? handleCreateDirectoryFromContext : undefined}
          onShare={contextMenu.item ? () => handleShare(contextMenu.item!) : undefined}
          onToggleFavorite={contextMenu.item ? () => handleToggleFavorite(contextMenu.item!) : undefined}
          isFavorite={contextMenu.item ? favorites.has(contextMenu.item.path) : false}
          itemType={contextMenu.isEmpty ? 'empty' : (contextMenu.item?.type || 'file')}
        />
      )}

      {/* Delete Modal */}
      {deleteModal.visible && (deleteModal.item || deleteModal.items.length > 0) && (
        <DeleteModal
          isOpen={deleteModal.visible}
          onClose={() => setDeleteModal({ visible: false, item: null, items: [] })}
          onConfirm={confirmDelete}
          itemName={deleteModal.item?.name}
          itemType={deleteModal.item?.type}
          items={deleteModal.items.length > 0 ? deleteModal.items.map(item => ({ name: item.name, type: item.type })) : undefined}
        />
      )}

      {/* Upload Progress Overlay - must be rendered BEFORE ReplaceModal for z-index to work */}
      {uploadProgress && !replaceModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {uploadProgress.total > 1 ? 'Dateien werden hochgeladen...' : 'Datei wird hochgeladen...'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {uploadProgress.current}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {uploadProgress.total > 1 
                ? `${uploadProgress.completed} von ${uploadProgress.total} Dateien hochgeladen`
                : uploadProgress.completed === 1 
                  ? 'Datei erfolgreich hochgeladen'
                  : 'Datei wird hochgeladen...'}
            </p>
          </div>
        </div>
      )}

      {/* Replace Modal - rendered AFTER Upload Overlay so it appears on top with z-[60] */}
      <ReplaceModal
        isOpen={replaceModal.isOpen}
        onClose={handleReplaceCancel}
        onConfirm={handleReplaceConfirm}
        fileName={replaceModal.file?.name || ''}
      />

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-30 md:hidden">
          <div className="flex items-center justify-around py-2 px-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-xs">{t('folders')}</span>
            </button>
            <button
              onClick={handleCreateDirectory}
              className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">{t('new')}</span>
            </button>
            <FileUpload
              currentPath={currentPath}
              onUploaded={handleRefresh}
              onFolderUpload={handleFolderUploadWithCurrentPath}
            >
              <div className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-xs">{t('upload')}</span>
              </div>
            </FileUpload>
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="flex flex-col items-center gap-1 p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs">{t('search')}</span>
            </button>
            {selectedItems.size > 0 && (
              <>
                <button
                  onClick={handleBulkDownload}
                  className="flex flex-col items-center gap-1 p-2 text-blue-600 dark:text-blue-400 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="text-xs">{t('download')}</span>
                </button>
                <button
                  onClick={openBulkDeleteModal}
                  className="flex flex-col items-center gap-1 p-2 text-red-600 dark:text-red-400 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="text-xs">{t('delete')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Search Overlay */}
      {isMobile && mobileSearchOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden" onClick={() => setMobileSearchOpen(false)}>
          <div 
            className="absolute inset-0 bg-white dark:bg-gray-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('search')}</h2>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <SearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filters={searchFilters}
                onFiltersChange={setSearchFilters}
                onClear={() => {
                  setSearchQuery('');
                  setSearchFilters({ fileType: 'all' });
                  setIsGlobalSearch(false);
                  setAllFiles([]);
                }}
              />
            </div>

            {/* Search Results Info */}
            {(searchQuery || searchFilters.fileType !== 'all' || searchFilters.minSize || searchFilters.maxSize || searchFilters.dateFrom || searchFilters.dateTo) && (
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                {searchLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                    <span>{t('searching')}</span>
                  </>
                ) : (
                  <>
                    {sortedFiles.length} {sortedFiles.length === 1 ? t('resultSingular') : t('resultPlural')} {t('foundText')}
                    {isGlobalSearch ? t('inAllFoldersText') : files.length !== sortedFiles.length && ` (${t('ofText')} ${files.length} ${files.length === 1 ? t('itemSingular') : t('itemPlural')})`}
                  </>
                )}
              </div>
            )}

            {/* Search Results List */}
            <div className="flex-1 overflow-y-auto p-4">
              {searchQuery || searchFilters.fileType !== 'all' || searchFilters.minSize || searchFilters.maxSize || searchFilters.dateFrom || searchFilters.dateTo ? (
                sortedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {sortedFiles.map((file) => (
                      <div
                        key={file.path}
                        onClick={() => {
                          if (file.type === 'directory') {
                            navigateToPath(file.path);
                            setMobileSearchOpen(false);
                          } else {
                            setPreviewFile(file);
                            setMobileSearchOpen(false);
                          }
                        }}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileIcon fileName={file.name} isDirectory={file.type === 'directory'} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate">{file.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{file.path}</div>
                          </div>
                          {file.type === 'file' && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !searchLoading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {t('noResultsFound')}
                  </div>
                ) : null
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {t('enterSearchTerm')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onUserUpdate={(updatedUser) => {
          // Handle user update if needed
        }}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, itemName: '', itemPath: '', itemType: 'file' })}
        itemName={shareModal.itemName}
        itemPath={shareModal.itemPath}
        itemType={shareModal.itemType}
      />

      {/* Toast */}
      {toast && (
        <Toast
          key={`toast-${toast.id}`}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={2000}
        />
      )}
    </div>
  );
}

