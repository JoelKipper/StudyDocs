# RLS Policy Fehler beheben

## Problem
Fehler: "new row violates row-level security policy" beim Hochladen von Dateien

## Ursache
Die Row Level Security (RLS) Policies in Supabase blockieren die Operationen, obwohl wir den Service Role Key verwenden.

## Lösung: RLS Policies anpassen

### Schritt 1: Öffne Supabase SQL Editor

1. Gehe zu: https://supabase.com/dashboard
2. Wähle dein Projekt aus
3. Klicke auf **SQL Editor** in der linken Sidebar

### Schritt 2: Führe SQL aus

1. Öffne die Datei `fix-rls-policies.sql` in deinem Projekt
2. Kopiere den gesamten Inhalt
3. Füge ihn in den SQL Editor ein
4. Klicke auf **Run** (oder drücke Ctrl+Enter)

Das SQL:
- Löscht die alten restriktiven Policies
- Erstellt neue Policies, die alle Operationen erlauben (funktioniert mit Service Role Key)

### Schritt 3: Prüfe ob es funktioniert hat

Nach dem Ausführen solltest du eine Tabelle sehen mit den neuen Policies für `file_metadata` und `shares`.

### Schritt 4: Server neu starten

```bash
# Stoppe den Server (Ctrl+C) und starte neu:
npm run dev
```

### Schritt 5: Testen

Versuche jetzt eine Datei hochzuladen. Der Fehler sollte verschwunden sein.

## Alternative: RLS komplett deaktivieren (Nur für Entwicklung!)

**WARNUNG:** Nur für Entwicklung verwenden! In Produktion sollten RLS Policies aktiviert bleiben.

Falls die Policies weiterhin Probleme machen, kannst du RLS temporär deaktivieren:

```sql
-- RLS deaktivieren (NUR FÜR ENTWICKLUNG!)
ALTER TABLE file_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE shares DISABLE ROW LEVEL SECURITY;
```

**WICHTIG:** Reaktiviere RLS später wieder für Produktion:

```sql
-- RLS wieder aktivieren
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
```

## Fehlerbehebung

Wenn es immer noch nicht funktioniert:

1. **Prüfe ob Service Role Key gesetzt ist:**
   - Öffne `.env.local`
   - Stelle sicher, dass `SUPABASE_SERVICE_ROLE_KEY` gesetzt ist
   - Der Service Role Key sollte mit `eyJ...` beginnen (JWT Token)

2. **Prüfe ob Policies existieren:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'file_metadata';
   ```
   Sollte mindestens eine Policy zurückgeben.

3. **Prüfe ob RLS aktiviert ist:**
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE tablename IN ('file_metadata', 'shares');
   ```
   `rowsecurity` sollte `true` sein.

4. **Prüfe die Server-Logs** im Terminal für weitere Fehlermeldungen

