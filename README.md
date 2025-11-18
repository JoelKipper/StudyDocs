# StudyDocs - Student File Manager

Eine Next.js-Anwendung für Studenten zur Verwaltung von Dateien in hierarchischen Verzeichnissen.

## Features

- 🔐 **Authentifizierung**: Registrierung und Anmeldung für Studenten
- 📁 **Hierarchische Verzeichnisse**: Erstellen und Verwalten von Verzeichnisstrukturen
- 📤 **Datei-Upload**: Hochladen von Dateien in beliebige Verzeichnisse
- 📥 **Datei-Download**: Herunterladen von Dateien
- 🗑️ **Datei-Löschung**: Löschen von Dateien und Verzeichnissen
- 🌳 **Verzeichnisbaum**: Übersichtliche Navigation durch die Verzeichnisstruktur

## Installation

1. Abhängigkeiten installieren:
```bash
npm install
```

2. Umgebungsvariablen (optional):
Erstellen Sie eine `.env.local` Datei mit:
```
JWT_SECRET=ihr-geheimer-schlüssel-hier
```

3. Entwicklungsserver starten:
```bash
npm run dev
```

Die Anwendung ist dann unter [http://localhost:3000](http://localhost:3000) verfügbar.

## Verwendung

1. **Registrierung**: Erstellen Sie ein neues Konto mit Name, E-Mail und Passwort
2. **Anmeldung**: Melden Sie sich mit Ihrer E-Mail und Ihrem Passwort an
3. **Verzeichnis erstellen**: Klicken Sie auf "Neues Verzeichnis" und geben Sie einen Namen ein
4. **Datei hochladen**: Klicken Sie auf "Datei hochladen" und wählen Sie eine Datei aus
5. **Navigation**: Klicken Sie auf Verzeichnisse, um hinein zu navigieren, oder verwenden Sie den Verzeichnisbaum in der Sidebar
6. **Dateien verwalten**: Laden Sie Dateien herunter oder löschen Sie sie mit den entsprechenden Buttons

## Technologie-Stack

- **Next.js 14** - React Framework
- **TypeScript** - Typsicherheit
- **Tailwind CSS** - Styling
- **JWT** - Authentifizierung
- **bcryptjs** - Passwort-Hashing
- **Node.js FileSystem** - Dateiverwaltung

## Projektstruktur

```
├── app/
│   ├── api/          # API Routes
│   ├── globals.css   # Globale Styles
│   ├── layout.tsx    # Root Layout
│   └── page.tsx      # Hauptseite
├── components/       # React Komponenten
├── lib/             # Utility Funktionen
└── user-data/       # Hochgeladene Dateien (wird automatisch erstellt)
```

## Hinweise

- Die Dateien werden lokal im `user-data` Verzeichnis gespeichert
- Jeder Benutzer hat sein eigenes Verzeichnis basierend auf seiner User-ID
- In einer Produktionsumgebung sollten Sie eine echte Datenbank für Benutzer verwenden
- Setzen Sie ein sicheres JWT_SECRET in der Produktion

