# Projektdokumentation: FotoApp

## 1. Projektübersicht
Dieses Projekt umfasst die Entwicklung einer hybriden Mobilanwendung zur Verwaltung von Fotos. Die App wurde speziell nach den Anforderungen des Moduls App-Entwicklung (Wirtschaftsinformatik) entworfen und implementiert.

**Hauptziel:** Eine performante, leichtgewichtige und einfach zu wartende Anwendung für Android, die grundlegende Bildverarbeitungsfunktionen bereitstellt.

## 2. Technologische Entscheidung
Um eine maximale Transparenz des Codes zu gewährleisten und die Wartbarkeit zu erhöhen, wurde auf komplexe Frameworks wie Vue.js, Ionic oder Angular verzichtet. Stattdessen nutzt die App:

*   **Vanilla JavaScript (ES6+):** Direkte Logik-Implementierung ohne Framework-Overhead.
*   **Capacitor 8:** Als Brückentechnologie zum Zugriff auf native Android-APIs (Kamera, Speicher, Teilen).
*   **HTML5 & CSS3:** Für ein schlichtes, responsives Design mit modernem CSS-Grid (3-Spalten-Layout).
*   **Vite:** Als schneller Build-Tool-Bundler für die Web-Ressourcen.

## 3. Funktionsweise & Architektur
Die Anwendung folgt einem modularen Aufbau in einer einzigen logischen Ebene (`main.js`), um die Komplexität gering zu halten.

### Kernfunktionen:
1.  **Kamera-Integration:** Nutzt das `@capacitor/camera` Plugin. Fotos werden als `Base64` erfasst und direkt in das lokale App-Verzeichnis geschrieben (`writeFile`).
2.  **Dauerhafte Speicherung:** Die Liste der Dateipfade und Zeitstempel wird über `@capacitor/preferences` gespeichert, während die physischen Bilder im `Directory.Data` des Endgeräts liegen.
3.  **Aufnahmedatum:** Zu jedem Foto wird beim Speichern das Aufnahmedatum gespeichert und in der Detailansicht angezeigt.
4.  **Bildbearbeitung:** Unter Android wird der native Editor über das `@capawesome/capacitor-photo-editor` Plugin aufgerufen. Ein Cache-Busting-Mechanismus (`updatedAt`) stellt sicher, dass Änderungen sofort sichtbar sind.
5.  **Benutzerführung (UX):** Ein zentrales Lade-Overlay (`loading-overlay`) informiert den Nutzer bei asynchronen Operationen (Laden, Speichern, Löschen, Aktualisieren).

## 4. Erfüllung der Kriterien (Checkliste)

| Anforderung | Umsetzung |
| :--- | :--- |
| Android Support | Vollständig integriert und als Plattform konfiguriert. |
| Berechtigungen | Abfrage erfolgt explizit vor der ersten Kamera-Nutzung via `Camera.requestPermissions()`. |
| Galerieansicht | 3-spaltiges CSS-Grid, quadratische Thumbnails (`aspect-ratio: 1/1`). |
| Sortierung | Neueste Bilder werden nach Datum sortiert (`photos.sort()`) zuerst angezeigt. |
| Kamera-Button | Floating Action Button (FAB) mit Icon. |
| Sofort-Anzeige | Galerie wird direkt nach der Aufnahme neu gerendert. |
| Bearbeiten | Button in Detailansicht öffnet nativen Android-Editor inkl. Cache-Umgehung. |
| Löschen | Button in Detailansicht sowie Direkt-Löschen-Button in der Galerieansicht. |
| Teilen | Integration des `Share` Plugins für Android System-Dialoge. |

## 5. Installations- & Build-Anleitung

### Voraussetzungen
*   Node.js (LTS Version)
*   Android Studio & SDK
*   Capacitor CLI

### Build-Prozess
1.  **Abhängigkeiten installieren:** `npm install`
2.  **Web-Projekt bauen:** `npm run build`
3.  **Synchronisation mit Android:** `npx cap sync android`
4.  **Projekt in Android Studio öffnen:** `npx cap open android`

## 6. Fazit
Die FotoApp beweist, dass moderne Mobilanwendungen auch ohne massiven Framework-Einsatz professionell und funktionsreich umgesetzt werden können. Durch den Fokus auf Vanilla JS bleibt der Code für Studenten verständlich und wartbar. Breite und Höhe werden nicht ausgewertet, da dieser Zusatz für das Dreierteam nicht erforderlich ist.
