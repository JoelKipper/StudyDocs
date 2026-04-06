import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { DATA_DIR } from '@/lib/data-dir';

const FAVORITES_FILE = path.join(DATA_DIR, 'favorites.json');

interface FavoritesStore {
  [userId: string]: Array<{
    path: string;
    name: string;
    type: 'file' | 'directory';
    addedAt: number;
  }>;
}

async function loadFavorites(): Promise<FavoritesStore> {
  try {
    const data = await fs.readFile(FAVORITES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveFavorites(favorites: FavoritesStore) {
  try {
    await fs.mkdir(path.dirname(FAVORITES_FILE), { recursive: true });
    await fs.writeFile(FAVORITES_FILE, JSON.stringify(favorites, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving favorites:', error);
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const favorites = await loadFavorites();
    return NextResponse.json({ favorites: favorites[user.id] || [] });
  } catch (error: any) {
    console.error('Error loading favorites:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Favoriten' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { itemPath, itemName, itemType } = await request.json();

    if (!itemPath || !itemName || !itemType) {
      return NextResponse.json({ error: 'Pfad, Name und Typ sind erforderlich' }, { status: 400 });
    }

    const favorites = await loadFavorites();
    const userFavorites = favorites[user.id] || [];

    // Check if already favorited
    if (userFavorites.some(fav => fav.path === itemPath)) {
      return NextResponse.json({ error: 'Bereits in Favoriten' }, { status: 400 });
    }

    // Add to favorites
    userFavorites.push({
      path: itemPath,
      name: itemName,
      type: itemType,
      addedAt: Date.now(),
    });

    favorites[user.id] = userFavorites;
    await saveFavorites(favorites);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error adding favorite:', error);
    return NextResponse.json({ error: 'Fehler beim Hinzufügen zu Favoriten' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const itemPath = searchParams.get('path');

    if (!itemPath) {
      return NextResponse.json({ error: 'Pfad ist erforderlich' }, { status: 400 });
    }

    const favorites = await loadFavorites();
    const userFavorites = favorites[user.id] || [];

    // Remove from favorites
    favorites[user.id] = userFavorites.filter(fav => fav.path !== itemPath);
    await saveFavorites(favorites);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing favorite:', error);
    return NextResponse.json({ error: 'Fehler beim Entfernen aus Favoriten' }, { status: 500 });
  }
}

