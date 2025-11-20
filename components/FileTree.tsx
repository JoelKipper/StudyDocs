'use client';

import { useState, useEffect, useRef } from 'react';
import FileIcon from './FileIcon';
import ContextMenu from './ContextMenu';
import { useLanguage } from '@/contexts/LanguageContext';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

interface FileTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onExternalDrop?: (e: React.DragEvent, targetPath: string) => void;
  onMoveItem?: (itemPath: string, targetPath: string) => Promise<void>;
  onFileDoubleClick?: (filePath: string, fileName: string) => void;
  userId: string;
  refreshFolderPath?: string | null;
  setRefreshFolderPath?: (path: string | null) => void;
  // Context menu handlers
  onRename?: (item: FileItem) => void;
  onDelete?: (item: FileItem) => void;
  onDownload?: (item: FileItem) => void;
  onShare?: (item: FileItem) => void;
  onToggleFavorite?: (item: FileItem) => void;
  isFavorite?: (itemPath: string) => boolean;
  onCreateDirectory?: (parentPath: string) => void;
  // Callback when item is deleted - receives the item path
  onItemDeleted?: (itemPath: string) => void;
  // Callback when item is renamed - receives old path, new name, and new path
  onItemRenamed?: (oldPath: string, newName: string, newPath: string) => void;
  // Callback when item is moved - receives old path and new path
  onItemMoved?: (oldPath: string, newPath: string) => void;
}

interface TreeNodeData extends FileItem {
  children?: TreeNodeData[];
  loaded?: boolean;
}

export default function FileTree({ currentPath, onNavigate, onRefresh, onExternalDrop, onMoveItem, onFileDoubleClick, userId, refreshFolderPath, setRefreshFolderPath, onRename, onDelete, onDownload, onShare, onToggleFavorite, isFavorite, onItemDeleted, onItemRenamed, onItemMoved, onCreateDirectory }: FileTreeProps) {
  const { language, t } = useLanguage();
  const storageKey = `studydocs-tree-expanded-${userId}`;
  
  // Load expanded state from localStorage
  const [tree, setTree] = useState<TreeNodeData[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const paths = JSON.parse(saved) as string[];
          const savedSet = new Set<string>(paths);
          // Only load saved paths, don't auto-expand root or current path
          return savedSet;
        } catch (e) {
          // Fallback to empty set
        }
      }
    }
    // Start with empty set - only expand what user manually opens
    return new Set<string>();
  });
  const [loading, setLoading] = useState(true);
  const [treeLoaded, setTreeLoaded] = useState(false); // Track when tree is loaded to trigger animation
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'directory' | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: FileItem | null;
    isEmpty: boolean;
    parentPath?: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
    isEmpty: false,
    parentPath: undefined,
  });
  const [renamingItem, setRenamingItem] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [creatingNewDirectory, setCreatingNewDirectory] = useState<string | null>(null);
  const [newDirectoryName, setNewDirectoryName] = useState('');
  const newDirectoryInputRef = useRef<HTMLInputElement>(null);
  const newDirectoryContainerRef = useRef<HTMLDivElement>(null);

  // Close create directory input when navigating to a different folder
  useEffect(() => {
    if (creatingNewDirectory !== null) {
      setCreatingNewDirectory(null);
      setNewDirectoryName('');
    }
  }, [currentPath]);

  // Close create directory input when clicking anywhere else (like Escape)
  useEffect(() => {
    if (creatingNewDirectory === null) return;

    const closeOnClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't close if clicking inside the input container
      if (
        newDirectoryContainerRef.current &&
        newDirectoryContainerRef.current.contains(target)
      ) {
        return;
      }
      
      // Don't close if clicking on context menu
      if (target.closest('[role="menu"]') || target.closest('.context-menu')) {
        return;
      }
      
      // Close on any click outside (cancel creation, like Escape)
      setCreatingNewDirectory(null);
      setNewDirectoryName('');
    };

    // Use a small delay to ensure the event is processed correctly
    const timeoutId = setTimeout(() => {
      // Listen to mousedown events (fires before click)
      document.addEventListener('mousedown', closeOnClickOutside, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', closeOnClickOutside, true);
    };
  }, [creatingNewDirectory]);

  // Wrapper for onNavigate that also closes create directory input
  const handleNavigate = (path: string) => {
    if (creatingNewDirectory !== null) {
      setCreatingNewDirectory(null);
      setNewDirectoryName('');
    }
    onNavigate(path);
  };

  // Save expanded state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && expanded.size > 0) {
      const paths = Array.from(expanded);
      localStorage.setItem(storageKey, JSON.stringify(paths));
    } else if (typeof window !== 'undefined' && expanded.size === 0) {
      // Clear localStorage if nothing is expanded
      localStorage.removeItem(storageKey);
    }
  }, [expanded, storageKey]);

  useEffect(() => {
    loadFullTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh specific folder when refreshFolderPath changes
  useEffect(() => {
    // Allow empty string for root folder, but not null or undefined
    if (refreshFolderPath !== null && refreshFolderPath !== undefined) {
      refreshFolderInTree(refreshFolderPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshFolderPath]);

  // Store onItemDeleted callback in a ref so we can call removeItemFromTree when needed
  const onItemDeletedRef = useRef(onItemDeleted);
  useEffect(() => {
    onItemDeletedRef.current = onItemDeleted;
  }, [onItemDeleted]);

  // Don't auto-expand paths - only expand what user manually opens
  // The currentPath will be expanded when user navigates to it via onClick

  // Cache helper functions for FileTree
  const getTreeCacheKey = (path: string) => `studydocs-tree-${userId}-${path || 'root'}`;
  const TREE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedTreeData = (path: string): TreeNodeData[] | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cacheKey = getTreeCacheKey(path);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      // Return cached data if still valid
      if (age < TREE_CACHE_DURATION) {
        return data;
      }
      
      // Remove expired cache
      localStorage.removeItem(cacheKey);
      return null;
    } catch (error) {
      return null;
    }
  };

  const setCachedTreeData = (path: string, data: TreeNodeData[]) => {
    if (typeof window === 'undefined') return;
    try {
      const cacheKey = getTreeCacheKey(path);
      const cacheData = {
        data: data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      // Ignore localStorage errors
    }
  };

  async function loadFullTree() {
    setLoading(true);
    setTreeLoaded(false); // Reset animation trigger
    
    try {
      // Load root tree - use cache for performance, but it will be refreshed in background
      const rootTree = await loadTreeRecursive('', false);
      setTree(rootTree);
      
      // Trigger animation immediately after state update using requestAnimationFrame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTreeLoaded(true);
        });
      });
      
      // In background, refresh root to ensure we have latest data (but don't block UI)
      // This ensures new folders/files are visible after page reload without slowing down initial load
      setTimeout(async () => {
        try {
          const freshRootTree = await loadTreeRecursive('', true); // Skip cache for fresh data
          setTree(freshRootTree);
        } catch (error) {
          // Ignore errors in background refresh
        }
      }, 500); // Small delay to not interfere with initial render
    } catch (error) {
      // Error loading tree
    } finally {
      setLoading(false);
    }
  }

  async function loadTreeRecursive(path: string, skipCache: boolean = false): Promise<TreeNodeData[]> {
    // Try to load from cache first (unless skipCache is true)
    if (!skipCache) {
      const cachedData = getCachedTreeData(path);
      if (cachedData) {
        return cachedData;
      }
    }
    
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.ok) {
        const allItems = data.contents || [];
        const dirs = allItems.filter((item: FileItem) => item.type === 'directory');
        const files = allItems.filter((item: FileItem) => item.type === 'file');
        
        // Load children for directories recursively
        const dirNodes: TreeNodeData[] = await Promise.all(
          dirs.map(async (dir: FileItem) => {
            const children = await loadTreeRecursive(dir.path, skipCache);
            return {
              ...dir,
              children,
              loaded: true,
            };
          })
        );
        
        // Add files as leaf nodes (no children)
        const fileNodes: TreeNodeData[] = files.map((file: FileItem) => ({
          ...file,
          children: [],
          loaded: true,
        }));
        
        // Combine directories and files, directories first
        const result = [...dirNodes, ...fileNodes];
        
        // Cache the result
        setCachedTreeData(path, result);
        
        return result;
      }
    } catch (error) {
      // Error loading directory
    }
    return [];
  }

  async function refreshFolderInTree(folderPath: string) {
    // Invalidate cache for this folder and all its children recursively
    const invalidateCacheRecursive = (path: string) => {
      if (typeof window === 'undefined') return;
      try {
        const cacheKey = getTreeCacheKey(path);
        localStorage.removeItem(cacheKey);
        
        // Also invalidate cache for all child paths (we need to find them in the tree)
        // For now, just invalidate the current path - children will be reloaded when accessed
      } catch (error) {
        // Ignore errors
      }
    };
    
    invalidateCacheRecursive(folderPath);
    
    // Force reload by bypassing cache - load fresh data
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(folderPath)}`);
      const data = await res.json();
      if (res.ok) {
        const allItems = data.contents || [];
        const dirs = allItems.filter((item: FileItem) => item.type === 'directory');
        const files = allItems.filter((item: FileItem) => item.type === 'file');
        
        // Load children for directories recursively (but don't cache yet)
        const dirNodes: TreeNodeData[] = await Promise.all(
          dirs.map(async (dir: FileItem) => {
            // For refresh, we only load direct children, not recursively
            // This keeps the refresh fast
            return {
              ...dir,
              children: [], // Children will be loaded when expanded
              loaded: false,
              hasSubdirectories: true,
            };
          })
        );
        
        // Add files as leaf nodes
        const fileNodes: TreeNodeData[] = files.map((file: FileItem) => ({
          ...file,
          children: [],
          loaded: true,
        }));
        
        // Combine directories and files
        const refreshedContents = [...dirNodes, ...fileNodes];
        
        // Update cache with fresh data
        setCachedTreeData(folderPath, refreshedContents);
        
        // Update the tree by finding and updating the specific folder node
        setTree((currentTree) => {
          const updateNode = (nodes: TreeNodeData[]): TreeNodeData[] => {
            return nodes.map((node) => {
              if (node.path === folderPath && node.type === 'directory') {
                // This is the folder we want to refresh - update its children
                return {
                  ...node,
                  children: refreshedContents,
                  loaded: true,
                };
              } else if (node.children && node.children.length > 0) {
                // Recursively check children
                return {
                  ...node,
                  children: updateNode(node.children),
                };
              }
              return node;
            });
          };
          
          return updateNode(currentTree);
        });
        return;
      }
    } catch (error) {
      // Error loading folder - fallback to using loadTreeRecursive
    }
    
    // Fallback: use loadTreeRecursive (which will use cache if available)
    const refreshedContents = await loadTreeRecursive(folderPath);
    
    // Update the tree
    setTree((currentTree) => {
      const updateNode = (nodes: TreeNodeData[]): TreeNodeData[] => {
        return nodes.map((node) => {
          if (node.path === folderPath && node.type === 'directory') {
            return {
              ...node,
              children: refreshedContents,
              loaded: true,
            };
          } else if (node.children && node.children.length > 0) {
            return {
              ...node,
              children: updateNode(node.children),
            };
          }
          return node;
        });
      };
      
      return updateNode(currentTree);
    });
  }

  function removeItemFromTree(itemPath: string) {
    // Remove the item from the tree by finding and removing it from its parent's children
    setTree((currentTree) => {
      const removeNode = (nodes: TreeNodeData[]): TreeNodeData[] => {
        return nodes
          .filter((node) => node.path !== itemPath) // Remove the item itself
          .map((node) => {
            // Recursively check children
            if (node.children && node.children.length > 0) {
              return {
                ...node,
                children: removeNode(node.children),
              };
            }
            return node;
          });
      };
      
      return removeNode(currentTree);
    });
  }

  async function confirmCreateDirectory() {
    if (!newDirectoryName.trim() || !creatingNewDirectory) {
      setCreatingNewDirectory(null);
      setNewDirectoryName('');
      return;
    }

    const directoryName = newDirectoryName.trim();
    const parentPath = creatingNewDirectory;

    // Clear the input immediately
    setCreatingNewDirectory(null);
    setNewDirectoryName('');

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-directory',
          path: parentPath,
          name: directoryName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return;
      }
      
      // Refresh the parent folder in tree
      if (setRefreshFolderPath) {
        setRefreshFolderPath(parentPath);
        setTimeout(() => setRefreshFolderPath(null), 100);
      }
      
      // Also refresh the full tree to show the new directory
      loadFullTree();
    } catch (err) {
      // Error creating directory
    }
  }

  function cancelCreateDirectory() {
    setCreatingNewDirectory(null);
    setNewDirectoryName('');
  }

  function handleCreateDirectoryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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

  function renameItemInTree(oldPath: string, newName: string) {
    // Calculate the new path
    const parentPath = oldPath.split('/').slice(0, -1).join('/');
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;
    
    // Update the tree by finding and renaming the item
    setTree((currentTree) => {
      const renameNode = (nodes: TreeNodeData[]): TreeNodeData[] => {
        return nodes.map((node) => {
          if (node.path === oldPath) {
            // This is the item we want to rename
            const renamedNode: TreeNodeData = {
              ...node,
              name: newName,
              path: newPath,
            };
            
            // If it's a directory, we also need to update all children paths
            if (node.type === 'directory' && node.children) {
              const updateChildrenPaths = (children: TreeNodeData[]): TreeNodeData[] => {
                return children.map((child) => {
                  const oldChildPath = child.path;
                  const relativePath = oldChildPath.replace(oldPath + '/', '');
                  const newChildPath = newPath ? `${newPath}/${relativePath}` : relativePath;
                  
                  return {
                    ...child,
                    path: newChildPath,
                    children: child.children ? updateChildrenPaths(child.children) : undefined,
                  };
                });
              };
              
              renamedNode.children = updateChildrenPaths(node.children);
            }
            
            return renamedNode;
          } else if (node.children && node.children.length > 0) {
            // Recursively check children
            return {
              ...node,
              children: renameNode(node.children),
            };
          }
          return node;
        });
      };
      
      return renameNode(currentTree);
    });
  }

  function toggleExpand(path: string) {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpanded(newExpanded);
  }

  function isExpanded(path: string): boolean {
    return expanded.has(path);
  }

  function isActive(path: string): boolean {
    return currentPath === path;
  }

  function handleRename(item: FileItem) {
    setRenamingItem(item);
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
        // Update only the renamed item in the tree, not the entire tree
        renameItemInTree(renamingItem.path, newName);
        // Also refresh the parent folder to update its contents
        const parentPath = renamingItem.path.split('/').slice(0, -1).join('/');
        // Refresh parent folder (even if it's root, which is empty string)
        if (setRefreshFolderPath) {
          setRefreshFolderPath(parentPath || '');
          setTimeout(() => setRefreshFolderPath(null), 100);
        }
        
        // Calculate new path for the renamed item
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        
        // Call onItemRenamed callback to update the file list
        const normalizedParentPath = parentPath || '';
        const normalizedCurrentPath = currentPath || '';
        
        // If the renamed item is in the current directory, refresh the file list
        if (normalizedParentPath === normalizedCurrentPath && onRefresh) {
          // Use a small delay to ensure the API has processed the rename
          setTimeout(() => {
            onRefresh();
          }, 100);
        }
        
        setRenamingItem(null);
        setRenameValue('');
      } else {
        setRenamingItem(null);
        setRenameValue('');
      }
    } catch (error) {
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
      e.preventDefault();
      e.stopPropagation();
      confirmRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelRename();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  function handleRootDragOver(e: React.DragEvent) {
    // Handle external file drops
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      if (dragOverPath !== '') {
        setDragOverPath('');
      }
      return;
    }
    
    // Check if drag is from table (external to tree)
    const dragSource = e.dataTransfer.getData('application/x-drag-source');
    const draggedPath = draggedItem || e.dataTransfer.getData('application/x-item-path');
    
    // Handle internal item moves or items dragged from table
    if (draggedPath && draggedPath !== '') {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverPath !== '') {
        setDragOverPath('');
      }
    }
  }

  function handleRootDragLeave() {
    setDragOverPath(null);
  }

  async function handleRootDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    
    // Handle external file drops
    if (e.dataTransfer.files.length > 0 && onExternalDrop) {
      onExternalDrop(e, '');
      return;
    }
    
    // Check if drag is from table (external to tree)
    const dragSource = e.dataTransfer.getData('application/x-drag-source');
    const draggedPath = draggedItem || e.dataTransfer.getData('application/x-item-path');
    
    // Handle internal item moves or items dragged from table
    if (draggedPath && onMoveItem) {
      // Don't move root into root (shouldn't happen, but just in case)
      if (draggedPath === '') {
        setDraggedItem(null);
        return;
      }
      
      try {
        await onMoveItem(draggedPath, '');
        // Remove item from tree after successful move
        removeItemFromTree(draggedPath);
        // Notify parent component about the move
        if (onItemMoved) {
          const itemName = draggedPath.split('/').pop() || '';
          onItemMoved(draggedPath, itemName);
        }
      } catch (error) {
        // Error moving item
      } finally {
        setDraggedItem(null);
      }
    }
  }

  function handleRootDragEnd() {
    setDraggedItem(null);
    setDraggedItemType(null);
    setDragOverPath(null);
  }

  return (
    <div 
      className="space-y-1 animate-fade-in"
      onContextMenu={(e) => {
        // Check if right-click is on empty space (not on a button or item)
        const target = e.target as HTMLElement;
        if (!target.closest('button') && !target.closest('.tree-item')) {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            item: null,
            isEmpty: true,
            parentPath: '', // Root folder
          });
        }
      }}
    >
      <button
        onClick={() => handleNavigate('')}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        onDragEnd={handleRootDragEnd}
        className={`group w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 tree-item ${
          isActive('')
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
            : dragOverPath === ''
            ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400 border-dashed text-gray-700 dark:text-gray-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:translate-x-1'
        }`}
      >
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${isActive('') ? 'text-white' : 'text-blue-500 group-hover:scale-110'}`}
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
        <span>Root</span>
      </button>
      {tree.map((item, index) => (
        <div
          key={item.path}
          className={treeLoaded ? 'animate-slide-down-stagger' : 'opacity-0'}
          style={{
            animationDelay: treeLoaded ? `${index * 50}ms` : '0ms',
          }}
        >
          <TreeNode
            item={item}
            level={0}
            currentPath={currentPath}
            onNavigate={handleNavigate}
            isExpanded={isExpanded}
            onToggleExpand={toggleExpand}
            onExternalDrop={onExternalDrop}
            onMoveItem={onMoveItem}
            onFileDoubleClick={onFileDoubleClick}
            draggedItem={draggedItem}
            draggedItemType={draggedItemType}
            dragOverPath={dragOverPath}
            setDraggedItem={setDraggedItem}
            setDraggedItemType={setDraggedItemType}
            setDragOverPath={setDragOverPath}
            onContextMenu={(item, e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                item: item,
                isEmpty: false,
                parentPath: undefined,
              });
            }}
            renamingItem={renamingItem}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            renameInputRef={renameInputRef}
            onRenameKeyDown={handleRenameKeyDown}
            onConfirmRename={confirmRename}
            onCancelRename={cancelRename}
            onItemMoved={onItemMoved}
            removeItemFromTree={removeItemFromTree}
          />
        </div>
      ))}
      {tree.length === 0 && !creatingNewDirectory && (
        <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
          Leer
        </div>
      )}

      {/* New Directory Input */}
      {creatingNewDirectory !== null && (
        <div ref={newDirectoryContainerRef} className="px-3 py-2 animate-fade-in">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <input
              ref={newDirectoryInputRef}
              type="text"
              value={newDirectoryName}
              onChange={(e) => setNewDirectoryName(e.target.value)}
              onKeyDown={handleCreateDirectoryKeyDown}
              onBlur={() => {
                // onBlur is handled by the mousedown listener
                // We don't need to do anything here to avoid conflicts
              }}
              placeholder={t('folderName')}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, item: null, isEmpty: false, parentPath: undefined })}
          onOpen={contextMenu.item && contextMenu.item.type === 'directory' ? () => handleNavigate(contextMenu.item!.path) : undefined}
          onDownload={contextMenu.item && contextMenu.item.type === 'file' && onDownload ? () => onDownload(contextMenu.item!) : undefined}
          onDelete={contextMenu.item && onDelete ? () => {
            const item = contextMenu.item!;
            onDelete(item);
            // After delete is confirmed, remove from tree
            // The actual deletion will be handled by FileManager's confirmDelete
            // We'll use onItemDeleted callback to remove from tree
          } : undefined}
          onRename={contextMenu.item ? () => handleRename(contextMenu.item!) : undefined}
          onShare={contextMenu.item && onShare ? () => onShare(contextMenu.item!) : undefined}
          onToggleFavorite={contextMenu.item && onToggleFavorite ? () => onToggleFavorite(contextMenu.item!) : undefined}
          isFavorite={contextMenu.item && isFavorite ? isFavorite(contextMenu.item.path) : false}
          onCreateDirectory={onCreateDirectory ? () => {
            // If clicking on a directory, create in that directory; otherwise use parentPath (empty = root)
            const targetPath = contextMenu.item && contextMenu.item.type === 'directory' 
              ? contextMenu.item.path 
              : (contextMenu.parentPath || '');
            // Set creating state and focus input
            setCreatingNewDirectory(targetPath);
            setNewDirectoryName('');
            // Focus input after state update
            setTimeout(() => {
              newDirectoryInputRef.current?.focus();
            }, 0);
          } : undefined}
          itemType={contextMenu.isEmpty ? 'empty' : (contextMenu.item?.type || 'file')}
        />
      )}
    </div>
  );
}

interface TreeNodeProps {
  item: TreeNodeData;
  level: number;
  currentPath: string;
  onNavigate: (path: string) => void;
  isExpanded: (path: string) => boolean;
  onToggleExpand: (path: string) => void;
  onExternalDrop?: (e: React.DragEvent, targetPath: string) => void;
  onMoveItem?: (itemPath: string, targetPath: string) => Promise<void>;
  onFileDoubleClick?: (filePath: string, fileName: string) => void;
  draggedItem: string | null;
  draggedItemType: 'file' | 'directory' | null;
  dragOverPath: string | null;
  setDraggedItem: (path: string | null) => void;
  setDraggedItemType: (type: 'file' | 'directory' | null) => void;
  setDragOverPath: (path: string | null) => void;
  onContextMenu: (item: FileItem, e: React.MouseEvent) => void;
  renamingItem: FileItem | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement>;
  onRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onItemMoved?: (oldPath: string, newPath: string) => void;
  removeItemFromTree: (itemPath: string) => void;
}

function TreeNode({
  item,
  level,
  currentPath,
  onNavigate,
  isExpanded,
  onToggleExpand,
  onExternalDrop,
  onMoveItem,
  onFileDoubleClick,
  draggedItem,
  draggedItemType,
  dragOverPath,
  setDraggedItem,
  setDraggedItemType,
  setDragOverPath,
  onContextMenu,
  renamingItem,
  renameValue,
  setRenameValue,
  renameInputRef,
  onRenameKeyDown,
  onConfirmRename,
  onCancelRename,
  onItemMoved,
  removeItemFromTree,
}: TreeNodeProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isActive = currentPath === item.path;
  const expanded = isExpanded(item.path);
  const isDragged = draggedItem === item.path;
  const isDragOver = dragOverPath === item.path;

  async function handleDragStart(e: React.DragEvent) {
    // Allow dragging both files and directories
    setDraggedItem(item.path);
    setDraggedItemType(item.type);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.path);
    e.dataTransfer.setData('application/x-item-type', item.type);
    e.dataTransfer.setData('application/x-item-path', item.path);
    e.dataTransfer.setData('application/x-item-name', item.name);
    // Mark that this is from the tree, not from the table
    e.dataTransfer.setData('application/x-drag-source', 'tree');
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.innerHTML = item.name;
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

  function handleDragOver(e: React.DragEvent) {
    // Only allow dropping on directories
    if (item.type !== 'directory') return;
    
    // Handle external file drops
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      if (dragOverPath !== item.path) {
        setDragOverPath(item.path);
      }
      return;
    }
    
    // Check if drag is from table (external to tree)
    const dragSource = e.dataTransfer.getData('application/x-drag-source');
    const draggedPath = draggedItem || e.dataTransfer.getData('application/x-item-path');
    const draggedType = draggedItemType || (e.dataTransfer.getData('application/x-item-type') as 'file' | 'directory' | null);
    
    // Handle internal item moves (both files and directories) or items dragged from table
    if (draggedPath && draggedPath !== item.path && draggedType) {
      // For directories: check if target is a subdirectory
      if (draggedType === 'directory') {
        const draggedParent = draggedPath.split('/').slice(0, -1).join('/');
        const isParent = draggedParent === item.path;
        const isSubdirectory = item.path.startsWith(draggedPath + '/');
        
        // Allow if it's the parent directory or if it's not a subdirectory
        if (isParent || (!isSubdirectory && draggedPath !== item.path)) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverPath !== item.path) {
            setDragOverPath(item.path);
          }
        }
      } else {
        // For files: allow dropping on any directory
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverPath !== item.path) {
          setDragOverPath(item.path);
        }
      }
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear drag over if we're actually leaving the element
    // This prevents flickering when moving between child elements
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // Check if mouse is still within the element bounds
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverPath(null);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    
    // Handle external file drops
    if (item.type === 'directory' && e.dataTransfer.files.length > 0 && onExternalDrop) {
      onExternalDrop(e, item.path);
      return;
    }
    
    // Check if drag is from table (external to tree)
    const dragSource = e.dataTransfer.getData('application/x-drag-source');
    const draggedPath = draggedItem || e.dataTransfer.getData('application/x-item-path');
    const draggedType = draggedItemType || (e.dataTransfer.getData('application/x-item-type') as 'file' | 'directory' | null);
    
    // Handle internal item moves (both files and directories) or items dragged from table
    if (item.type === 'directory' && draggedPath && draggedType && onMoveItem) {
      // Don't move item into itself
      if (draggedPath === item.path) {
        setDraggedItem(null);
        setDraggedItemType(null);
        return;
      }
      
      if (draggedType === 'directory') {
        // For directories: Don't move directory into its own subdirectory
        // But allow moving to parent (one level up)
        const draggedParent = draggedPath.split('/').slice(0, -1).join('/');
        const isParent = draggedParent === item.path;
        const isSubdirectory = item.path.startsWith(draggedPath + '/');
        
        if (isSubdirectory && !isParent) {
          setDraggedItem(null);
          setDraggedItemType(null);
          return;
        }
      }
      // For files: no additional validation needed, can be moved to any directory
      
      try {
        await onMoveItem(draggedPath, item.path);
        // Remove item from tree after successful move
        removeItemFromTree(draggedPath);
        // Notify parent component about the move
        if (onItemMoved) {
          const itemName = draggedPath.split('/').pop() || '';
          const newPath = item.path ? `${item.path}/${itemName}` : itemName;
          onItemMoved(draggedPath, newPath);
        }
      } catch (error) {
        // Error moving item
      } finally {
        setDraggedItem(null);
        setDraggedItemType(null);
      }
    }
  }

  function handleDragEnd() {
    setDraggedItem(null);
    setDraggedItemType(null);
    setDragOverPath(null);
  }

  return (
    <div className="animate-fade-in">
      <div
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
            : isDragOver
            ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400 border-dashed text-gray-700 dark:text-gray-300'
            : isDragged
            ? 'opacity-50 text-gray-700 dark:text-gray-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        draggable={true}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(item.path);
          }}
          className={`w-5 h-5 flex items-center justify-center transition-transform duration-200 ${
            hasChildren ? 'hover:scale-110 cursor-pointer' : 'opacity-0 cursor-default'
          } ${isActive ? 'text-white' : 'text-gray-400'}`}
        >
          {hasChildren && (
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
        <button
          onClick={() => {
            if (item.type === 'directory') {
              // Only navigate, don't auto-expand
              onNavigate(item.path);
            } else {
              // For files, navigate to parent directory
              const parentPath = item.path.split('/').slice(0, -1).join('/');
              onNavigate(parentPath);
            }
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (item.type === 'file' && onFileDoubleClick) {
              onFileDoubleClick(item.path, item.name);
            }
          }}
          onContextMenu={(e) => {
            onContextMenu(item, e);
          }}
          className="flex-1 text-left flex items-center gap-2 min-w-0"
        >
          {renamingItem?.path === item.path ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={onRenameKeyDown}
              onBlur={() => {
                // Auto-confirm on blur if changed, cancel if empty or unchanged
                if (renameValue.trim() && renameValue.trim() !== item.name) {
                  // Use setTimeout to allow the blur event to complete before confirming
                  setTimeout(() => {
                    onConfirmRename();
                  }, 0);
                } else {
                  // Cancel
                  onCancelRename();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
              style={{ minWidth: '100px' }}
            />
          ) : (
            <>
              {item.type === 'directory' ? (
                <svg
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                    isActive ? 'text-white' : 'text-blue-500 group-hover:scale-110'
                  }`}
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
                  fileName={item.name}
                  isDirectory={false}
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:scale-110'
                  }`}
                />
              )}
              <span className="truncate">{item.name}</span>
            </>
          )}
        </button>
      </div>
      {expanded && hasChildren && (
        <div>
          {item.children!.map((child, index) => (
            <div
              key={child.path}
              className="animate-slide-down-stagger"
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <TreeNode
                item={child}
                level={level + 1}
                currentPath={currentPath}
                onNavigate={onNavigate}
                isExpanded={isExpanded}
                onToggleExpand={onToggleExpand}
                onExternalDrop={onExternalDrop}
                onMoveItem={onMoveItem}
                onFileDoubleClick={onFileDoubleClick}
                draggedItem={draggedItem}
                draggedItemType={draggedItemType}
                dragOverPath={dragOverPath}
                setDraggedItem={setDraggedItem}
                setDraggedItemType={setDraggedItemType}
                setDragOverPath={setDragOverPath}
                onContextMenu={onContextMenu}
                renamingItem={renamingItem}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                renameInputRef={renameInputRef}
                onRenameKeyDown={onRenameKeyDown}
                onConfirmRename={onConfirmRename}
                onCancelRename={onCancelRename}
                onItemMoved={onItemMoved}
                removeItemFromTree={removeItemFromTree}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
