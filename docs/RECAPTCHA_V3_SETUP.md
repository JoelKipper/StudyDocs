# reCAPTCHA v3 Setup-Anleitung

**Datum:** 26. November 2025  
**Status:** ✅ Implementiert und konfiguriert

## ✅ Implementierung abgeschlossen

reCAPTCHA v3 wurde erfolgreich integriert. Es ist **unsichtbar** und arbeitet im Hintergrund, um Bot-Angriffe zu verhindern.

## 🔑 Konfigurierte Keys

Die reCAPTCHA v3 Keys wurden bereits in `.env.local` hinzugefügt:

- ✅ `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - Konfiguriert
- ✅ `RECAPTCHA_SECRET_KEY` - Konfiguriert

## 🚀 Nächste Schritte

### 1. Lokale Entwicklung

Die Keys sind bereits in `.env.local` gesetzt. Starten Sie den Dev-Server neu:

```bash
npm run dev
```

reCAPTCHA v3 sollte jetzt funktionieren!

### 2. Vercel Deployment

**WICHTIG:** Fügen Sie die Keys auch in Vercel hinzu:

1. Gehen Sie zu Ihrem Vercel-Projekt: https://vercel.com/dashboard
2. Navigieren Sie zu **Settings** → **Environment Variables**
3. Fügen Sie beide Keys hinzu:
   - **Name**: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
     - **Value**: `6LcIaBksAAAAAAzmOutQSmTQRRZlCQAERmVNHMl9`
     - **Environment**: Production, Preview, Development
   - **Name**: `RECAPTCHA_SECRET_KEY`
     - **Value**: `6LcIaBksAAAAAF8qvmZX91SbODneAlq00pTaP3q6`
     - **Environment**: Production, Preview, Development
4. Klicken Sie auf **Save**
5. Führen Sie ein neues Deployment durch

### 3. Domains in Google reCAPTCHA konfigurieren

Stellen Sie sicher, dass folgende Domains in Ihrem Google reCAPTCHA v3 Dashboard registriert sind:

- ✅ `localhost` (für lokale Entwicklung)
- ✅ `study-docs-beryl.vercel.app` (für Vercel Deployment)
- ✅ Ihre eigene Domain (falls vorhanden)

**Hinweis:** Wenn eine Domain nicht registriert ist, funktioniert reCAPTCHA auf dieser Domain nicht.

## ✅ Funktionsweise

### Frontend (LoginForm):
- reCAPTCHA v3 läuft **unsichtbar** im Hintergrund
- Beim Absenden des Login/Register-Formulars wird automatisch ein Token generiert
- Der Token wird zusammen mit den Formulardaten an den Server gesendet

### Backend (API Routes):
- Der Server validiert den reCAPTCHA-Token mit Google
- Google gibt einen **Score** zurück (0.0 = Bot, 1.0 = Human)
- Standard-Schwellenwert: **0.5** (kann angepasst werden)
- Bei Score < 0.5 wird die Anfrage abgelehnt

## 🔧 Konfiguration

### Score-Schwellenwert anpassen:

In `app/api/auth/login/route.ts` und `app/api/auth/register/route.ts`:

```typescript
// Aktuell: 0.5
if (recaptchaResult.score !== undefined && recaptchaResult.score < 0.5) {
  // Anpassen auf z.B. 0.3 für weniger strikte Prüfung
  // oder 0.7 für strengere Prüfung
}
```

### Empfohlene Schwellenwerte:
- **0.3**: Weniger strikt (mehr Benutzer werden akzeptiert)
- **0.5**: Standard (ausgewogen) ✅ **Aktuell aktiv**
- **0.7**: Streng (nur sehr vertrauenswürdige Benutzer)

## 📊 Vorteile von reCAPTCHA v3

✅ **Unsichtbar**: Keine Interaktion erforderlich  
✅ **Bessere UX**: Benutzer sehen keine Captcha-Aufgaben  
✅ **Starke Bot-Erkennung**: Google's Machine Learning  
✅ **Score-basiert**: Flexibler als binäre Entscheidungen  
✅ **Kostenlos**: Für die meisten Anwendungsfälle kostenlos

## ⚠️ Wichtige Hinweise

### Sicherheit:
- Der **Site Key** ist öffentlich und kann im Client-Code verwendet werden ✅
- Der **Secret Key** ist privat und wird **NUR** serverseitig verwendet ✅
- Die Keys sind in `.env.local` gespeichert (wird nicht in Git committed) ✅

### Fallback-Verhalten:
- Wenn reCAPTCHA nicht verfügbar ist, funktioniert die Anwendung weiterhin
- Eine Warnung wird in der Konsole ausgegeben
- **Empfohlen**: Immer reCAPTCHA in Produktion aktivieren

## 🧪 Testing

### Testen lokal:
1. Starten Sie den Dev-Server: `npm run dev`
2. Öffnen Sie http://localhost:3000
3. Versuchen Sie sich anzumelden/zu registrieren
4. Überprüfen Sie die Browser-Konsole (F12) - sollte keine reCAPTCHA-Fehler zeigen
5. Überprüfen Sie die Server-Logs - sollte keine Validierungsfehler zeigen

### Testen auf Vercel:
1. Stellen Sie sicher, dass die Environment Variables in Vercel gesetzt sind
2. Führen Sie ein neues Deployment durch
3. Testen Sie Login/Register auf der Live-Website
4. Überprüfen Sie die Vercel-Logs auf Fehler

## 📚 Weitere Informationen

- [Google reCAPTCHA v3 Dokumentation](https://developers.google.com/recaptcha/docs/v3)
- [react-google-recaptcha-v3 Dokumentation](https://www.npmjs.com/package/react-google-recaptcha-v3)

## 🔄 Migration von Math-Captcha

Das Math-Captcha wurde durch reCAPTCHA v3 ersetzt. Die Math-Captcha-Komponente ist noch im Code vorhanden, wird aber nicht mehr verwendet. Sie kann bei Bedarf wieder aktiviert werden.
