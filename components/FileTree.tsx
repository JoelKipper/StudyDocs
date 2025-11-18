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
}

interface TreeNodeData extends FileItem {
  children?: TreeNodeData[];
  loaded?: boolean;
}

export default function FileTree({ currentPath, onNavigate, onRefresh }: FileTreeProps) {
  const [tree, setTree] = useState<TreeNodeData[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([''])); // Root expanded by default
  const [loading, setLoading] = useState(true);

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
      setExpanded(new Set(pathsToExpand));
    }
  }, [currentPath]);

  async function loadFullTree() {
    setLoading(true);
    try {
      const rootTree = await loadTreeRecursive('');
      setTree(rootTree);
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
        const dirs = (data.contents || []).filter((item: FileItem) => item.type === 'directory');
        const treeNodes: TreeNodeData[] = await Promise.all(
          dirs.map(async (dir: FileItem) => {
            const children = await loadTreeRecursive(dir.path);
            return {
              ...dir,
              children,
              loaded: true,
            };
          })
        );
        return treeNodes;
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

  return (
    <div className="space-y-1 animate-fade-in">
      <button
        onClick={() => onNavigate('')}
        className={`group w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
          isActive('')
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
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
      {tree.map((item) => (
        <TreeNode
          key={item.path}
          item={item}
          level={0}
          currentPath={currentPath}
          onNavigate={onNavigate}
          isExpanded={isExpanded}
          onToggleExpand={toggleExpand}
        />
      ))}
      {tree.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
          Keine Verzeichnisse
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
}

function TreeNode({
  item,
  level,
  currentPath,
  onNavigate,
  isExpanded,
  onToggleExpand,
}: TreeNodeProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isActive = currentPath === item.path;
  const expanded = isExpanded(item.path);

  return (
    <div className="animate-fade-in">
      <div
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
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
          onClick={() => onNavigate(item.path)}
          className="flex-1 text-left flex items-center gap-2 min-w-0"
        >
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
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
