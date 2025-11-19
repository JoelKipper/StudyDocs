'use client';

import { useEffect, useState, useRef } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
  id: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 2000, id }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const onCloseRef = useRef(onClose);
  const hasStartedClosing = useRef(false);

  // Keep onClose ref up to date
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    // Prevent multiple timers from running
    if (hasStartedClosing.current) return;
    
    hasStartedClosing.current = true;
    
    // Start closing animation after duration
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    // Actually remove from DOM after animation completes
    const removeTimer = setTimeout(() => {
      onCloseRef.current();
    }, duration + 300); // duration + animation time

    return () => {
      clearTimeout(closeTimer);
      clearTimeout(removeTimer);
    };
  }, [duration, id]); // Include id to ensure timer runs for each new toast

  const handleClose = () => {
    if (hasStartedClosing.current) return;
    hasStartedClosing.current = true;
    
    setIsVisible(false);
    setTimeout(() => {
      onCloseRef.current();
    }, 300);
  };

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }[type];

  return (
    <div 
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out ${
        !isVisible
          ? 'opacity-0 translate-y-2 pointer-events-none' 
          : 'opacity-100 translate-y-0'
      }`}
    >
      <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[250px]`}>
        <span className="flex-1 text-sm font-medium">{message}</span>
        <button
          onClick={handleClose}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
