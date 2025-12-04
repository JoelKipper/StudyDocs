'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export default function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
  disabled = false,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (disabled || !content) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!wrapperRef.current || !tooltipRef.current) return;

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = wrapperRect.left + wrapperRect.width / 2 - tooltipRect.width / 2;
        y = wrapperRect.top - tooltipRect.height - 8;
        // Adjust if tooltip goes off screen
        if (x < 8) x = 8;
        if (x + tooltipRect.width > viewportWidth - 8) {
          x = viewportWidth - tooltipRect.width - 8;
        }
        if (y < scrollY + 8) {
          // Switch to bottom if no space on top
          y = wrapperRect.bottom + 8;
        }
        break;
      case 'bottom':
        x = wrapperRect.left + wrapperRect.width / 2 - tooltipRect.width / 2;
        y = wrapperRect.bottom + 8;
        // Adjust if tooltip goes off screen
        if (x < 8) x = 8;
        if (x + tooltipRect.width > viewportWidth - 8) {
          x = viewportWidth - tooltipRect.width - 8;
        }
        if (y + tooltipRect.height > scrollY + viewportHeight - 8) {
          // Switch to top if no space on bottom
          y = wrapperRect.top - tooltipRect.height - 8;
        }
        break;
      case 'left':
        x = wrapperRect.left - tooltipRect.width - 8;
        y = wrapperRect.top + wrapperRect.height / 2 - tooltipRect.height / 2;
        // Adjust if tooltip goes off screen
        if (x < scrollX + 8) {
          // Switch to right if no space on left
          x = wrapperRect.right + 8;
        }
        if (y < scrollY + 8) y = scrollY + 8;
        if (y + tooltipRect.height > scrollY + viewportHeight - 8) {
          y = scrollY + viewportHeight - tooltipRect.height - 8;
        }
        break;
      case 'right':
        x = wrapperRect.right + 8;
        y = wrapperRect.top + wrapperRect.height / 2 - tooltipRect.height / 2;
        // Adjust if tooltip goes off screen
        if (x + tooltipRect.width > scrollX + viewportWidth - 8) {
          // Switch to left if no space on right
          x = wrapperRect.left - tooltipRect.width - 8;
        }
        if (y < scrollY + 8) y = scrollY + 8;
        if (y + tooltipRect.height > scrollY + viewportHeight - 8) {
          y = scrollY + viewportHeight - tooltipRect.height - 8;
        }
        break;
    }

    setTooltipPosition({ x, y });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      const handleScroll = () => {
        if (isVisible) {
          updatePosition();
        }
      };
      const handleResize = () => {
        if (isVisible) {
          updatePosition();
        }
      };
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isVisible]);

  if (disabled || !content) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`fixed z-[9999] px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg pointer-events-none whitespace-nowrap animate-fade-in ${
            position === 'top' ? 'origin-bottom' : position === 'bottom' ? 'origin-top' : ''
          }`}
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateZ(0)', // Force hardware acceleration
          }}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 ${
              position === 'top'
                ? 'bottom-[-4px] left-1/2 -translate-x-1/2 rotate-45'
                : position === 'bottom'
                ? 'top-[-4px] left-1/2 -translate-x-1/2 rotate-45'
                : position === 'left'
                ? 'right-[-4px] top-1/2 -translate-y-1/2 rotate-45'
                : 'left-[-4px] top-1/2 -translate-y-1/2 rotate-45'
            }`}
          />
        </div>
      )}
    </div>
  );
}

