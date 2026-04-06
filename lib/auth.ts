import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as nodeCrypto from 'crypto';
import {
  findUserById,
  findUserByEmail,
  insertUser,
  updateUser,
  listUsers,
  insertActivityLog,
  findBlockedIpActive,
  updateBlockedIp,
} from './local-store';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (!secret || secret === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET environment variable is required and must be set to a secure value');
  }
  return secret;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createToken(user: User): Promise<string> {
  const jti = nodeCrypto.randomBytes(16).toString('hex');
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      jti,
      iat: Math.floor(Date.now() / 1000),
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; email: string };
    const row = await findUserById(decoded.userId);
    if (!row || row.is_active === false) {
      return null;
    }
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      isAdmin: row.is_admin || false,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function registerUser(email: string, password: string, name: string): Promise<User> {
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('E-Mail ist erforderlich');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Passwort muss mindestens 8 Zeichen lang sein');
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    throw new Error('Name muss mindestens 2 Zeichen lang sein');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('Ein Benutzer mit dieser E-Mail existiert bereits');
  }

  const hashedPassword = await hashPassword(password);
  const all = await listUsers();
  const isFirstUser = all.length === 0;

  const row = await insertUser({
    email: normalizedEmail,
    password: hashedPassword,
    name: name.trim(),
    is_admin: isFirstUser,
    is_active: true,
    email_verified: false,
    last_login: null,
    last_login_ip: null,
  });

  return { id: row.id, email: row.email, name: row.name };
}

export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<User | null> {
  const user = await findUserByEmail(email.toLowerCase());
  if (!user || user.is_active === false) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }

  await updateUser(user.id, {
    last_login: new Date().toISOString(),
    last_login_ip: ipAddress || null,
  });

  if (ipAddress) {
    await insertActivityLog({
      user_id: user.id,
      action: 'login',
      ip_address: ipAddress,
      user_agent: userAgent || undefined,
      details: { email: user.email },
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.is_admin || false,
  };
}

export async function isAdmin(userId: string): Promise<boolean> {
  const u = await findUserById(userId);
  return !!u?.is_admin;
}

export async function isIpBlocked(ipAddress: string): Promise<boolean> {
  const data = await findBlockedIpActive(ipAddress);
  if (!data) {
    return false;
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await updateBlockedIp(data.id, { is_active: false });
    return false;
  }
  return true;
}

export async function updateUserProfile(
  userId: string,
  updates: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }
): Promise<User> {
  const currentUser = await findUserById(userId);
  if (!currentUser) {
    throw new Error('Benutzer nicht gefunden');
  }

  const patch: Parameters<typeof updateUser>[1] = {};

  if (updates.name !== undefined && updates.name.trim() !== currentUser.name.trim()) {
    if (!updates.name.trim()) {
      throw new Error('Name darf nicht leer sein');
    }
    patch.name = updates.name.trim();
  }

  if (updates.email !== undefined && updates.email.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
    if (!updates.email.trim()) {
      throw new Error('E-Mail darf nicht leer sein');
    }
    const other = await findUserByEmail(updates.email.trim().toLowerCase());
    if (other && other.id !== userId) {
      throw new Error('Ein Benutzer mit dieser E-Mail existiert bereits');
    }
    patch.email = updates.email.trim().toLowerCase();
  }

  if (updates.newPassword) {
    if (!updates.currentPassword) {
      throw new Error('Aktuelles Passwort ist erforderlich');
    }
    const ok = await verifyPassword(updates.currentPassword, currentUser.password);
    if (!ok) {
      throw new Error('Aktuelles Passwort ist falsch');
    }
    patch.password = await hashPassword(updates.newPassword);
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('Keine Änderungen vorgenommen');
  }

  const updated = await updateUser(userId, patch);
  if (!updated) {
    throw new Error('Profil konnte nicht aktualisiert werden');
  }

  return { id: updated.id, email: updated.email, name: updated.name };
}
