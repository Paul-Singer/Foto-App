// --- Plugins importieren ---
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { PhotoEditor } from '@capawesome/capacitor-photo-editor';

// --- HTML-Elemente holen ---
const galerieContainer = document.getElementById('gallery');
const kameraKnopf = document.getElementById('cameraBtn');
const ladeBildschirm = document.getElementById('loadingIndicator');
const ladeText = document.getElementById('loadingMessage');

// Elemente für das Detail-Fenster (Modal)
const fotoModal = document.getElementById('photoModal');
const schliessenKnopf = document.getElementById('closeModal');
const modalBild = document.getElementById('modalImage');

// Buttons im Modal
const bearbeitenKnopf = document.getElementById('editBtn');
const loeschenKnopf = document.getElementById('deleteBtn');

// --- Variablen für die App ---
const SPEICHER_SCHLUESSEL = 'photos';
let fotoListe = []; // Hier drin merken wir uns alle Fotos
let aktuellesFoto = null; // Das Foto, das gerade groß angezeigt wird

// --- Start der App ---
async function startApp() {
    console.log('App wird gestartet...');
    await fotosLaden();
}

// --- Kamera-Berechtigung abfragen ---
async function berechtigungPruefen() {
    try {
        const status = await Camera.checkPermissions();

        if (status.camera !== 'granted') {
            const anfrage = await Camera.requestPermissions({
                permissions: ['camera']
            });

            if (anfrage.camera !== 'granted') {
                alert('Die App braucht Zugriff auf die Kamera, um Fotos zu machen.');
                return false;
            }
        }
        return true;
    } catch (fehler) {
        console.error('Fehler bei der Berechtigung:', fehler);
        return false;
    }
}

// --- Foto aufnehmen und speichern ---
async function fotoAufnehmen() {
    const erlaubt = await berechtigungPruefen();
    if (!erlaubt) return;

    try {
        const bild = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera
        });

        ladeAnzeigen('Foto wird gespeichert...');

        const zeitstempel = Date.now();
        const dateiName = `foto_${zeitstempel}.jpg`;
        const aufnahmeDatum = new Date().toISOString();

        // Das Bild als Datei auf dem Handy speichern
        await Filesystem.writeFile({
            path: dateiName,
            data: bild.base64String,
            directory: Directory.Data
        });

        // Neues Foto-Objekt erstellen
        const neuesFoto = {
            fileName: dateiName,
            date: aufnahmeDatum,
            updatedAt: zeitstempel // Wichtig für den Cache-Schutz
        };

        // Neues Foto oben in die Liste packen
        fotoListe.unshift(neuesFoto);

        await listeSpeichern();
        await galerieAnzeigen();

    } catch (fehler) {
        console.error('Fehler beim Fotografieren:', fehler);
    } finally {
        ladeVerstecken();
    }
}

// --- Fotoliste dauerhaft auf dem Handy speichern ---
async function listeSpeichern() {
    await Preferences.set({
        key: SPEICHER_SCHLUESSEL,
        value: JSON.stringify(fotoListe)
    });
}

// --- Fotos aus dem Speicher laden und in die Galerie packen ---
async function fotosLaden() {
    ladeAnzeigen('Fotos werden geladen...');
    try {
        const daten = await Preferences.get({ key: SPEICHER_SCHLUESSEL });
        fotoListe = daten.value ? JSON.parse(daten.value) : [];

        // Neueste Fotos zuerst anzeigen (nach Datum sortieren)
        fotoListe.sort((a, b) => new Date(b.date) - new Date(a.date));

        await galerieAnzeigen();
    } catch (fehler) {
        console.error('Fehler beim Laden der Liste:', fehler);
    } finally {
        ladeVerstecken();
    }
}

// --- Die Galerie auf der HTML-Seite aufbauen ---
async function galerieAnzeigen() {
    galerieContainer.innerHTML = '';

    if (fotoListe.length === 0) {
        galerieContainer.innerHTML = '<p style="grid-column: span 3; text-align: center; padding: 20px;">Noch keine Fotos da.</p>';
        return;
    }

    for (const foto of fotoListe) {
        try {
            const dateiInfo = await Filesystem.getUri({
                directory: Directory.Data,
                path: foto.fileName
            });

            // Pfad für die Anzeige umwandeln und Cache-Schutz anhängen
            const bildUrl = `${Capacitor.convertFileSrc(dateiInfo.uri)}?v=${foto.updatedAt || Date.now()}`;

            // Container für das Bild erstellen
            const element = document.createElement('div');
            element.className = 'gallery-item';

            const bildVorschau = document.createElement('img');
            bildVorschau.src = bildUrl;
            bildVorschau.alt = 'Foto';
            bildVorschau.onclick = () => detailAnsichtOeffnen(foto, bildUrl);

            element.appendChild(bildVorschau);
            galerieContainer.appendChild(element);
        } catch (e) {
            console.error('Bild konnte nicht geladen werden:', foto.fileName);
        }
    }
}

// --- Ein Foto groß anzeigen ---
async function detailAnsichtOeffnen(foto, url) {
    aktuellesFoto = foto;
    modalBild.src = url;

    // Nur unter Android zeigen wir den Bearbeiten-Button an
    if (Capacitor.getPlatform() === 'android') {
        bearbeitenKnopf.classList.remove('hidden');
    } else {
        bearbeitenKnopf.classList.add('hidden');
    }

    fotoModal.classList.remove('hidden');
}

function detailAnsichtSchliessen() {
    fotoModal.classList.add('hidden');
    aktuellesFoto = null;
}

// --- Foto mit dem nativen Editor bearbeiten (nur Android) ---
async function fotoBearbeiten() {
    if (!aktuellesFoto) return;

    if (Capacitor.getPlatform() !== 'android') {
        alert('Bearbeiten geht nur auf Android.');
        return;
    }

    try {
        const dateiInfo = await Filesystem.getUri({
            directory: Directory.Data,
            path: aktuellesFoto.fileName
        });

        // Editor öffnen
        await PhotoEditor.editPhoto({
            path: dateiInfo.uri
        });

        ladeAnzeigen('Galerie wird aktualisiert...');

        // Zeitstempel ändern, damit das Handy das Bild neu lädt (Cache-Busting)
        aktuellesFoto.updatedAt = Date.now();

        await listeSpeichern();
        await galerieAnzeigen();

        // Auch das Bild im Modal aktualisieren
        const neueUrl = `${Capacitor.convertFileSrc(dateiInfo.uri)}?v=${aktuellesFoto.updatedAt}`;
        await detailAnsichtOeffnen(aktuellesFoto, neueUrl);

    } catch (fehler) {
        console.error('Fehler beim Bearbeiten:', fehler);
        alert('Das Bild konnte nicht bearbeitet werden.');
    } finally {
        ladeVerstecken();
    }
}

// --- Foto löschen ---
async function fotoLoeschen() {
    if (!aktuellesFoto) return;

    if (!confirm('Willst du dieses Foto wirklich löschen?')) return;

    ladeAnzeigen('Foto wird gelöscht...');
    try {
        // Datei vom Handy löschen
        await Filesystem.deleteFile({
            path: aktuellesFoto.fileName,
            directory: Directory.Data
        });

        // Foto aus unserer Liste entfernen
        fotoListe = fotoListe.filter(f => f.fileName !== aktuellesFoto.fileName);

        await listeSpeichern();
        await galerieAnzeigen();
        detailAnsichtSchliessen();

    } catch (fehler) {
        console.error('Fehler beim Löschen:', fehler);
        alert('Das Bild konnte nicht gelöscht werden.');
    } finally {
        ladeVerstecken();
    }
}

// --- Hilfsfunktionen für den Lade-Bildschirm ---
function ladeAnzeigen(nachricht = 'Bitte warten...') {
    ladeText.textContent = nachricht;
    ladeBildschirm.classList.remove('hidden');
}

function ladeVerstecken() {
    ladeBildschirm.classList.add('hidden');
}

// --- Klick-Ereignisse (Event Listener) festlegen ---
kameraKnopf.onclick = () => fotoAufnehmen();
schliessenKnopf.onclick = () => detailAnsichtSchliessen();
bearbeitenKnopf.onclick = () => fotoBearbeiten();
loeschenKnopf.onclick = () => fotoLoeschen();

// Modal schießen, wenn man daneben klickt
window.onclick = (event) => {
    if (event.target === fotoModal) {
        detailAnsichtSchliessen();
    }
};

// Startschuss für die App
startApp();
