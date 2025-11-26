/**
 * Captcha utilities
 * Supports both reCAPTCHA v3 and simple math captcha
 */

// Simple Math Captcha (DSGVO-friendly, no external services)
export function generateMathCaptcha(): { question: string; answer: number } {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operations = ['+', '-', '*'] as const;
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let answer: number;
  let question: string;
  
  switch (operation) {
    case '+':
      answer = num1 + num2;
      question = `${num1} + ${num2}`;
      break;
    case '-':
      // Ensure positive result
      const larger = Math.max(num1, num2);
      const smaller = Math.min(num1, num2);
      answer = larger - smaller;
      question = `${larger} - ${smaller}`;
      break;
    case '*':
      // Use smaller numbers for multiplication
      const small1 = Math.floor(Math.random() * 5) + 1;
      const small2 = Math.floor(Math.random() * 5) + 1;
      answer = small1 * small2;
      question = `${small1} × ${small2}`;
      break;
  }
  
  return { question, answer };
}

export function verifyMathCaptcha(userAnswer: string | number, correctAnswer: number): boolean {
  const userNum = typeof userAnswer === 'string' ? parseInt(userAnswer, 10) : userAnswer;
  return !isNaN(userNum) && userNum === correctAnswer;
}

// reCAPTCHA v3 verification
export async function verifyRecaptcha(token: string, secretKey: string): Promise<{ success: boolean; score?: number; error?: string }> {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'reCAPTCHA verification failed',
      };
    }

    // Score threshold (0.0 = bot, 1.0 = human)
    // Typically, scores above 0.5 are considered human
    const score = data.score || 0;
    const threshold = 0.5;

    return {
      success: score >= threshold,
      score,
    };
  } catch (error: any) {
    console.error('reCAPTCHA verification error:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify reCAPTCHA',
    };
  }
}

