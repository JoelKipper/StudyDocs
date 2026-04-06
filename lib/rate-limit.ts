import { getRateAttemptsSince, insertRateAttempt } from './local-store';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  },
  register: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
  },
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  identifier: string,
  action: 'login' | 'register'
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS[action];
  if (!config) {
    return { allowed: true, remaining: Infinity, resetAt: new Date() };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  const attempts = await getRateAttemptsSince(identifier, action, windowStart.toISOString());
  const attemptCount = attempts.length;
  const allowed = attemptCount < config.maxAttempts;
  const remaining = Math.max(0, config.maxAttempts - attemptCount);
  const resetAt =
    attempts.length > 0
      ? new Date(new Date(attempts[attempts.length - 1].created_at).getTime() + config.windowMs)
      : new Date(now.getTime() + config.windowMs);

  return { allowed, remaining, resetAt };
}

export async function recordFailedAttempt(
  identifier: string,
  action: 'login' | 'register'
): Promise<void> {
  try {
    await insertRateAttempt(identifier, action);
  } catch (error) {
    console.error('Error recording failed attempt:', error);
  }
}
