# Passwort-Schutz für Dateien und Ordner

## Übersicht

Diese Funktion ermöglicht es, einzelne Dateien und Ordner mit einem Passwort zu schützen. Geschützte Dateien werden mit AES-256-GCM verschlüsselt gespeichert.

## Installation

### 1. Datenbank-Migration ausführen

Führen Sie die SQL-Migration in Ihrem Supabase SQL Editor aus:

```sql
-- Siehe: migrations/add-password-protection.sql
ALTER TABLE file_metadata 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_file_metadata_password_hash 
ON file_metadata(password_hash) 
WHERE password_hash IS NOT NULL;
```

## Verwendung

### Passwort-Schutz aktivieren

1. Rechtsklick auf eine Datei oder einen Ordner
2. "Mit Passwort schützen" auswählen
3. Passwort eingeben und bestätigen (mindestens 4 Zeichen)
4. Die Datei/der Ordner wird verschlüsselt gespeichert

### Passwort-Schutz entfernen

1. Rechtsklick auf eine passwortgeschützte Datei/Ordner
2. "Passwort-Schutz entfernen" auswählen
3. Aktuelles Passwort eingeben
4. Der Schutz wird entfernt und die Datei wird entschlüsselt

### Geschützte Dateien/Ordner öffnen

1. Klick auf eine passwortgeschützte Datei/Ordner
2. Passwort eingeben
3. Die Datei/der Ordner wird entschlüsselt und geöffnet

### Geschützte Dateien herunterladen

1. Rechtsklick auf eine passwortgeschützte Datei
2. "Download" auswählen
3. Passwort eingeben
4. Die Datei wird entschlüsselt und heruntergeladen

## Technische Details

### Verschlüsselung

- **Algorithmus**: AES-256-GCM
- **Key Derivation**: PBKDF2 mit 100.000 Iterationen
- **Salt**: 16 Bytes (zufällig pro Datei)
- **IV**: 12 Bytes (zufällig pro Datei)
- **Authentifizierung**: GCM Auth Tag

### Passwort-Hashing

- **Algorithmus**: bcrypt (wie bei Benutzer-Passwörtern)
- **Rounds**: 10

### Sicherheit

- Passwörter werden niemals im Klartext gespeichert
- Jede Datei hat einen eigenen Salt und IV
- Passwort-Hashes werden in der Datenbank gespeichert
- Verschlüsselte Dateien können nur mit dem korrekten Passwort entschlüsselt werden

## API-Endpunkte

### POST `/api/files/password`

Setzt oder entfernt Passwort-Schutz.

**Body:**
```json
{
  "path": "path/to/file",
  "password": "user-password",
  "action": "set" | "remove" | "verify"
}
```

### GET `/api/files/password?path=...&password=...`

Lädt eine verschlüsselte Datei und entschlüsselt sie.

## UI-Indikatoren

- 🔒 Lock-Icon neben dem Dateinamen zeigt an, dass die Datei/der Ordner passwortgeschützt ist
- Gelbes Lock-Icon in der Dateiliste
- Passwort-Modal erscheint beim Öffnen/Download geschützter Dateien

## Hinweise

- **Wichtig**: Wenn Sie das Passwort vergessen, können Sie die Datei nicht mehr entschlüsseln!
- Passwortgeschützte Ordner können geöffnet werden, aber der Inhalt bleibt verschlüsselt
- Beim Verschieben/Kopieren passwortgeschützter Dateien bleibt der Schutz erhalten
- Bulk-Operationen mit passwortgeschützten Dateien erfordern möglicherweise Passwort-Eingabe

