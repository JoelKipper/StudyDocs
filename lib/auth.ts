import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface User {
  id: string;
  email: string;
  name: string;
}

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
    
    // Get user from Supabase
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', decoded.userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return { id: data.id, email: data.email, name: data.name };
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
  // Check if user with this email already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  
  // If we got data (not null), user exists
  if (existingUser) {
    throw new Error('Ein Benutzer mit dieser E-Mail existiert bereits');
  }
  
  // If error is not "not found" error, something went wrong
  if (checkError && checkError.code !== 'PGRST116') {
    console.error('Error checking existing user:', checkError);
    throw new Error('Fehler beim Überprüfen der E-Mail');
  }
  
  // Hash password
  const hashedPassword = await hashPassword(password);
  
  // Insert user into Supabase (id will be auto-generated as UUID)
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name,
    })
    .select('id, email, name')
    .single();
  
  if (error) {
    console.error('Supabase error:', error);
    // Check if it's a unique constraint violation (email already exists)
    if (error.code === '23505') {
      throw new Error('Ein Benutzer mit dieser E-Mail existiert bereits');
    }
    throw new Error('Fehler beim Registrieren des Benutzers');
  }
  
  if (!data) {
    throw new Error('Benutzer konnte nicht erstellt werden');
  }
  
  return { id: data.id, email: data.email, name: data.name };
}

export async function loginUser(email: string, password: string): Promise<User | null> {
  // Get user from Supabase
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, password')
    .eq('email', email.toLowerCase())
    .single();
  
  if (error || !user) {
    return null;
  }
  
  // Verify password
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }
  
  return { id: user.id, email: user.email, name: user.name };
}
