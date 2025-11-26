# CAPTCHA-Implementierung

**Datum:** 26. November 2025  
**Status:** ✅ Implementiert (reCAPTCHA v3)

## ✅ Aktuelle Implementierung: reCAPTCHA v3

reCAPTCHA v3 wurde erfolgreich integriert. Es ist **unsichtbar** und arbeitet im Hintergrund, um Bot-Angriffe zu verhindern.

**Siehe:** [RECAPTCHA_V3_SETUP.md](./RECAPTCHA_V3_SETUP.md) für Setup-Anleitung.

---

## 📦 Alternative: Math-Captcha (verfügbar, aber nicht aktiv)

Ein einfaches, DSGVO-freundliches Math-Captcha wurde implementiert, das keine externen Dienste benötigt. Es ist im Code vorhanden, wird aber aktuell nicht verwendet.

### Vorteile:
- ✅ **DSGVO-konform**: Keine Datenübertragung an externe Dienste
- ✅ **Keine Abhängigkeiten**: Funktioniert ohne externe APIs
- ✅ **Einfach zu verwenden**: Benutzer lösen eine einfache Rechenaufgabe
- ✅ **Mehrsprachig**: Unterstützt Deutsch und Englisch
- ✅ **Barrierefrei**: Einfache Aufgaben (Addition, Subtraktion, Multiplikation)

### Funktionsweise:

1. **Client-seitig**: 
   - Math-Captcha-Komponente generiert eine zufällige Rechenaufgabe
   - Benutzer gibt die Antwort ein
   - Validierung erfolgt in Echtzeit

2. **Server-seitig** (optional):
   - Kann zusätzlich serverseitig validiert werden
   - Aktuell nur client-seitige Validierung

### Implementierte Dateien:

- `lib/captcha.ts` - Captcha-Utilities (Math-Captcha + reCAPTCHA v3 Support)
- `components/MathCaptcha.tsx` - Math-Captcha-Komponente
- `components/LoginForm.tsx` - Integration in Login/Register-Formular

### Verwendung:

Das Math-Captcha wird automatisch im Login- und Registrierungsformular angezeigt. Der Submit-Button ist deaktiviert, bis die Rechenaufgabe korrekt gelöst wurde.

## 🔄 Alternative: reCAPTCHA v3

Für eine unsichtbare Lösung kann reCAPTCHA v3 verwendet werden:

### Setup:

1. **Google reCAPTCHA Keys erhalten:**
   - https://www.google.com/recaptcha/admin
   - Site Key (öffentlich) und Secret Key (privat)

2. **Environment Variables:**
   ```env
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-site-key
   RECAPTCHA_SECRET_KEY=your-secret-key
   ```

3. **Integration:**
   - Die Funktion `verifyRecaptcha()` ist bereits in `lib/captcha.ts` implementiert
   - Kann in den API-Routes verwendet werden

### Beispiel-Integration (optional):

```typescript
// In app/api/auth/login/route.ts
import { verifyRecaptcha } from '@/lib/captcha';

// Im POST-Handler:
const recaptchaToken = body.recaptchaToken;
if (recaptchaToken) {
  const recaptchaResult = await verifyRecaptcha(
    recaptchaToken,
    process.env.RECAPTCHA_SECRET_KEY!
  );
  
  if (!recaptchaResult.success) {
    return NextResponse.json(
      { error: 'reCAPTCHA-Verifizierung fehlgeschlagen' },
      { status: 400 }
    );
  }
}
```

## 📊 Vergleich

| Feature | Math-Captcha | reCAPTCHA v3 |
|---------|-------------|--------------|
| DSGVO-konform | ✅ Ja | ⚠️ Teilweise |
| Externe Dienste | ❌ Nein | ✅ Ja (Google) |
| Benutzerfreundlichkeit | ⚠️ Sichtbar | ✅ Unsichtbar |
| Setup-Aufwand | ✅ Minimal | ⚠️ Keys erforderlich |
| Kosten | ✅ Kostenlos | ✅ Kostenlos |
| Bot-Schutz | ✅ Gut | ✅ Sehr gut |

## ✅ Aktuelle Implementierung

**Math-Captcha** ist aktiv und funktioniert in Login- und Registrierungsformularen.

### Features:
- ✅ Zufällige Rechenaufgaben (Addition, Subtraktion, Multiplikation)
- ✅ Echtzeit-Validierung
- ✅ Refresh-Button für neue Aufgabe
- ✅ Mehrsprachig (DE/EN)
- ✅ Dark Mode Support
- ✅ Barrierefrei

### Nächste Schritte (optional):

1. **Server-seitige Validierung hinzufügen** (zusätzliche Sicherheit)
2. **reCAPTCHA v3 als Alternative** (für unsichtbare Lösung)
3. **Captcha-Schwierigkeit anpassen** (aktuell: einfache Aufgaben)

