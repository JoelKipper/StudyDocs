# Service Role Key einrichten - WICHTIG!

## Problem
Fehler: "new row violates row-level security policy"

**Ursache:** Der `SUPABASE_SERVICE_ROLE_KEY` ist nicht in der `.env.local` Datei gesetzt. Der Code verwendet dann den Anon Key, der RLS Policies respektiert.

## Lösung: Service Role Key hinzufügen

### Schritt 1: Service Role Key kopieren

1. Gehe zu: https://supabase.com/dashboard
2. Wähle dein Projekt aus
3. Gehe zu **Settings** > **API**
4. Scrolle nach unten zu **Project API keys**
5. Kopiere den **service_role** Key (NICHT den anon key!)
   - Der Service Role Key beginnt normalerweise mit `eyJ...`
   - Er ist viel länger als der Anon Key
   - **WICHTIG:** Dieser Key hat volle Berechtigung - niemals im Client-Code verwenden!

### Schritt 2: Service Role Key zu .env.local hinzufügen

1. Öffne die Datei `.env.local` in deinem Projekt
2. Füge folgende Zeile hinzu (ersetze `dein-service-role-key-hier` mit dem kopierten Key):

```env
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key-hier
```

3. Speichere die Datei

### Schritt 3: Server neu starten

**WICHTIG:** Nach dem Hinzufügen des Service Role Keys, musst du den Server neu starten:

```bash
# Stoppe den Server (Ctrl+C) und starte neu:
npm run dev
```

### Schritt 4: Testen

Versuche jetzt eine Datei hochzuladen. Der Fehler sollte verschwunden sein.

## Warum ist das wichtig?

- **Anon Key**: Respektiert RLS Policies → Blockiert Operationen wenn Policies zu restriktiv sind
- **Service Role Key**: Umgeht RLS Policies → Erlaubt alle Operationen (sicher für Server-seitige Verwendung)

Da wir den Service Role Key für Server-seitige Operationen verwenden, müssen wir ihn in der `.env.local` Datei haben.

## Sicherheitshinweis

⚠️ **WICHTIG:** Der Service Role Key hat volle Berechtigung auf deine Supabase-Datenbank. 

- ✅ **Sicher:** In `.env.local` (wird nicht committed)
- ✅ **Sicher:** Nur in Server-seitigem Code verwenden
- ❌ **NICHT SICHER:** Im Client-Code (Browser) verwenden
- ❌ **NICHT SICHER:** In Git committen

## Prüfen ob es funktioniert

Nach dem Neustart des Servers, prüfe die Server-Logs. Du solltest keine Fehler mehr sehen.

Falls der Fehler weiterhin auftritt:

1. **Prüfe ob der Key korrekt gesetzt ist:**
   ```bash
   grep SUPABASE_SERVICE_ROLE_KEY .env.local
   ```
   Sollte eine Zeile mit dem Key zurückgeben.

2. **Prüfe ob der Server neu gestartet wurde:**
   - Der Server muss neu gestartet werden, damit neue Umgebungsvariablen geladen werden

3. **Prüfe die Server-Logs** im Terminal für weitere Fehlermeldungen

