'use client';

import { useState, useEffect } from 'react';
import { generateMathCaptcha } from '@/lib/captcha';

interface MathCaptchaProps {
  onVerify: (isValid: boolean) => void;
  language?: 'de' | 'en';
}

export default function MathCaptcha({ onVerify, language = 'de' }: MathCaptchaProps) {
  const [captcha, setCaptcha] = useState<{ question: string; answer: number } | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const newCaptcha = generateMathCaptcha();
    setCaptcha(newCaptcha);
    setUserAnswer('');
    setError('');
    onVerify(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserAnswer(value);
    setError('');

    if (value && captcha) {
      const userNum = parseInt(value, 10);
      if (!isNaN(userNum) && userNum === captcha.answer) {
        onVerify(true);
        setError('');
      } else if (value.length > 0) {
        onVerify(false);
      }
    } else {
      onVerify(false);
    }
  };

  const handleRefresh = () => {
    const newCaptcha = generateMathCaptcha();
    setCaptcha(newCaptcha);
    setUserAnswer('');
    setError('');
    onVerify(false);
  };

  if (!captcha) return null;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {language === 'de' ? 'Sicherheitsprüfung' : 'Security Check'}
      </label>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-lg font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600">
            {captcha.question} = ?
          </span>
          <input
            type="number"
            value={userAnswer}
            onChange={handleChange}
            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="?"
            required
          />
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={language === 'de' ? 'Neu laden' : 'Refresh'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {language === 'de' 
          ? 'Bitte lösen Sie die Rechenaufgabe, um zu bestätigen, dass Sie kein Roboter sind.'
          : 'Please solve the math problem to confirm you are not a robot.'}
      </p>
    </div>
  );
}

