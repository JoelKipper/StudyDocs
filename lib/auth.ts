import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';
import { supabaseServer } from './supabase-server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    
    // Get user from Supabase
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, is_admin, is_active')
      .eq('id', decoded.userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // Check if user is active
    if (data.is_active === false) {
      return null;
    }
    
    return { 
      id: data.id, 
      email: data.email, 
      name: data.name,
      isAdmin: data.is_admin || false
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

export async function loginUser(
  email: string, 
  password: string, 
  ipAddress?: string,
  userAgent?: string
): Promise<User | null> {
  // Get user from Supabase
  const { data: user, error } = await supabaseServer
    .from('users')
    .select('id, email, name, password, is_admin, is_active')
    .eq('email', email.toLowerCase())
    .single();
  
  if (error || !user) {
    return null;
  }
  
  // Check if user is active
  if (user.is_active === false) {
    return null;
  }
  
  // Verify password
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }
  
  // Update last login
  await supabaseServer
    .from('users')
    .update({ 
      last_login: new Date().toISOString(),
      last_login_ip: ipAddress || null
    })
    .eq('id', user.id);
  
  // Log activity
  if (ipAddress) {
    await supabaseServer
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: 'login',
        ip_address: ipAddress,
        user_agent: userAgent || null,
        details: { email: user.email }
      });
  }
  
  return { 
    id: user.id, 
    email: user.email, 
    name: user.name,
    isAdmin: user.is_admin || false
  };
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  return data.is_admin || false;
}

export async function isIpBlocked(ipAddress: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('blocked_ips')
    .select('id, expires_at')
    .eq('ip_address', ipAddress)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error || !data) {
    return false;
  }
  
  // Check if block has expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    // Deactivate expired block
    await supabaseServer
      .from('blocked_ips')
      .update({ is_active: false })
      .eq('id', data.id);
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
  // Get current user data
  const { data: currentUser, error: fetchError } = await supabaseServer
    .from('users')
    .select('id, email, name, password')
    .eq('id', userId)
    .single();

  if (fetchError || !currentUser) {
    throw new Error('Benutzer nicht gefunden');
  }

  const updateData: { name?: string; email?: string; password?: string } = {};

  // Update name if provided and different
  if (updates.name !== undefined && updates.name.trim() !== currentUser.name.trim()) {
    if (!updates.name.trim()) {
      throw new Error('Name darf nicht leer sein');
    }
    updateData.name = updates.name.trim();
  }

  // Update email if provided and different
  if (updates.email !== undefined && updates.email.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
    if (!updates.email.trim()) {
      throw new Error('E-Mail darf nicht leer sein');
    }
    // Check if new email already exists
    const { data: existingUser } = await supabaseServer
      .from('users')
      .select('id')
      .eq('email', updates.email.trim().toLowerCase())
      .neq('id', userId)
      .maybeSingle();

    if (existingUser) {
      throw new Error('Ein Benutzer mit dieser E-Mail existiert bereits');
    }

    updateData.email = updates.email.trim().toLowerCase();
  }

  // Update password if provided
  if (updates.newPassword) {
    if (!updates.currentPassword) {
      throw new Error('Aktuelles Passwort ist erforderlich');
    }

    // Verify current password
    const isValid = await verifyPassword(updates.currentPassword, currentUser.password);
    if (!isValid) {
      throw new Error('Aktuelles Passwort ist falsch');
    }

    // Hash new password
    updateData.password = await hashPassword(updates.newPassword);
  }

  // If no updates, throw error
  if (Object.keys(updateData).length === 0) {
    throw new Error('Keine Änderungen vorgenommen');
  }

  // Update user in Supabase
  const { data, error } = await supabaseServer
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select('id, email, name')
    .single();

  if (error) {
    console.error('Error updating user:', error);
    throw new Error('Fehler beim Aktualisieren des Profils');
  }

  if (!data) {
    throw new Error('Profil konnte nicht aktualisiert werden');
  }

  return { id: data.id, email: data.email, name: data.name };
}
