# E-Mail-Verifizierung Setup-Anleitung

**Datum:** 26. November 2025  
**Status:** ✅ Implementiert

## ✅ Implementierung abgeschlossen

E-Mail-Verifizierung wurde erfolgreich implementiert. Neue Benutzer müssen ihre E-Mail-Adresse verifizieren, bevor sie alle Funktionen nutzen können.

## 📋 Schritt 1: Datenbank-Migration

Führen Sie das SQL-Script aus, um die notwendigen Tabellen und Spalten zu erstellen:

```sql
-- Führen Sie sql/add-email-verification.sql in Supabase aus
```

**Oder manuell in Supabase Dashboard:**
1. Gehen Sie zu **SQL Editor** in Supabase
2. Öffnen Sie `sql/add-email-verification.sql`
3. Führen Sie das Script aus

## 📧 Schritt 2: E-Mail-Konfiguration

### Supabase SMTP konfigurieren

**Wichtig:** Supabase's eingebauter E-Mail-Service ist nur für Entwicklung/Testing gedacht und hat starke Einschränkungen:
- Nur für Projektmitglieder (Benutzer in Ihrer Supabase-Organisation)
- Strenge Rate-Limits
- Keine Garantie für Zustellung
- Nicht für Produktion empfohlen

**Für Produktion müssen Sie Custom SMTP in Supabase konfigurieren:**

1. **Supabase Dashboard öffnen:**
   - Gehen Sie zu: https://supabase.com/dashboard
   - Wählen Sie Ihr Projekt

2. **SMTP konfigurieren:**
   - Gehen Sie zu **Settings** → **Auth** → **SMTP Settings**
   - Aktivieren Sie **Enable Custom SMTP**
   - Geben Sie Ihre SMTP-Credentials ein:
     - **SMTP Host**: z.B. `smtp.gmail.com` oder Ihr SMTP-Server
     - **SMTP Port**: z.B. `587` (TLS) oder `465` (SSL)
     - **SMTP User**: Ihre E-Mail-Adresse
     - **SMTP Password**: Ihr E-Mail-Passwort oder App-Passwort
     - **Sender Email**: Die Absender-E-Mail-Adresse
     - **Sender Name**: z.B. "StudyDocs"

**Empfohlene SMTP-Provider:**

- **Gmail**: 
  - Host: `smtp.gmail.com`, Port: `587`
  - Verwenden Sie ein **App-Passwort** (nicht Ihr normales Passwort)
  - Erstellen Sie ein App-Passwort: https://myaccount.google.com/apppasswords

- **SendGrid**: 
  - Host: `smtp.sendgrid.net`, Port: `587`
  - Kostenloser Plan verfügbar

- **Mailgun**: 
  - Host: `smtp.mailgun.org`, Port: `587`
  - Kostenloser Plan verfügbar

- **AWS SES**: 
  - Siehe AWS SES Dokumentation für Setup

## 🔧 Schritt 3: Environment Variables

Fügen Sie folgende Variable zu Ihrer `.env.local` hinzu:

```env
# Base URL for verification links
NEXT_PUBLIC_APP_URL=https://study-docs-beryl.vercel.app
# Oder für lokale Entwicklung:
# NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Für Vercel:**
- Fügen Sie `NEXT_PUBLIC_APP_URL` zu den Environment Variables hinzu
- Wert: `https://study-docs-beryl.vercel.app` (oder Ihre Domain)

## ✅ Funktionsweise

### Registrierung:
1. Benutzer registriert sich
2. Verifizierungs-Token wird generiert (24h gültig)
3. Verifizierungs-E-Mail wird automatisch gesendet
4. Benutzer kann sich anmelden, sieht aber ein Banner zur Verifizierung

### Verifizierung:
1. Benutzer klickt auf Link in E-Mail
2. Token wird validiert
3. `email_verified` wird auf `true` gesetzt
4. Banner verschwindet

### "E-Mail erneut senden":
1. Benutzer klickt auf "E-Mail erneut senden" im Banner
2. Neuer Token wird generiert
3. Neue E-Mail wird gesendet

## 🎨 UI-Features

- **Verifizierungs-Banner**: Erscheint oben im File Manager, wenn E-Mail nicht verifiziert ist
- **"E-Mail erneut senden" Button**: Im Banner verfügbar
- **Verifizierungs-Seite**: `/verify-email?token=...` für Token-Verifizierung
- **Mehrsprachig**: Unterstützt Deutsch und Englisch

## 🔒 Sicherheit

- **Token-Expiry**: Tokens sind 24 Stunden gültig
- **Einmalige Verwendung**: Tokens werden nach Verwendung als "used" markiert
- **Automatische Bereinigung**: Alte Tokens können automatisch bereinigt werden
- **Rate Limiting**: Verhindert Spam (bereits implementiert)

## 📝 API-Endpoints

### POST `/api/auth/send-verification-email`
Sendet eine neue Verifizierungs-E-Mail an den eingeloggten Benutzer.

**Request:**
```json
{
  "language": "de" // optional, "de" or "en"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verifizierungs-E-Mail wurde gesendet"
}
```

### GET/POST `/api/auth/verify-email?token=...`
Verifiziert eine E-Mail-Adresse mit einem Token.

**Response:**
```json
{
  "success": true,
  "message": "E-Mail-Adresse wurde erfolgreich verifiziert"
}
```

## 🧪 Testing

### Lokale Entwicklung:
1. Starten Sie den Dev-Server: `npm run dev`
2. Registrieren Sie einen neuen Benutzer
3. **E-Mails werden in der Konsole geloggt** (siehe Terminal-Output)
4. Kopieren Sie den Verifizierungs-Link aus der Konsole
5. Öffnen Sie den Link im Browser, um die Verifizierung zu testen

### Production:
1. **Wichtig**: Konfigurieren Sie SMTP in Supabase Dashboard:
   - Settings → Auth → SMTP Settings
   - Aktivieren Sie "Enable Custom SMTP"
   - Geben Sie Ihre SMTP-Credentials ein
2. Registrieren Sie einen Test-Benutzer
3. Prüfen Sie das E-Mail-Postfach
4. Klicken Sie auf den Verifizierungs-Link
5. Banner sollte verschwinden

## ⚠️ Wichtige Hinweise

1. **SMTP muss in Supabase konfiguriert sein**: 
   - Ohne SMTP-Konfiguration in Supabase Dashboard werden keine E-Mails gesendet
   - In Development-Mode werden E-Mails nur geloggt (siehe Konsole)
   - Für Produktion: **Settings → Auth → SMTP Settings** in Supabase Dashboard konfigurieren

2. **Base URL**: `NEXT_PUBLIC_APP_URL` muss korrekt gesetzt sein für Verifizierungs-Links

3. **Token-Expiry**: Tokens sind 24 Stunden gültig

4. **Bestehende Benutzer**: Können optional auf `email_verified = true` gesetzt werden (siehe SQL-Script)

5. **Development vs. Production**:
   - **Development**: E-Mails werden in der Konsole geloggt
   - **Production**: E-Mails werden nur gesendet, wenn SMTP in Supabase konfiguriert ist

## 🔄 Migration bestehender Benutzer

Falls Sie bestehende Benutzer haben, die bereits verifiziert sein sollen:

```sql
-- Alle bestehenden Benutzer als verifiziert markieren
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;
```

## 📚 Weitere Informationen

- **Supabase SMTP Setup**: https://supabase.com/docs/guides/auth/auth-smtp
- **Supabase Email Limits**: Der eingebaute E-Mail-Service ist nur für Entwicklung gedacht
- **SMTP Provider Empfehlungen**: 
  - SendGrid (kostenloser Plan): https://sendgrid.com
  - Mailgun (kostenloser Plan): https://www.mailgun.com
  - Gmail (mit App-Passwort): https://myaccount.google.com/apppasswords

