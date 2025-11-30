# E-Mail-Konfiguration für StudyDocs

**Datum:** 26. November 2025  
**Status:** Setup-Anleitung

## 📧 E-Mail-Versand konfigurieren

StudyDocs verwendet `nodemailer` zum Versand von E-Mails (Verifizierungs-E-Mails, Passwort-Reset, etc.).

**Wichtig:** Wenn Sie Supabase SMTP verwenden möchten, siehe `docs/SUPABASE_SMTP_SETUP.md` für Anleitung, wie Sie die SMTP-Einstellungen aus Supabase Dashboard kopieren.

## 🔧 Setup

### Option 1: SMTP mit Gmail (Empfohlen für schnellen Start)

1. **Gmail App-Passwort erstellen:**
   - Gehen Sie zu: https://myaccount.google.com/apppasswords
   - Wählen Sie "Mail" und "Andere (Benutzerdefiniert)"
   - Geben Sie "StudyDocs" ein
   - Kopieren Sie das generierte App-Passwort (16 Zeichen)

2. **Environment Variables hinzufügen:**

   **Lokal (`.env.local`):**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=ihre-email@gmail.com
   SMTP_PASSWORD=ihr-app-passwort-16-zeichen
   SMTP_FROM=ihre-email@gmail.com
   SMTP_FROM_NAME=StudyDocs
   ```

   **Vercel (Environment Variables):**
   - Gehen Sie zu: https://vercel.com/dashboard
   - Wählen Sie Ihr Projekt
   - Settings → Environment Variables
   - Fügen Sie alle oben genannten Variablen hinzu
   - Wählen Sie: Production, Preview, Development

### Option 2: SMTP mit SendGrid (Kostenloser Plan)

1. **SendGrid Account erstellen:**
   - Gehen Sie zu: https://sendgrid.com
   - Erstellen Sie einen kostenlosen Account
   - Verifizieren Sie Ihre E-Mail-Adresse

2. **API Key erstellen:**
   - Settings → API Keys
   - Create API Key
   - Name: "StudyDocs"
   - Permissions: "Full Access"
   - Kopieren Sie den API Key

3. **Environment Variables:**
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=ihr-sendgrid-api-key
   SMTP_FROM=ihre-verifizierte-email@ihre-domain.com
   SMTP_FROM_NAME=StudyDocs
   ```

### Option 3: SMTP mit Mailgun (Kostenloser Plan)

1. **Mailgun Account erstellen:**
   - Gehen Sie zu: https://www.mailgun.com
   - Erstellen Sie einen kostenlosen Account
   - Verifizieren Sie Ihre Domain

2. **SMTP Credentials:**
   - Dashboard → Sending → SMTP Credentials
   - Erstellen Sie neue SMTP Credentials

3. **Environment Variables:**
   ```env
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_USER=postmaster@ihre-domain.mailgun.org
   SMTP_PASSWORD=ihr-mailgun-smtp-password
   SMTP_FROM=noreply@ihre-domain.com
   SMTP_FROM_NAME=StudyDocs
   ```

### Option 4: Andere SMTP-Provider

Sie können jeden SMTP-Server verwenden. Beispiele:

**Outlook/Office 365:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=ihre-email@outlook.com
SMTP_PASSWORD=ihr-passwort
SMTP_FROM=ihre-email@outlook.com
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_USER=ihr-aws-access-key
SMTP_PASSWORD=ihr-aws-secret-key
SMTP_FROM=noreply@ihre-domain.com
```

## 🧪 Testing

### Lokale Entwicklung:

1. **Ohne SMTP (Development Mode):**
   - E-Mails werden in der Konsole geloggt
   - Keine Konfiguration nötig
   - Kopieren Sie Links aus der Konsole

2. **Mit SMTP (für echtes Testing):**
   - Fügen Sie SMTP-Variablen zu `.env.local` hinzu
   - Starten Sie den Server neu: `npm run dev`
   - E-Mails werden jetzt wirklich gesendet

### Production:

1. **Vercel Environment Variables setzen:**
   - Alle SMTP-Variablen hinzufügen
   - Neues Deployment durchführen

2. **Testen:**
   - Registrieren Sie einen Test-Benutzer
   - Prüfen Sie das E-Mail-Postfach (auch Spam-Ordner)
   - Klicken Sie auf den Verifizierungs-Link

## ⚠️ Wichtige Hinweise

1. **Gmail App-Passwort:**
   - Verwenden Sie **NICHT** Ihr normales Gmail-Passwort
   - Erstellen Sie ein App-Passwort: https://myaccount.google.com/apppasswords
   - 2-Faktor-Authentifizierung muss aktiviert sein

2. **SendGrid:**
   - Verifizieren Sie Ihre Absender-E-Mail-Adresse
   - Im kostenlosen Plan: 100 E-Mails/Tag

3. **Mailgun:**
   - Verifizieren Sie Ihre Domain
   - Im kostenlosen Plan: 5.000 E-Mails/Monat für 3 Monate, dann 1.000/Monat

4. **Spam-Ordner:**
   - E-Mails können im Spam-Ordner landen
   - Bitten Sie Benutzer, den Spam-Ordner zu prüfen
   - Für bessere Zustellung: SPF, DKIM, DMARC konfigurieren

5. **Rate Limits:**
   - Gmail: 500 E-Mails/Tag (kostenloser Account)
   - SendGrid: 100 E-Mails/Tag (kostenloser Plan)
   - Mailgun: Siehe oben

## 🔒 Sicherheit

- **Niemals SMTP-Credentials in Git committen**
- Verwenden Sie Environment Variables
- In Vercel: Environment Variables sind verschlüsselt
- Für Gmail: Verwenden Sie App-Passwörter, nicht das Hauptpasswort

## 📝 Environment Variables Übersicht

```env
# SMTP Configuration (optional - wenn nicht gesetzt, werden E-Mails nur geloggt)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ihre-email@gmail.com
SMTP_PASSWORD=ihr-app-passwort
SMTP_FROM=ihre-email@gmail.com
SMTP_FROM_NAME=StudyDocs

# Base URL für Links in E-Mails
NEXT_PUBLIC_APP_URL=https://study-docs-beryl.vercel.app
```

## 🚀 Quick Start (Gmail)

1. Erstellen Sie ein Gmail App-Passwort: https://myaccount.google.com/apppasswords
2. Fügen Sie zu `.env.local` hinzu:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=ihre-email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx
   SMTP_FROM=ihre-email@gmail.com
   SMTP_FROM_NAME=StudyDocs
   ```
3. Starten Sie den Server neu
4. Testen Sie die Registrierung

## 📚 Weitere Informationen

- **Nodemailer Dokumentation**: https://nodemailer.com
- **Gmail App-Passwörter**: https://support.google.com/accounts/answer/185833
- **SendGrid Setup**: https://docs.sendgrid.com/for-developers/sending-email/getting-started-smtp
- **Mailgun Setup**: https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp

