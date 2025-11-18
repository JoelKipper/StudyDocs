import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface User {
  id: string;
  email: string;
  name: string;
}

// In einer echten Anwendung würde dies aus einer Datenbank kommen
const users: { [key: string]: { email: string; password: string; name: string } } = {};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createToken(user: User): Promise<string> {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return { id: decoded.userId, email: decoded.email, name: users[decoded.userId]?.name || decoded.email };
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
  const userId = Date.now().toString();
  const hashedPassword = await hashPassword(password);
  users[userId] = { email, password: hashedPassword, name };
  return { id: userId, email, name };
}

export async function loginUser(email: string, password: string): Promise<User | null> {
  const userEntry = Object.entries(users).find(([_, user]) => user.email === email);
  if (!userEntry) return null;
  
  const [userId, user] = userEntry;
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) return null;
  
  return { id: userId, email: user.email, name: user.name };
}

