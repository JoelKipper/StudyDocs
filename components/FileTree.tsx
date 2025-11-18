'use client';

import { useState, useEffect } from 'react';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

interface FileTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onExternalDrop?: (files: File[], targetPath: string) => void;
  onMoveItem?: (itemPath: string, targetPath: string) => Promise<void>;
  userId: string;
}

interface TreeNodeData extends FileItem {
  children?: TreeNodeData[];
  loaded?: boolean;
}

export default function FileTree({ currentPath, onNavigate, onRefresh, onExternalDrop, onMoveItem, userId }: FileTreeProps) {
  const storageKey = `studydocs-tree-expanded-${userId}`;
  
  // Load expanded state from localStorage
  const [tree, setTree] = useState<TreeNodeData[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const paths = JSON.parse(saved);
          return new Set(paths);
        } catch (e) {
          // Fallback to default
        }
      }
    }
    // Always include root and current path
    const defaultExpanded = new Set(['']);
    if (currentPath) {
      const parts = currentPath.split('/').filter(Boolean);
      let current = '';
      parts.forEach((part) => {
        current = current ? `${current}/${part}` : part;
        defaultExpanded.add(current);
      });
    }
    return defaultExpanded;
  });
  const [loading, setLoading] = useState(true);
  const [treeLoaded, setTreeLoaded] = useState(false); // Track when tree is loaded to trigger animation
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'directory' | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  // Save expanded state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const paths = Array.from(expanded);
      localStorage.setItem(storageKey, JSON.stringify(paths));
    }
  }, [expanded, storageKey]);

  useEffect(() => {
    loadFullTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Auto-expand path to current directory
    if (currentPath) {
      const parts = currentPath.split('/').filter(Boolean);
      const pathsToExpand = [''];
      let current = '';
      parts.forEach((part) => {
        current = current ? `${current}/${part}` : part;
        pathsToExpand.push(current);
      });
      // Merge with existing expanded paths
      setExpanded(prev => {
        const newExpanded = new Set(prev);
        pathsToExpand.forEach(path => newExpanded.add(path));
        return newExpanded;
      });
    }
  }, [currentPath]);

  async function loadFullTree() {
    setLoading(true);
    setTreeLoaded(false); // Reset animation trigger
    try {
      const rootTree = await loadTreeRecursive('');
      setTree(rootTree);
      // Trigger animation immediately after state update using requestAnimationFrame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTreeLoaded(true);
        });
      });
    } catch (error) {
      console.error('Fehler beim Laden des Baums:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTreeRecursive(path: string): Promise<TreeNodeData[]> {
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
            const children = await loadTreeRecursive(dir.path);
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
        return [...dirNodes, ...fileNodes];
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
    return [];
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
    
    // Handle internal item moves
    if (draggedItem && draggedItem !== '') {
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
      const files = Array.from(e.dataTransfer.files);
      onExternalDrop(files, '');
      return;
    }
    
    // Handle internal item moves
    if (draggedItem && onMoveItem) {
      // Don't move root into root (shouldn't happen, but just in case)
      if (draggedItem === '') {
        setDraggedItem(null);
        return;
      }
      
      try {
        await onMoveItem(draggedItem, '');
      } catch (error) {
        console.error('Fehler beim Verschieben:', error);
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
    <div className="space-y-1 animate-fade-in">
      <button
        onClick={() => onNavigate('')}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        onDragEnd={handleRootDragEnd}
        className={`group w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
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
            onNavigate={onNavigate}
            isExpanded={isExpanded}
            onToggleExpand={toggleExpand}
            onExternalDrop={onExternalDrop}
            onMoveItem={onMoveItem}
            draggedItem={draggedItem}
            draggedItemType={draggedItemType}
            dragOverPath={dragOverPath}
            setDraggedItem={setDraggedItem}
            setDraggedItemType={setDraggedItemType}
            setDragOverPath={setDragOverPath}
          />
        </div>
      ))}
      {tree.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
          Leer
        </div>
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
  onExternalDrop?: (files: File[], targetPath: string) => void;
  onMoveItem?: (itemPath: string, targetPath: string) => Promise<void>;
  draggedItem: string | null;
  draggedItemType: 'file' | 'directory' | null;
  dragOverPath: string | null;
  setDraggedItem: (path: string | null) => void;
  setDraggedItemType: (type: 'file' | 'directory' | null) => void;
  setDragOverPath: (path: string | null) => void;
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
  draggedItem,
  draggedItemType,
  dragOverPath,
  setDraggedItem,
  setDraggedItemType,
  setDragOverPath,
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
    
    // Handle internal item moves (both files and directories)
    if (draggedItem && draggedItem !== item.path && draggedItemType) {
      // For directories: check if target is a subdirectory
      if (draggedItemType === 'directory') {
        const draggedParent = draggedItem.split('/').slice(0, -1).join('/');
        const isParent = draggedParent === item.path;
        const isSubdirectory = item.path.startsWith(draggedItem + '/');
        
        // Allow if it's the parent directory or if it's not a subdirectory
        if (isParent || (!isSubdirectory && draggedItem !== item.path)) {
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
      const files = Array.from(e.dataTransfer.files);
      onExternalDrop(files, item.path);
      return;
    }
    
    // Handle internal item moves (both files and directories)
    if (item.type === 'directory' && draggedItem && draggedItemType && onMoveItem) {
      // Don't move item into itself
      if (draggedItem === item.path) {
        setDraggedItem(null);
        setDraggedItemType(null);
        return;
      }
      
      if (draggedItemType === 'directory') {
        // For directories: Don't move directory into its own subdirectory
        // But allow moving to parent (one level up)
        const draggedParent = draggedItem.split('/').slice(0, -1).join('/');
        const isParent = draggedParent === item.path;
        const isSubdirectory = item.path.startsWith(draggedItem + '/');
        
        if (isSubdirectory && !isParent) {
          setDraggedItem(null);
          setDraggedItemType(null);
          return;
        }
      }
      // For files: no additional validation needed, can be moved to any directory
      
      try {
        await onMoveItem(draggedItem, item.path);
      } catch (error) {
        console.error('Fehler beim Verschieben:', error);
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
              onNavigate(item.path);
            } else {
              // For files, navigate to parent directory
              const parentPath = item.path.split('/').slice(0, -1).join('/');
              onNavigate(parentPath);
            }
          }}
          className="flex-1 text-left flex items-center gap-2 min-w-0"
        >
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
            <svg
              className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                isActive ? 'text-white' : 'text-gray-400 group-hover:scale-110'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
          <span className="truncate">{item.name}</span>
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
                draggedItem={draggedItem}
                draggedItemType={draggedItemType}
                dragOverPath={dragOverPath}
                setDraggedItem={setDraggedItem}
                setDraggedItemType={setDraggedItemType}
                setDragOverPath={setDragOverPath}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
