import { supabaseServer } from './supabase-server';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Time window in milliseconds
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  register: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
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

  // Get recent attempts from database
  const { data: attempts, error } = await supabaseServer
    .from('rate_limit_attempts')
    .select('created_at')
    .eq('identifier', identifier)
    .eq('action', action)
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but log it
    return { allowed: true, remaining: config.maxAttempts, resetAt: new Date(now.getTime() + config.windowMs) };
  }

  const attemptCount = attempts?.length || 0;
  const allowed = attemptCount < config.maxAttempts;
  const remaining = Math.max(0, config.maxAttempts - attemptCount);
  const resetAt = attempts && attempts.length > 0
    ? new Date(new Date(attempts[attempts.length - 1].created_at).getTime() + config.windowMs)
    : new Date(now.getTime() + config.windowMs);

  // Note: We don't record the attempt here - it should be recorded only on failed attempts
  // This function just checks the limit

  // Clean up old attempts (older than 24 hours)
  const cleanupDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await supabaseServer
    .from('rate_limit_attempts')
    .delete()
    .lt('created_at', cleanupDate.toISOString());

  return { allowed, remaining, resetAt };
}

/**
 * Record a failed attempt for rate limiting
 * This should be called when an authentication attempt fails
 */
export async function recordFailedAttempt(
  identifier: string,
  action: 'login' | 'register'
): Promise<void> {
  try {
    await supabaseServer
      .from('rate_limit_attempts')
      .insert({
        identifier,
        action,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error recording failed attempt:', error);
    // Don't throw - rate limiting should not break the application
  }
}

