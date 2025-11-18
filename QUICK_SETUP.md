# Schnelle Setup-Anleitung für Supabase Storage

## Schritt 1: Service Role Key hinzufügen

1. Gehe zu deinem Supabase Dashboard: https://supabase.com/dashboard
2. Wähle dein Projekt aus
3. Gehe zu **Settings** > **API**
4. Kopiere den **service_role** Key (NICHT den anon key!)
5. Füge ihn zu deiner `.env.local` Datei hinzu:

```env
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key-hier
```

## Schritt 2: Storage Bucket erstellen

1. Im Supabase Dashboard, gehe zu **Storage**
2. Klicke auf **New bucket**
3. Erstelle einen Bucket mit:
   - **Name**: `files`
   - **Public bucket**: ✅ Aktiviert
   - **File size limit**: Nach Bedarf (z.B. 50MB)
   - **Allowed MIME types**: Leer lassen (alle Typen erlauben)

## Schritt 3: Storage Policies einrichten

Nach dem Erstellen des Buckets, gehe zu **Storage** > **Policies** und erstelle folgende Policies im SQL Editor:

```sql
-- Policy 1: Upload
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');

-- Policy 2: Read
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'files');

-- Policy 3: Update
CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'files')
WITH CHECK (bucket_id = 'files');

-- Policy 4: Delete
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'files');
```

**WICHTIG:** Da wir den Service Role Key verwenden, umgehen wir RLS. Die Policies sind für zusätzliche Sicherheit, aber der Service Role Key hat bereits volle Berechtigung.

## Schritt 4: Datenbank-Schema ausführen

1. Gehe zu **SQL Editor** im Supabase Dashboard
2. Öffne die Datei `supabase-schema.sql`
3. Kopiere den gesamten Inhalt
4. Füge ihn in den SQL Editor ein
5. Klicke auf **Run**

Dies erstellt:
- `users` Tabelle (falls noch nicht vorhanden)
- `file_metadata` Tabelle
- `shares` Tabelle

## Schritt 5: Server neu starten

```bash
# Stoppe den Server (Ctrl+C) und starte neu:
npm run dev
```

## Testen

1. Registriere einen Benutzer oder logge dich ein
2. Versuche eine Datei hochzuladen
3. Die Datei sollte jetzt in Supabase Storage gespeichert sein

## Fehlerbehebung

Wenn du immer noch keine Dateien hochladen kannst:

1. **Prüfe die Browser-Konsole** für Fehlermeldungen
2. **Prüfe die Server-Logs** im Terminal
3. **Stelle sicher, dass:**
   - Der Storage Bucket `files` existiert
   - Der Service Role Key in `.env.local` ist
   - Das SQL-Schema ausgeführt wurde
   - Der Server neu gestartet wurde

Die Fehlermeldungen sollten jetzt spezifischer sein und dir sagen, was fehlt.

