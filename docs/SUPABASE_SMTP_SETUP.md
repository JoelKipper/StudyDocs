# Supabase SMTP Setup für StudyDocs

**Datum:** 26. November 2025  
**Status:** Setup-Anleitung

## 📧 E-Mails über Supabase SMTP Server senden

StudyDocs kann die SMTP-Einstellungen verwenden, die Sie in Supabase Dashboard konfiguriert haben.

## ⚠️ Wichtiger Hinweis

**Supabase's eingebauter SMTP-Server hat Einschränkungen:**
- E-Mails können nur an autorisierte Adressen gesendet werden (typischerweise Projektmitglieder)
- Strenge Rate-Limits
- Keine Garantie für Zustellung
- **Nicht für Produktion empfohlen**

**Für Produktion:** Konfigurieren Sie Custom SMTP in Supabase Dashboard (siehe unten).

## 🔧 Setup: Supabase SMTP verwenden

### Schritt 1: SMTP in Supabase Dashboard konfigurieren

1. **Supabase Dashboard öffnen:**
   - Gehen Sie zu: https://supabase.com/dashboard
   - Wählen Sie Ihr Projekt

2. **SMTP konfigurieren:**
   - Gehen Sie zu **Settings** → **Auth** → **SMTP Settings**
   - Aktivieren Sie **Enable Custom SMTP** (für Produktion empfohlen)
   - Oder verwenden Sie den Standard-SMTP-Server (nur für Testing)

3. **SMTP-Einstellungen eingeben:**
   - **SMTP Host**: z.B. `smtp.gmail.com`
   - **SMTP Port**: z.B. `587` (TLS) oder `465` (SSL)
   - **SMTP User**: Ihre E-Mail-Adresse
   - **SMTP Password**: Ihr E-Mail-Passwort oder App-Passwort
   - **Sender Email**: Die Absender-E-Mail-Adresse
   - **Sender Name**: z.B. "StudyDocs"

### Schritt 2: SMTP-Einstellungen in Environment Variables kopieren

**Wichtig:** Supabase macht die SMTP-Einstellungen nicht direkt über die API verfügbar. Sie müssen die **gleichen Werte** aus Supabase Dashboard in Environment Variables kopieren.

**Lokal (`.env.local`):**
```env
# Kopieren Sie diese Werte aus Supabase Dashboard → Settings → Auth → SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ihre-email@gmail.com
SMTP_PASSWORD=ihr-app-passwort
SMTP_FROM=ihre-email@gmail.com
SMTP_FROM_NAME=StudyDocs
```

**Vercel (Environment Variables):**
1. Gehen Sie zu: https://vercel.com/dashboard
2. Wählen Sie Ihr Projekt
3. Settings → Environment Variables
4. Fügen Sie alle oben genannten Variablen hinzu
5. **Wichtig:** Verwenden Sie die **gleichen Werte** wie in Supabase Dashboard
6. Wählen Sie: Production, Preview, Development

### Schritt 3: Server neu starten

```bash
npm run dev
```

## 📋 Beispiel: Gmail mit Supabase SMTP

1. **In Supabase Dashboard konfigurieren:**
   - Settings → Auth → SMTP Settings
   - Enable Custom SMTP: ✅
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587`
   - SMTP User: `ihre-email@gmail.com`
   - SMTP Password: `xxxx xxxx xxxx xxxx` (Gmail App-Passwort)
   - Sender Email: `ihre-email@gmail.com`
   - Sender Name: `StudyDocs`

2. **In Environment Variables kopieren:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=ihre-email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx
   SMTP_FROM=ihre-email@gmail.com
   SMTP_FROM_NAME=StudyDocs
   ```

3. **Gmail App-Passwort erstellen:**
   - https://myaccount.google.com/apppasswords
   - "Mail" → "Andere (Benutzerdefiniert)" → "StudyDocs"
   - Verwenden Sie dieses App-Passwort sowohl in Supabase Dashboard als auch in Environment Variables

## 🧪 Testing

### Lokale Entwicklung:

1. **Ohne SMTP (Development Mode):**
   - E-Mails werden in der Konsole geloggt
   - Keine Konfiguration nötig
   - Kopieren Sie Links aus der Konsole

2. **Mit SMTP (für echtes Testing):**
   - Kopieren Sie SMTP-Einstellungen aus Supabase Dashboard zu `.env.local`
   - Starten Sie den Server neu: `npm run dev`
   - E-Mails werden jetzt wirklich gesendet

### Production:

1. **Supabase Dashboard:**
   - Konfigurieren Sie Custom SMTP (Settings → Auth → SMTP Settings)

2. **Vercel Environment Variables:**
   - Kopieren Sie die **gleichen SMTP-Werte** aus Supabase Dashboard
   - Neues Deployment durchführen

3. **Testen:**
   - Registrieren Sie einen Test-Benutzer
   - Prüfen Sie das E-Mail-Postfach (auch Spam-Ordner)

## ⚠️ Wichtige Hinweise

1. **Gleiche Werte verwenden:**
   - Die SMTP-Einstellungen in Environment Variables müssen **identisch** mit denen in Supabase Dashboard sein
   - Wenn Sie in Supabase Dashboard etwas ändern, müssen Sie auch die Environment Variables aktualisieren

2. **Supabase Standard-SMTP:**
   - Funktioniert nur für autorisierte E-Mail-Adressen (Projektmitglieder)
   - Nicht für Produktion empfohlen
   - Für Produktion: Custom SMTP konfigurieren

3. **Gmail App-Passwort:**
   - Verwenden Sie **NICHT** Ihr normales Gmail-Passwort
   - Erstellen Sie ein App-Passwort: https://myaccount.google.com/apppasswords
   - 2-Faktor-Authentifizierung muss aktiviert sein
   - Verwenden Sie das App-Passwort sowohl in Supabase Dashboard als auch in Environment Variables

4. **Spam-Ordner:**
   - E-Mails können im Spam-Ordner landen
   - Bitten Sie Benutzer, den Spam-Ordner zu prüfen
   - Für bessere Zustellung: SPF, DKIM, DMARC konfigurieren

## 🔄 Warum müssen wir die Werte kopieren?

Supabase macht die SMTP-Einstellungen aus dem Dashboard nicht direkt über die API verfügbar. Daher müssen wir die gleichen Werte in Environment Variables setzen, damit `nodemailer` sie verwenden kann.

**Vorteil:** Sie konfigurieren SMTP einmal in Supabase Dashboard und kopieren die Werte in Environment Variables. Beide verwenden dann die gleichen SMTP-Einstellungen.

## 📝 Environment Variables Übersicht

```env
# Kopieren Sie diese Werte aus Supabase Dashboard → Settings → Auth → SMTP Settings
SMTP_HOST=smtp.gmail.com          # Aus Supabase Dashboard: SMTP Host
SMTP_PORT=587                     # Aus Supabase Dashboard: SMTP Port
SMTP_USER=ihre-email@gmail.com    # Aus Supabase Dashboard: SMTP User
SMTP_PASSWORD=ihr-passwort        # Aus Supabase Dashboard: SMTP Password
SMTP_FROM=ihre-email@gmail.com    # Aus Supabase Dashboard: Sender Email
SMTP_FROM_NAME=StudyDocs         # Aus Supabase Dashboard: Sender Name

# Base URL für Links in E-Mails
NEXT_PUBLIC_APP_URL=https://study-docs-beryl.vercel.app
```

## 🚀 Quick Start

1. **Supabase Dashboard:**
   - Settings → Auth → SMTP Settings
   - Konfigurieren Sie Custom SMTP (z.B. Gmail)

2. **Environment Variables:**
   - Kopieren Sie die SMTP-Werte aus Supabase Dashboard
   - Fügen Sie sie zu `.env.local` (lokal) und Vercel (production) hinzu

3. **Server neu starten:**
   ```bash
   npm run dev
   ```

4. **Testen:**
   - Registrieren Sie einen Test-Benutzer
   - E-Mail sollte gesendet werden

## 📚 Weitere Informationen

- **Supabase SMTP Dokumentation**: https://supabase.com/docs/guides/auth/auth-smtp
- **Gmail App-Passwörter**: https://support.google.com/accounts/answer/185833
- **Supabase Auth API**: https://supabase.com/docs/reference/javascript/auth-admin-api

