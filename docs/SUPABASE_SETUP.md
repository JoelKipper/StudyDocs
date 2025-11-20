# Supabase Setup Anleitung

## 1. Umgebungsvariablen einrichten

Erstelle eine `.env.local` Datei im Root-Verzeichnis des Projekts mit folgendem Inhalt:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://okvgxjgmqthplfamoolu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rdmd4amdtcXRocGxmYW1vb2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODQwMzIsImV4cCI6MjA3OTA2MDAzMn0.yT4mtckE-_lQ-WEJlh6nDNDyt73Lh7nsv_4LEzCbWG0

# JWT Secret (für Token-Signierung)
JWT_SECRET=your-secret-key-change-in-production

# Database Connection (optional)
DATABASE_URL=postgresql://postgres:o2FdYKuDznCnPugVOw6m@db.okvgxjgmqthplfamoolu.supabase.co:5432/postgres
```

## 2. Datenbank-Schema erstellen

1. Öffne dein Supabase Dashboard: https://supabase.com/dashboard
2. Gehe zu deinem Projekt
3. Navigiere zu "SQL Editor"
4. Führe das SQL-Script aus `supabase-schema.sql` aus:

```sql
-- Create users table in Supabase
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (true);

-- Create policy to allow insert (registration)
CREATE POLICY "Allow public registration" ON users
  FOR INSERT
  WITH CHECK (true);
```

## 3. Row Level Security (RLS) anpassen

**WICHTIG:** Die aktuellen Policies erlauben öffentlichen Zugriff. Für Produktion solltest du diese einschränken:

1. Gehe zu "Authentication" > "Policies" in deinem Supabase Dashboard
2. Passe die Policies an, um nur authentifizierte Benutzer zuzulassen
3. Oder verwende den Service Role Key für Server-seitige Operationen

## 4. Server neu starten

Nach dem Einrichten der Umgebungsvariablen:

```bash
npm run dev
```

## 5. Testen

1. Registriere einen neuen Benutzer
2. Melde dich mit den gleichen Daten an
3. Die Daten sollten jetzt in Supabase gespeichert sein

## Troubleshooting

- **Fehler: "Missing Supabase environment variables"**: Stelle sicher, dass `.env.local` existiert und die Variablen korrekt gesetzt sind
- **Fehler beim Registrieren**: Überprüfe, ob die `users` Tabelle in Supabase existiert
- **RLS Fehler**: Passe die Row Level Security Policies in Supabase an

