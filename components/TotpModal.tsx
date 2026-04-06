'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function TotpModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  title?: string;
  subtitle?: string;
  error?: string;
  loading?: boolean;
}) {
  const { isOpen, onClose, onVerify, title, subtitle, error, loading } = props;
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  /** Verhindert wiederholtes Absenden desselben 6-stelligen Codes nach Fehler (kein Loop). */
  const lastSubmittedCodeRef = useRef<string | null>(null);

  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    if (!isOpen) return;
    setDigits(['', '', '', '', '', '']);
    lastSubmittedCodeRef.current = null;
    setTimeout(() => inputsRef.current[0]?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (code.length < 6 || !/^\d{6}$/.test(code)) {
      lastSubmittedCodeRef.current = null;
      return;
    }
    if (loading) return;
    if (lastSubmittedCodeRef.current === code) return;

    lastSubmittedCodeRef.current = code;
    void onVerify(code);
  }, [code, isOpen, loading, onVerify]);

  function setAt(index: number, value: string) {
    const v = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = v;
      return next;
    });
    if (v && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const arr = text.split('');
    setDigits((prev) => prev.map((_, i) => arr[i] || ''));
    const nextIndex = Math.min(text.length, 6) - 1;
    inputsRef.current[Math.max(0, nextIndex)]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputsRef.current[index + 1]?.focus();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-2xl border border-gray-200/60 dark:border-gray-700/60 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title || 'Bestätigen'}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {subtitle || 'Bitte gib den 6‑stelligen Code aus Microsoft Authenticator ein.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
            disabled={!!loading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className="w-12 h-14 text-center text-2xl font-semibold rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              disabled={!!loading}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        <div className="mt-4 min-h-[20px] text-center">
          {loading ? (
            <div className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-200" />
              <span>Prüfe…</span>
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tippe oder füge den Code ein – Prüfung erfolgt automatisch.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

