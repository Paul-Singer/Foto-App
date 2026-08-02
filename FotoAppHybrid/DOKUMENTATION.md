# Projektdokumentation: FotoAppHybrid

## 1. Projektübersicht
Dieses Projekt umfasst die Entwicklung einer hybriden Mobilanwendung zur Verwaltung von Fotos. Die App wurde speziell nach den Anforderungen des Moduls App-Entwicklung (Wirtschaftsinformatik) entworfen und implementiert.

**Hauptziel:** Eine performante, leichtgewichtige und einfach zu wartende Anwendung für Android und iOS, die grundlegende Bildverarbeitungsfunktionen bereitstellt.

## 2. Technologische Entscheidung
Um eine maximale Transparenz des Codes zu gewährleisten und die Wartbarkeit für Nicht-Programmierer zu erhöhen, wurde auf komplexe Frameworks wie Vue.js oder Ionic-Templates verzichtet. Stattdessen nutzt die App:

*   **Vanilla JavaScript (ES6+):** Direkte Logik-Implementierung ohne Framework-Overhead.
*   **Capacitor 8:** Als Brückentechnologie zum Zugriff auf native Hardware-APIs (Kamera, Speicher).
*   **HTML5 & CSS3:** Für ein schlichtes, responsives Design mit modernem CSS-Grid (3-Spalten-Layout).
*   **Vite:** Als schneller Build-Tool-Bundler für die Web-Ressourcen.

## 3. Funktionsweise & Architektur
Die Anwendung folgt einem modularen Aufbau in einer einzigen logischen Ebene (`main.js`), um die Komplexität gering zu halten.

### Kernfunktionen:
1.  **Kamera-Integration:** Nutzt das `@capacitor/camera` Plugin. Fotos werden als `Base64` erfasst und direkt in das lokale App-Verzeichnis geschrieben (`writeFile`), um Kompatibilitätsprobleme mit Android 13+ zu vermeiden.
2.  **Dauerhafte Speicherung:** Die Liste der Dateipfade wird über `@capacitor/preferences` gespeichert, während die physischen Bilder im `Directory.Data` des Endgeräts liegen.
3.  **Metadaten-Verarbeitung:** Über das `@capawesome/capacitor-exif` Plugin werden Aufnahmedaten aus den Fotos ausgelesen und in der Detailansicht visualisiert.
4.  **Bildbearbeitung:** Unter Android wird der native Editor über das `@capawesome/capacitor-photo-editor` Plugin aufgerufen.
5.  **Benutzerführung (UX):** Ein zentrales Lade-Overlay (`loading-overlay`) informiert den Nutzer bei allen asynchronen Operationen (Laden, Speichern, Löschen).

## 4. Erfüllung der Kriterien (Checkliste)

| Anforderung | Umsetzung |
| :--- | :--- |
| Android/iOS Support | Durch Capacitor-Plattformen sichergestellt. |
| Berechtigungen | Abfrage erfolgt beim App-Start sowie explizit vor der Kamera-Nutzung (inkl. manueller Nutzerbestätigung) via `Camera.requestPermissions()`. |
| Galerieansicht | 3-spaltiges CSS-Grid, quadratische Thumbnails (`aspect-ratio: 1/1`). |
| Sortierung | Neueste Bilder werden mittels `unshift()` an den Anfang der Liste gesetzt. |
| Kamera-Button | Floating Action Button (FAB) mit Icon. |
| Sofort-Anzeige | DOM-Manipulation hängt neues Bild direkt in die Galerie ein. |
| Bearbeiten | Button in Detailansicht öffnet nativen Android-Editor. |
| Löschen | Button in Detailansicht sowie Direkt-Löschen-Button in der Galerieansicht. |
| Teilen | Integration des `Share` Plugins für System-Dialoge. |

## 5. Installations- & Build-Anleitung

### Voraussetzungen
*   Node.js (LTS Version)
*   Android Studio & SDK
*   Capacitor CLI

### Build-Prozess
1.  **Abhängigkeiten installieren:** `npm install`
2.  **Web-Projekt bauen:** `npm run build`
3.  **Synchronisation mit nativen Plattformen:** `npx cap sync`
4.  **App starten:** `npx cap run android`

## 6. Fazit
Die FotoAppHybrid beweist, dass moderne Mobilanwendungen auch ohne massiven Framework-Einsatz professionell und funktionsreich umgesetzt werden können. Durch den Fokus auf Vanilla JS bleibt die App für Studenten der Wirtschaftsinformatik verständlich und bietet gleichzeitig alle notwendigen Features einer modernen Foto-Management-Software.
