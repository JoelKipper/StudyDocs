# Storage Bucket erstellen - Schritt für Schritt

## Problem: "Bucket not found" Fehler

Dieser Fehler tritt auf, weil der Storage Bucket `files` noch nicht in Supabase erstellt wurde.

## Lösung: Bucket erstellen

### Schritt 1: Öffne Supabase Dashboard

1. Gehe zu: https://supabase.com/dashboard
2. Wähle dein Projekt aus (okvgxjgmqthplfamoolu)

### Schritt 2: Navigiere zu Storage

1. Klicke in der linken Sidebar auf **Storage**
2. Du solltest eine Übersicht mit "Buckets" sehen

### Schritt 3: Erstelle neuen Bucket

1. Klicke auf den Button **"New bucket"** oder **"Create bucket"**
2. Fülle das Formular aus:
   - **Name**: `files` (WICHTIG: genau so, ohne Anführungszeichen)
   - **Public bucket**: ✅ **Aktivieren** (Checkbox ankreuzen)
   - **File size limit**: Nach Bedarf (z.B. `52428800` für 50MB oder leer lassen)
   - **Allowed MIME types**: Leer lassen (erlaubt alle Dateitypen)

3. Klicke auf **"Create bucket"** oder **"Save"**

### Schritt 4: Prüfe ob Bucket erstellt wurde

1. Du solltest jetzt den Bucket `files` in der Liste sehen
2. Der Status sollte "Public" anzeigen

### Schritt 5: Storage Policies (Optional, aber empfohlen)

Gehe zu **Storage** > **Policies** und führe folgendes SQL aus:

```sql
-- Policy für Upload
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');

-- Policy für Read
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'files');

-- Policy für Update
CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'files')
WITH CHECK (bucket_id = 'files');

-- Policy für Delete
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'files');
```

**Hinweis:** Da wir den Service Role Key verwenden, umgehen wir RLS. Die Policies sind für zusätzliche Sicherheit, aber nicht zwingend erforderlich.

### Schritt 6: Server neu starten

Nach dem Erstellen des Buckets, starte den Next.js Server neu:

```bash
# Stoppe den Server (Ctrl+C) und starte neu:
npm run dev
```

### Schritt 7: Testen

1. Öffne die Anwendung im Browser
2. Versuche eine Datei hochzuladen
3. Der Fehler sollte jetzt verschwunden sein

## Alternative: Bucket über SQL erstellen

Falls du Probleme mit dem Dashboard hast, kannst du den Bucket auch über SQL erstellen:

1. Gehe zu **SQL Editor** im Supabase Dashboard
2. Führe folgendes SQL aus:

```sql
-- Erstelle Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;
```

## Wichtige Hinweise

- Der Bucket-Name muss **genau** `files` sein (kleingeschrieben)
- Der Bucket muss **öffentlich** sein (public = true)
- Nach dem Erstellen des Buckets, starte den Server neu

## Fehlerbehebung

Wenn der Fehler weiterhin auftritt:

1. **Prüfe den Bucket-Namen**: Muss genau `files` sein (nicht `Files` oder `FILES`)
2. **Prüfe ob Bucket öffentlich ist**: In der Storage-Übersicht sollte "Public" angezeigt werden
3. **Prüfe die Browser-Konsole**: Für weitere Fehlermeldungen
4. **Prüfe die Server-Logs**: Im Terminal für Server-seitige Fehler

