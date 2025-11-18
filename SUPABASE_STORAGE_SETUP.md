# Supabase Storage Setup Anleitung

## 1. Storage Bucket erstellen

1. Öffne dein Supabase Dashboard: https://supabase.com/dashboard
2. Gehe zu deinem Projekt
3. Navigiere zu "Storage"
4. Klicke auf "New bucket"
5. Erstelle einen Bucket mit folgenden Einstellungen:
   - **Name**: `files`
   - **Public bucket**: ✅ Aktiviert (damit Dateien über URLs zugänglich sind)
   - **File size limit**: Nach Bedarf (z.B. 50MB oder mehr)
   - **Allowed MIME types**: Leer lassen (alle Typen erlauben) oder spezifische Typen angeben

## 2. Storage Policies einrichten

Nach dem Erstellen des Buckets, gehe zu "Policies" und erstelle folgende Policies:

### Policy 1: Authenticated users can upload files
```sql
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');
```

### Policy 2: Authenticated users can read files
```sql
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'files');
```

### Policy 3: Authenticated users can update files
```sql
CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'files')
WITH CHECK (bucket_id = 'files');
```

### Policy 4: Authenticated users can delete files
```sql
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'files');
```

**Alternative:** Wenn du den Service Role Key verwendest (empfohlen für Server-seitige Operationen), kannst du die Policies weniger restriktiv machen oder den Service Role Key direkt verwenden.

## 3. Datenbank-Schema ausführen

Führe das SQL-Script aus `supabase-schema.sql` im SQL Editor aus. Dies erstellt:
- `users` Tabelle (falls noch nicht vorhanden)
- `file_metadata` Tabelle für Datei- und Ordner-Metadaten
- `shares` Tabelle für Share-Links

## 4. Service Role Key (Optional, aber empfohlen)

Für Server-seitige Operationen solltest du den Service Role Key verwenden:

1. Gehe zu "Settings" > "API" in deinem Supabase Dashboard
2. Kopiere den "service_role" Key (NICHT den anon key!)
3. Füge ihn zu deiner `.env.local` hinzu:

```env
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key-hier
```

4. Erstelle eine separate Supabase-Client-Instanz für Server-Operationen in `lib/supabase-server.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);
```

Dann verwende `supabaseServer` in `lib/filesystem-supabase.ts` statt `supabase`.

## 5. Testen

1. Starte den Server neu: `npm run dev`
2. Registriere einen Benutzer
3. Lade eine Datei hoch
4. Die Datei sollte jetzt in Supabase Storage gespeichert sein
5. Alle Benutzer sollten die gleichen Dateien sehen

## Wichtige Hinweise

- **Globaler Speicher**: Alle Dateien werden jetzt global für alle Benutzer gespeichert
- **Metadaten**: Datei-Metadaten (Ersteller, Änderungsdatum, etc.) werden in der `file_metadata` Tabelle gespeichert
- **Storage**: Die eigentlichen Dateien werden im Supabase Storage Bucket `files` gespeichert
- **Performance**: Für große Dateien oder viele Dateien kann es sinnvoll sein, Caching zu implementieren

