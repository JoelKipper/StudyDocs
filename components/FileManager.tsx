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
}

export default function FileManager({ user, onLogout }: FileManagerProps) {
  const storageKey = `studydocs-path-${user.id}`;
  
  // Load saved path from localStorage on mount
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return saved || '';
    }
    return '';
  });
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]); // All files for global search
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<{
    fileType: 'all' | 'file' | 'directory';
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
  const [draggedItem, setDraggedItem] = useState<FileItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const [externalDragTarget, setExternalDragTarget] = useState<string | null>(null);
  const [replaceModal, setReplaceModal] = useState<{
    isOpen: boolean;
    file: File | null;
    targetPath: string;
  }>({
    isOpen: false,
    file: null,
    targetPath: '',
  });
  const [uploadQueue, setUploadQueue] = useState<Array<{ file: File; targetPath: string }>>([]);

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

  // Handle resize
  useEffect(() => {
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
  }, [isResizing]);

  useEffect(() => {
    loadFiles();
  }, [currentPath]);

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
  }, [currentPath]);

  useEffect(() => {
    async function processUploadQueue() {
      if (uploadQueue.length === 0 || replaceModal.isOpen) return;

      const { file, targetPath } = uploadQueue[0];
      
      // Check if file exists
      try {
        const checkRes = await fetch(
          `/api/files/check?fileName=${encodeURIComponent(file.name)}&path=${encodeURIComponent(targetPath)}`
        );
        const checkData = await checkRes.json();
        
        if (checkData.exists) {
          // Show replace modal
          setReplaceModal({ isOpen: true, file, targetPath });
          return;
        }
      } catch (error) {
        console.error('Fehler beim Prüfen der Datei:', error);
      }

      // File doesn't exist, upload it
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
      } catch (error: any) {
        console.error('Fehler beim Hochladen:', error);
      }
      
      // Process next file in queue
      setUploadQueue((queue) => queue.slice(1));
    }

    if (uploadQueue.length > 0 && !replaceModal.isOpen) {
      processUploadQueue();
    }
  }, [uploadQueue, replaceModal.isOpen]);

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

  const handleExternalFilesDrop = useCallback(async (files: File[], targetPath: string) => {
    // Add all files to queue
    setUploadQueue(files.map(file => ({ file, targetPath })));
  }, []);

  async function handleReplaceConfirm() {
    if (replaceModal.file && replaceModal.targetPath) {
      // Upload file with replacement
      await uploadSingleFile(replaceModal.file, replaceModal.targetPath);
      
      // Process next file in queue
      setUploadQueue((queue) => queue.slice(1));
      setReplaceModal({ isOpen: false, file: null, targetPath: '' });
    }
  }

  function handleReplaceCancel() {
    // Skip this file and process next
    setUploadQueue((queue) => queue.slice(1));
    setReplaceModal({ isOpen: false, file: null, targetPath: '' });
  }

  // Track upload results
  useEffect(() => {
    if (uploadQueue.length === 0 && replaceModal.isOpen === false) {
      // All files processed, refresh
      loadFiles();
      setTreeRefreshKey((k) => k + 1);
    }
  }, [uploadQueue.length, replaceModal.isOpen]);

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
          setToast({ message: `${selectedFiles.length} Element(e) kopiert`, type: 'success' });
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
          setToast({ message: `${selectedFiles.length} Element(e) ausgeschnitten`, type: 'success' });
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

      // Enter: Open selected item or first item
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
              handleDownload(selectedFile);
            }
          }
        } else if (filesToUse.length > 0) {
          // Open first item if nothing selected
          const firstItem = filesToUse[0];
          if (firstItem.type === 'directory') {
            navigateToPath(firstItem.path);
          } else {
            handleDownload(firstItem);
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

    function handleDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      setExternalDragOver(false);
      
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        // Use currentPath as fallback if no specific target was set
        const target = externalDragTarget !== null ? externalDragTarget : currentPath;
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

  async function loadFiles() {
    setLoading(true);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
      const data = await res.json();
      if (res.ok) {
        setFiles(data.contents || []);
        setFocusedIndex(null); // Reset focus when loading new directory
      }
    } catch (error) {
      console.error('Fehler beim Laden der Dateien:', error);
    } finally {
      setLoading(false);
    }
  }

  function navigateToPath(path: string) {
    setCurrentPath(path);
    setSelectedFile(null);
  }

  function navigateUp() {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
    setSelectedFile(null);
  }

  function navigateToBreadcrumb(index: number) {
    const parts = currentPath.split('/').filter(Boolean);
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
    setSelectedFile(null);
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
        setToast({ message: data.error || 'Fehler bei der Suche', type: 'error' });
        setAllFiles([]);
      }
    } catch (error) {
      console.error('Fehler bei der globalen Suche:', error);
      setToast({ message: 'Fehler bei der Suche', type: 'error' });
      setAllFiles([]);
    } finally {
      setSearchLoading(false);
    }
  }

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

    let filtered = [...filesToFilter];

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
    const newSelected = new Set(selectedItems);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedItems(newSelected);
  }

  function handleRowClick(file: FileItem, e: React.MouseEvent) {
    // Don't navigate if clicking on checkbox or action buttons
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('button')) {
      return;
    }

    if (e.detail === 2) {
      // Double click - download file or navigate to directory
      if (file.type === 'directory') {
        navigateToPath(file.path);
        setIsGlobalSearch(false);
        setSearchQuery('');
        setSearchFilters({ fileType: 'all' });
      } else {
        handleDownload(file);
      }
    } else {
      // Single click
      if (file.type === 'directory') {
        // Navigate directly into directory on single click
        navigateToPath(file.path);
        setIsGlobalSearch(false);
        setSearchQuery('');
        setSearchFilters({ fileType: 'all' });
      } else {
        // For global search results, navigate to parent directory
        if (isGlobalSearch) {
          const parentPath = file.path.split('/').slice(0, -1).join('/');
          navigateToPath(parentPath);
          setIsGlobalSearch(false);
          setSearchQuery('');
          setSearchFilters({ fileType: 'all' });
        } else {
          // Toggle selection for files
          toggleSelection(file.path);
        }
      }
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

    const directoryName = newDirectoryName.trim();
    const directoryPath = currentPath ? `${currentPath}/${directoryName}` : directoryName;

    // Clear the input immediately for better UX - this makes the input field disappear
    const nameToCreate = directoryName;
    setCreatingNewDirectory(null);
    setNewDirectoryName('');

    try {
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
        setToast({ message: data.error || 'Fehler beim Erstellen', type: 'error' });
        return;
      }
      
      // Reload files first
      await loadFiles();
      setTreeRefreshKey((k) => k + 1);
      
      // Don't set pending rename - just show the directory normally
      // The user can rename it manually if needed
      setToast({ message: 'Verzeichnis erfolgreich erstellt', type: 'success' });
    } catch (err) {
      setToast({ message: 'Verbindungsfehler', type: 'error' });
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
    setRenameValue(item.name);
    // Focus input after state update
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }

  async function confirmRename() {
    if (!renamingItem || !renameValue.trim() || renameValue === renamingItem.name) {
      setRenamingItem(null);
      setRenameValue('');
      return;
    }

    const oldName = renamingItem.name;
    const newName = renameValue.trim();

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

        loadFiles();
        setTreeRefreshKey((k) => k + 1);
        setRenamingItem(null);
        setRenameValue('');
        setToast({ message: 'Erfolgreich umbenannt', type: 'success' });
      } else {
        setToast({ message: data.error || 'Fehler beim Umbenennen', type: 'error' });
        setRenamingItem(null);
        setRenameValue('');
      }
    } catch (error) {
      console.error('Fehler beim Umbenennen:', error);
      setToast({ message: 'Fehler beim Umbenennen', type: 'error' });
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
        setToast({ 
          message: `Fehler beim Löschen von ${errors.length} Element(en)`, 
          type: 'error' 
        });
      } else {
        const count = itemsToDelete.length;
        setToast({ 
          message: `${count} Element(e) erfolgreich gelöscht`, 
          type: 'success' 
        });
      }

      // Save to history for undo - store items with their full data for potential restoration
      setActionHistory(prev => [...prev, {
        type: 'delete',
        data: { items: itemsToDelete.map(item => ({ ...item })) }
      }]);

      // Clear selection
      setSelectedItems(new Set());
      
      loadFiles();
      setTreeRefreshKey((k) => k + 1);
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      setToast({ message: 'Fehler beim Löschen', type: 'error' });
    } finally {
      setDeleteModal({ visible: false, item: null, items: [] });
    }
  }

  async function handleCopy() {
    const selectedFiles = (isGlobalSearch ? allFiles : files).filter(f => selectedItems.has(f.path));
    if (selectedFiles.length > 0) {
      setCopiedItems(selectedFiles);
      setIsCopyMode(true);
      setToast({ message: `${selectedFiles.length} Element(e) kopiert`, type: 'success' });
    }
  }

  async function handleCut() {
    const selectedFiles = (isGlobalSearch ? allFiles : files).filter(f => selectedItems.has(f.path));
    if (selectedFiles.length > 0) {
      setCopiedItems(selectedFiles);
      setIsCopyMode(false);
      setToast({ message: `${selectedFiles.length} Element(e) ausgeschnitten`, type: 'success' });
    }
  }

  async function handlePaste() {
    if (copiedItems.length === 0) return;

    try {
      setToast({ message: `${copiedItems.length} Element(e) werden ${isCopyMode ? 'kopiert' : 'verschoben'}...`, type: 'info' });

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
        setToast({ 
          message: `Fehler beim ${isCopyMode ? 'Kopieren' : 'Verschieben'} von ${errors.length} Element(en)`, 
          type: 'error' 
        });
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

        setToast({ 
          message: `${successfulItems.length} Element(e) erfolgreich ${isCopyMode ? 'kopiert' : 'verschoben'}`, 
          type: 'success' 
        });

        // Clear copied items if cut mode (keep them for copy mode so user can paste multiple times)
        if (!isCopyMode) {
          setCopiedItems([]);
        }
      }

      loadFiles();
      setTreeRefreshKey((k) => k + 1);
    } catch (error: any) {
      console.error('Fehler beim Einfügen:', error);
      setToast({ message: error.message || 'Fehler beim Einfügen', type: 'error' });
    }
  }

  async function handleUndo() {
    if (actionHistory.length === 0) return;

    const lastAction = actionHistory[actionHistory.length - 1];
    
    try {
      setToast({ message: 'Rückgängig wird gemacht...', type: 'info' });

      if (lastAction.type === 'delete') {
        // Undo delete: Recreate items (this is complex - we'd need to restore file contents)
        // For now, just show a message that undo for delete is not fully supported
        setToast({ 
          message: 'Rückgängig für Löschungen wird noch nicht vollständig unterstützt', 
          type: 'info' 
        });
        setActionHistory(prev => prev.slice(0, -1));
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

        setToast({ message: 'Verschoben rückgängig gemacht', type: 'success' });
        setActionHistory(prev => prev.slice(0, -1));
        
        // Navigate to original location if we're currently in the target location
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

        setToast({ message: 'Kopieren rückgängig gemacht', type: 'success' });
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

          setToast({ message: 'Umbenennen rückgängig gemacht', type: 'success' });
          setActionHistory(prev => prev.slice(0, -1));
          loadFiles();
          setTreeRefreshKey((k) => k + 1);
        } catch (error: any) {
          console.error('Fehler beim Rückgängig machen:', error);
          setToast({ message: error.message || 'Fehler beim Rückgängig machen', type: 'error' });
        }
        return;
      }

      // Unknown action type
      setActionHistory(prev => prev.slice(0, -1));
      loadFiles();
    } catch (error: any) {
      console.error('Fehler beim Rückgängig machen:', error);
      setToast({ message: error.message || 'Fehler beim Rückgängig machen', type: 'error' });
    }
  }

  async function handleDownload(file: FileItem) {
    try {
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
      }
    } catch (error) {
      console.error('Fehler beim Download:', error);
      setToast({ message: 'Fehler beim Download', type: 'error' });
    }
  }

  async function handleBulkDownload() {
    if (selectedItems.size === 0) return;

    const selectedFiles = files.filter(f => selectedItems.has(f.path));
    if (selectedFiles.length === 0) return;

    try {
      setToast({ message: 'ZIP-Datei wird erstellt...', type: 'info' });

      const paths = selectedFiles.map(f => f.path);
      const res = await fetch('/api/files/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });

      if (!res.ok) {
        const data = await res.json();
        setToast({ message: data.error || 'Fehler beim Erstellen der ZIP-Datei', type: 'error' });
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

      setToast({ message: `${selectedFiles.length} Element(e) erfolgreich heruntergeladen`, type: 'success' });
    } catch (error) {
      console.error('Fehler beim Bulk-Download:', error);
      setToast({ message: 'Fehler beim Download', type: 'error' });
    }
  }

  function handleDragStart(file: FileItem, e: React.DragEvent) {
    setDraggedItem(file);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.path);
    
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
    if (file.type === 'directory' && draggedItem && draggedItem.path !== file.path) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverItem(file.path);
    }
  }

  function handleDragLeave() {
    setDragOverItem(null);
  }

  async function handleDrop(targetDir: FileItem, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(null);
    
    if (!draggedItem || targetDir.type !== 'directory') {
      setDraggedItem(null);
      return;
    }
    
    // Don't move item into itself
    if (draggedItem.path === targetDir.path) {
      setDraggedItem(null);
      return;
    }
    
    // Don't move directory into its own subdirectory
    if (draggedItem.type === 'directory' && targetDir.path.startsWith(draggedItem.path + '/')) {
      setToast({ message: 'Ein Verzeichnis kann nicht in sich selbst verschoben werden', type: 'error' });
      setDraggedItem(null);
      return;
    }
    
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          path: draggedItem.path,
          targetPath: targetDir.path,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        loadFiles();
        setTreeRefreshKey((k) => k + 1);
        setToast({ message: `"${draggedItem.name}" wurde nach "${targetDir.name}" verschoben`, type: 'success' });
      } else {
        setToast({ message: data.error || 'Fehler beim Verschieben', type: 'error' });
      }
    } catch (error) {
      console.error('Fehler beim Verschieben:', error);
      setToast({ message: 'Fehler beim Verschieben', type: 'error' });
    } finally {
      setDraggedItem(null);
    }
  }

  function handleDragEnd() {
    setDraggedItem(null);
    setDragOverItem(null);
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
    loadFiles();
    setTreeRefreshKey((k) => k + 1);
  }

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const sortedFiles = getSortedFiles();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
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
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">StudyDocs</h1>
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
                title="Einstellungen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Abmelden"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree */}
        <div
          className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col relative"
          style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '600px' }}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Verzeichnisse
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            <FileTree
              key={`tree-${treeRefreshKey}`}
              currentPath={currentPath}
              onNavigate={navigateToPath}
              onRefresh={handleRefresh}
              onExternalDrop={handleExternalFilesDrop}
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
                    loadFiles();
                    setTreeRefreshKey((k) => k + 1);
                    // Find item name for toast message
                    const item = files.find(f => f.path === itemPath);
                    const target = files.find(f => f.path === targetPath);
                    setToast({ 
                      message: `"${item?.name || 'Element'}" wurde nach "${target?.name || 'Root'}" verschoben`, 
                      type: 'success' 
                    });
                  } else {
                    setToast({ message: data.error || 'Fehler beim Verschieben', type: 'error' });
                  }
                } catch (error) {
                  console.error('Fehler beim Verschieben:', error);
                  setToast({ message: 'Fehler beim Verschieben', type: 'error' });
                }
              }}
            />
          </div>
          
          {/* Resize Handle */}
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
        </div>

        {/* Main Content */}
        <div 
          className={`flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900 relative ${
            externalDragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''
          }`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setExternalDragOver(true);
              setExternalDragTarget(currentPath);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setExternalDragOver(false);
              setExternalDragTarget(null);
            }
          }}
          onDrop={(e) => {
            if (e.dataTransfer.files.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              const files = Array.from(e.dataTransfer.files);
              handleExternalFilesDrop(files, currentPath);
              setExternalDragOver(false);
              setExternalDragTarget(null);
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
                    <p className="font-semibold text-gray-900 dark:text-white">Dateien hier ablegen</p>
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

          {/* Toolbar */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="px-4 py-2 flex items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="flex-1 max-w-md">
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
                {(searchQuery || searchFilters.fileType !== 'all' || searchFilters.minSize || searchFilters.maxSize || searchFilters.dateFrom || searchFilters.dateTo) && (
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
              
              {/* Navigation */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={navigateUp}
                  disabled={!currentPath}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Zurück"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={handleRefresh}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Aktualisieren"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 px-2 min-w-0">
                  <span className="font-medium">Pfad:</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <button
                      onClick={() => navigateToPath('')}
                      className="hover:text-blue-600 dark:hover:text-blue-400 truncate"
                    >
                      Root
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
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {selectedItems.size > 0 && (
                  <>
                    <button
                      onClick={handleBulkDownload}
                      className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={`${selectedItems.size} Element(e) herunterladen`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button
                      onClick={openBulkDeleteModal}
                      className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={`${selectedItems.size} Element(e) löschen`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  onClick={handleCreateDirectory}
                  className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Neues Verzeichnis erstellen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </button>
                <FileUpload
                  currentPath={currentPath}
                  onUploaded={handleRefresh}
                />
              </div>
            </div>
          </div>

          {/* File List - Table View */}
          <div className="flex-1 overflow-auto relative" onContextMenu={handleEmptyContextMenu}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Lädt...</p>
              </div>
            ) : sortedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  {searchQuery || searchFilters.fileType !== 'all' || searchFilters.minSize || searchFilters.maxSize || searchFilters.dateFrom || searchFilters.dateTo ? (
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
                    ? isGlobalSearch 
                      ? 'Keine Ergebnisse in allen Ordnern gefunden'
                      : 'Keine Ergebnisse gefunden'
                    : 'Dieses Verzeichnis ist leer'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === sortedFiles.length && sortedFiles.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems(new Set(sortedFiles.map(f => f.path)));
                          } else {
                            setSelectedItems(new Set());
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        <span>Name</span>
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
                        <span>Typ</span>
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
                        <span>Größe</span>
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
                        <span>Geändert</span>
                        {sortField === 'modified' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden 2xl:table-cell">
                      Erstellt von
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-24">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {creatingNewDirectory && (
                    <tr
                      key="NEW_DIRECTORY_TEMP"
                      className="group cursor-pointer transition-colors bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          disabled
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-50"
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
                              placeholder="Verzeichnisname"
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
                  {sortedFiles.map((file) => {
                    const isSelected = selectedItems.has(file.path);
                    return (
                      <tr
                        key={file.path}
                        data-file-path={file.path}
                        onClick={(e) => handleRowClick(file, e)}
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
                          // Handle both internal and external drags
                          if (e.dataTransfer.types.includes('Files') && !draggedItem) {
                            handleExternalDragOver(file, e);
                          } else {
                            handleDragOver(file, e);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (e.dataTransfer.types.includes('Files') && !draggedItem) {
                            handleExternalDragLeave();
                          } else {
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
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            : focusedIndex !== null && sortedFiles.findIndex(f => f.path === file.path) === focusedIndex
                            ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500 dark:ring-blue-400'
                            : dragOverItem === file.path && file.type === 'directory'
                            ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-600'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        } ${draggedItem?.path === file.path ? 'opacity-50' : ''}`}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(file.path)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {file.type === 'directory' ? (
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            )}
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
                          {file.type === 'directory' ? '-' : formatFileSize(file.size)}
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
                            {file.type === 'file' && (
                              <button
                                onClick={() => handleDownload(file)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                title="Herunterladen"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteModal(file);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Löschen"
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

      {/* Replace Modal */}
      <ReplaceModal
        isOpen={replaceModal.isOpen}
        onClose={handleReplaceCancel}
        onConfirm={handleReplaceConfirm}
        fileName={replaceModal.file?.name || ''}
      />

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
