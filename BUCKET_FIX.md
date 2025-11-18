# Bucket "files" erstellen - Schnelllösung

## Problem
Fehler: "Bucket not found" beim Hochladen von Dateien

## Lösung: Bucket über SQL erstellen

### Schritt 1: Öffne Supabase SQL Editor

1. Gehe zu: https://supabase.com/dashboard
2. Wähle dein Projekt aus
3. Klicke auf **SQL Editor** in der linken Sidebar

### Schritt 2: Führe SQL aus

1. Öffne die Datei `create-bucket.sql` in deinem Projekt
2. Kopiere den gesamten Inhalt
3. Füge ihn in den SQL Editor ein
4. Klicke auf **Run** (oder drücke Ctrl+Enter)

Das SQL erstellt automatisch den Bucket `files` falls er nicht existiert.

### Schritt 3: Prüfe ob es funktioniert hat

Nach dem Ausführen solltest du eine Zeile sehen mit:
- `id`: `files`
- `name`: `files`
- `public`: `true`

### Schritt 4: Server neu starten

```bash
# Stoppe den Server (Ctrl+C) und starte neu:
npm run dev
```

### Schritt 5: Testen

Versuche jetzt eine Datei hochzuladen. Der Fehler sollte verschwunden sein.

## Alternative: Über das Dashboard

Falls SQL nicht funktioniert:

1. Gehe zu **Storage** im Supabase Dashboard
2. Klicke auf **New bucket**
3. Name: `files`
4. Public bucket: ✅ **Aktivieren**
5. Klicke auf **Create bucket**

## Wichtige Hinweise

- Der Bucket-Name muss **genau** `files` sein (kleingeschrieben)
- Der Bucket muss **öffentlich** sein (`public = true`)
- Nach dem Erstellen, starte den Server neu

## Fehlerbehebung

Wenn es immer noch nicht funktioniert:

1. **Prüfe ob Bucket existiert:**
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'files';
   ```
   Sollte eine Zeile zurückgeben.

2. **Prüfe ob Bucket öffentlich ist:**
   ```sql
   SELECT id, name, public FROM storage.buckets WHERE id = 'files';
   ```
   `public` sollte `true` sein.

3. **Prüfe die .env.local Datei:**
   - `NEXT_PUBLIC_SUPABASE_URL` sollte gesetzt sein
   - `SUPABASE_SERVICE_ROLE_KEY` sollte gesetzt sein (oder `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

4. **Prüfe die Server-Logs** im Terminal für weitere Fehlermeldungen

