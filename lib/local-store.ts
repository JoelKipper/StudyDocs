import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { DATA_DIR } from './data-dir';

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EMAIL_VERIFICATION_TOKENS_FILE = path.join(DATA_DIR, 'email-verification-tokens.json');
const PASSWORD_RESET_TOKENS_FILE = path.join(DATA_DIR, 'password-reset-tokens.json');
const SHARES_FILE = path.join(DATA_DIR, 'shares.json');
const ACTIVITY_LOGS_FILE = path.join(DATA_DIR, 'activity-logs.json');
const BLOCKED_IPS_FILE = path.join(DATA_DIR, 'blocked-ips.json');
const RATE_LIMIT_FILE = path.join(DATA_DIR, 'rate-limit-attempts.json');
const SYSTEM_SETTINGS_FILE = path.join(DATA_DIR, 'system-settings.json');

const MAX_ACTIVITY_LOGS = 15000;

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await ensureDir();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, file);
}

// ——— Users ———

export interface UserRecord {
  id: string;
  email: string;
  password: string;
  name: string;
  is_admin: boolean;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  last_login: string | null;
  last_login_ip: string | null;
}

interface UsersFile {
  users: UserRecord[];
}

export async function listUsers(): Promise<UserRecord[]> {
  const data = await readJsonFile<UsersFile>(USERS_FILE, { users: [] });
  return data.users;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const users = await listUsers();
  return users.find((u) => u.id === id) || null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const lower = email.toLowerCase();
  const users = await listUsers();
  return users.find((u) => u.email === lower) || null;
}

export async function saveUsers(users: UserRecord[]): Promise<void> {
  await writeJsonFile(USERS_FILE, { users });
}

export async function insertUser(
  row: Omit<UserRecord, 'id' | 'created_at'> & { id?: string; created_at?: string }
): Promise<UserRecord> {
  const users = await listUsers();
  const id = row.id || randomUUID();
  const record: UserRecord = {
    id,
    email: row.email.toLowerCase(),
    password: row.password,
    name: row.name,
    is_admin: row.is_admin,
    is_active: row.is_active,
    email_verified: row.email_verified,
    created_at: row.created_at || new Date().toISOString(),
    last_login: row.last_login ?? null,
    last_login_ip: row.last_login_ip ?? null,
  };
  users.push(record);
  await saveUsers(users);
  return record;
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<UserRecord, 'id' | 'created_at'>>
): Promise<UserRecord | null> {
  const users = await listUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) return null;
  users[i] = { ...users[i], ...patch };
  await saveUsers(users);
  return users[i];
}

export async function deleteUserById(id: string): Promise<boolean> {
  const users = await listUsers();
  const next = users.filter((u) => u.id !== id);
  if (next.length === users.length) return false;
  await saveUsers(next);
  return true;
}

export function userToPublic(u: UserRecord) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    is_admin: u.is_admin,
    is_active: u.is_active,
    email_verified: u.email_verified,
    created_at: u.created_at,
    last_login: u.last_login,
    last_login_ip: u.last_login_ip,
  };
}

// ——— Email verification tokens ———

interface EmailVerificationTokenRow {
  user_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
}

interface EmailVerificationFile {
  tokens: EmailVerificationTokenRow[];
}

async function readEmailVerificationTokens(): Promise<EmailVerificationTokenRow[]> {
  const data = await readJsonFile<EmailVerificationFile>(EMAIL_VERIFICATION_TOKENS_FILE, { tokens: [] });
  return data.tokens;
}

async function writeEmailVerificationTokens(tokens: EmailVerificationTokenRow[]): Promise<void> {
  await writeJsonFile(EMAIL_VERIFICATION_TOKENS_FILE, { tokens });
}

export async function deleteEmailVerificationTokensForUser(userId: string): Promise<void> {
  const tokens = (await readEmailVerificationTokens()).filter(
    (t) => !(t.user_id === userId && t.used_at === null)
  );
  await writeEmailVerificationTokens(tokens);
}

export async function insertEmailVerificationToken(row: Omit<EmailVerificationTokenRow, 'used_at'>): Promise<void> {
  await deleteEmailVerificationTokensForUser(row.user_id);
  const tokens = await readEmailVerificationTokens();
  tokens.push({ ...row, used_at: null });
  await writeEmailVerificationTokens(tokens);
}

export async function findEmailVerificationToken(
  token: string
): Promise<EmailVerificationTokenRow | null> {
  const tokens = await readEmailVerificationTokens();
  return tokens.find((t) => t.token === token && !t.used_at) || null;
}

export async function markEmailVerificationTokenUsed(token: string): Promise<void> {
  const tokens = await readEmailVerificationTokens();
  const t = tokens.find((x) => x.token === token);
  if (t) t.used_at = new Date().toISOString();
  await writeEmailVerificationTokens(tokens);
}

// ——— Password reset tokens ———

interface PasswordResetTokenRow {
  user_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
}

interface PasswordResetFile {
  tokens: PasswordResetTokenRow[];
}

async function readPasswordResetTokens(): Promise<PasswordResetTokenRow[]> {
  const data = await readJsonFile<PasswordResetFile>(PASSWORD_RESET_TOKENS_FILE, { tokens: [] });
  return data.tokens;
}

async function writePasswordResetTokens(tokens: PasswordResetTokenRow[]): Promise<void> {
  await writeJsonFile(PASSWORD_RESET_TOKENS_FILE, { tokens });
}

export async function deletePasswordResetTokensForUser(userId: string): Promise<void> {
  const tokens = (await readPasswordResetTokens()).filter(
    (t) => !(t.user_id === userId && t.used_at === null)
  );
  await writePasswordResetTokens(tokens);
}

export async function insertPasswordResetToken(row: Omit<PasswordResetTokenRow, 'used_at'>): Promise<void> {
  await deletePasswordResetTokensForUser(row.user_id);
  const tokens = await readPasswordResetTokens();
  tokens.push({ ...row, used_at: null });
  await writePasswordResetTokens(tokens);
}

export async function findPasswordResetToken(token: string): Promise<PasswordResetTokenRow | null> {
  const tokens = await readPasswordResetTokens();
  return tokens.find((t) => t.token === token && !t.used_at) || null;
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  const tokens = await readPasswordResetTokens();
  const t = tokens.find((x) => x.token === token);
  if (t) t.used_at = new Date().toISOString();
  await writePasswordResetTokens(tokens);
}

// ——— Shares ———

export interface ShareRecord {
  token: string;
  user_id: string;
  item_path: string;
  item_type: 'file' | 'directory';
  created_at: string;
}

interface SharesFile {
  shares: ShareRecord[];
}

export async function listShares(): Promise<ShareRecord[]> {
  const data = await readJsonFile<SharesFile>(SHARES_FILE, { shares: [] });
  return data.shares;
}

export async function insertShare(share: ShareRecord): Promise<void> {
  const shares = await listShares();
  shares.push(share);
  await writeJsonFile(SHARES_FILE, { shares });
}

export async function findShareByToken(token: string): Promise<ShareRecord | null> {
  const shares = await listShares();
  return shares.find((s) => s.token === token) || null;
}

export async function deleteShareByToken(token: string): Promise<void> {
  const shares = (await listShares()).filter((s) => s.token !== token);
  await writeJsonFile(SHARES_FILE, { shares });
}

export async function deleteSharesByUserId(userId: string): Promise<void> {
  const shares = (await listShares()).filter((s) => s.user_id !== userId);
  await writeJsonFile(SHARES_FILE, { shares });
}

// ——— Activity logs ———

export interface ActivityLogRow {
  id: string;
  user_id: string;
  action: string;
  resource_type?: string;
  resource_path?: string;
  ip_address?: string;
  user_agent?: string;
  details?: unknown;
  created_at: string;
}

interface ActivityFile {
  logs: ActivityLogRow[];
}

export async function insertActivityLog(
  row: Omit<ActivityLogRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
): Promise<void> {
  const data = await readJsonFile<ActivityFile>(ACTIVITY_LOGS_FILE, { logs: [] });
  const log: ActivityLogRow = {
    id: row.id || randomUUID(),
    user_id: row.user_id,
    action: row.action,
    resource_type: row.resource_type,
    resource_path: row.resource_path,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    details: row.details,
    created_at: row.created_at || new Date().toISOString(),
  };
  data.logs.unshift(log);
  if (data.logs.length > MAX_ACTIVITY_LOGS) {
    data.logs = data.logs.slice(0, MAX_ACTIVITY_LOGS);
  }
  await writeJsonFile(ACTIVITY_LOGS_FILE, data);
}

export async function queryActivityLogs(options: {
  limit: number;
  offset: number;
  action?: string | null;
  userId?: string | null;
}): Promise<{ logs: ActivityLogRow[]; total: number }> {
  let logs = (await readJsonFile<ActivityFile>(ACTIVITY_LOGS_FILE, { logs: [] })).logs;
  if (options.action) {
    logs = logs.filter((l) => l.action === options.action);
  }
  if (options.userId) {
    logs = logs.filter((l) => l.user_id === options.userId);
  }
  const total = logs.length;
  const slice = logs.slice(options.offset, options.offset + options.limit);
  return { logs: slice, total };
}

export async function deleteActivityLogsByUserId(userId: string): Promise<void> {
  const data = await readJsonFile<ActivityFile>(ACTIVITY_LOGS_FILE, { logs: [] });
  data.logs = data.logs.filter((l) => l.user_id !== userId);
  await writeJsonFile(ACTIVITY_LOGS_FILE, data);
}

export async function listAllActivityLogsForUser(userId: string): Promise<ActivityLogRow[]> {
  const data = await readJsonFile<ActivityFile>(ACTIVITY_LOGS_FILE, { logs: [] });
  return data.logs.filter((l) => l.user_id === userId);
}

export async function countActivitySince(sinceIso: string): Promise<number> {
  const data = await readJsonFile<ActivityFile>(ACTIVITY_LOGS_FILE, { logs: [] });
  const since = new Date(sinceIso);
  return data.logs.filter((l) => new Date(l.created_at) >= since).length;
}

// ——— Blocked IPs ———

export interface BlockedIpRecord {
  id: string;
  ip_address: string;
  reason: string | null;
  blocked_at: string;
  expires_at: string | null;
  is_active: boolean;
  blocked_by: string;
}

interface BlockedIpsFile {
  blocked: BlockedIpRecord[];
}

export async function listBlockedIps(): Promise<BlockedIpRecord[]> {
  const data = await readJsonFile<BlockedIpsFile>(BLOCKED_IPS_FILE, { blocked: [] });
  return data.blocked;
}

export async function saveBlockedIps(blocked: BlockedIpRecord[]): Promise<void> {
  await writeJsonFile(BLOCKED_IPS_FILE, { blocked });
}

export async function findBlockedIpActive(ip: string): Promise<BlockedIpRecord | null> {
  const blocked = await listBlockedIps();
  return blocked.find((b) => b.ip_address === ip && b.is_active) || null;
}

export async function upsertBlockedIp(
  record: Omit<BlockedIpRecord, 'id' | 'blocked_at'> & { id?: string; blocked_at?: string }
): Promise<BlockedIpRecord> {
  const blocked = await listBlockedIps();
  const existing = blocked.findIndex((b) => b.ip_address === record.ip_address);
  const row: BlockedIpRecord = {
    id: record.id || randomUUID(),
    ip_address: record.ip_address,
    reason: record.reason ?? null,
    blocked_at: record.blocked_at || new Date().toISOString(),
    expires_at: record.expires_at ?? null,
    is_active: record.is_active,
    blocked_by: record.blocked_by,
  };
  if (existing >= 0) {
    blocked[existing] = { ...blocked[existing], ...row, id: blocked[existing].id };
  } else {
    blocked.push(row);
  }
  await saveBlockedIps(blocked);
  return existing >= 0 ? blocked[existing] : row;
}

export async function updateBlockedIp(id: string, patch: Partial<BlockedIpRecord>): Promise<void> {
  const blocked = await listBlockedIps();
  const i = blocked.findIndex((b) => b.id === id);
  if (i < 0) return;
  blocked[i] = { ...blocked[i], ...patch };
  await saveBlockedIps(blocked);
}

// ——— Rate limit ———

interface RateAttempt {
  identifier: string;
  action: string;
  created_at: string;
}

interface RateLimitFile {
  attempts: RateAttempt[];
}

export async function getRateAttemptsSince(
  identifier: string,
  action: string,
  sinceIso: string
): Promise<RateAttempt[]> {
  const data = await readJsonFile<RateLimitFile>(RATE_LIMIT_FILE, { attempts: [] });
  return data.attempts.filter(
    (a) => a.identifier === identifier && a.action === action && a.created_at >= sinceIso
  );
}

export async function insertRateAttempt(identifier: string, action: string): Promise<void> {
  const data = await readJsonFile<RateLimitFile>(RATE_LIMIT_FILE, { attempts: [] });
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  data.attempts = data.attempts.filter((a) => a.created_at >= cutoff);
  data.attempts.push({
    identifier,
    action,
    created_at: new Date().toISOString(),
  });
  await writeJsonFile(RATE_LIMIT_FILE, data);
}

// ——— System settings ———

interface SystemSettingsFile {
  settings: Record<string, string>;
  meta?: Record<string, { updated_by?: string; updated_at?: string }>;
}

export async function getSystemSetting(key: string): Promise<string | null> {
  const data = await readJsonFile<SystemSettingsFile>(SYSTEM_SETTINGS_FILE, { settings: {} });
  return data.settings[key] ?? null;
}

export async function setSystemSetting(key: string, value: string, userId: string): Promise<void> {
  const data = await readJsonFile<SystemSettingsFile>(SYSTEM_SETTINGS_FILE, { settings: {} });
  data.settings[key] = value;
  data.meta = data.meta || {};
  data.meta[key] = { updated_by: userId, updated_at: new Date().toISOString() };
  await writeJsonFile(SYSTEM_SETTINGS_FILE, data);
}

export async function getAllSystemSettings(): Promise<Record<string, string>> {
  const data = await readJsonFile<SystemSettingsFile>(SYSTEM_SETTINGS_FILE, { settings: {} });
  return { ...data.settings };
}
