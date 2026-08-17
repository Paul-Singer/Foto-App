// --- Imports ---
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { PhotoEditor } from '@capawesome/capacitor-photo-editor';

// --- DOM-Elemente ---
const galleryContainer = document.getElementById('gallery');
const cameraBtn = document.getElementById('cameraBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingMessage = document.getElementById('loadingMessage');

// Modal-Elemente (Detailansicht)
const photoModal = document.getElementById('photoModal');
const closeModal = document.getElementById('closeModal');
const modalImage = document.getElementById('modalImage');

// Modal-Buttons
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');

// --- App-Zustand ---
const STORAGE_KEY = 'photos';
let photos = []; // Liste der gespeicherten Fotos
let currentPhoto = null; // Aktuell in der Detailansicht gewähltes Foto

// --- Initialisierung ---
async function initializeApp() {
    console.log('App initialisiert...');
    await loadPhotos();
}

// --- Kamera-Berechtigung ---
async function checkPermissions() {
    try {
        const status = await Camera.checkPermissions();

        // Falls Berechtigung fehlt, anfordern
        if (status.camera !== 'granted') {
            const requested = await Camera.requestPermissions({
                permissions: ['camera']
            });

            if (requested.camera !== 'granted') {
                alert('Kamera-Zugriff wird benötigt, um Fotos aufzunehmen.');
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Fehler bei Berechtigungsprüfung:', error);
        return false;
    }
}

// --- Foto aufnehmen und speichern ---
async function takePhoto() {
    const hasPermission = await checkPermissions();
    if (!hasPermission) return;

    try {
        const photo = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera
        });

        showLoading('Foto wird gespeichert...');

        const timestamp = Date.now();
        const fileName = `photo_${timestamp}.jpg`;
        const photoDate = new Date().toISOString();

        // Bilddatei im lokalen Dateisystem speichern
        await Filesystem.writeFile({
            path: fileName,
            data: photo.base64String,
            directory: Directory.Data
        });

        // Neues Foto-Objekt für die Liste erstellen
        const newPhoto = {
            fileName: fileName,
            date: photoDate,
            updatedAt: timestamp // Für Cache-Busting nach Bearbeitung
        };

        // Neues Foto am Anfang der Liste hinzufügen
        photos.unshift(newPhoto);

        await savePhotos();
        await renderGallery();

    } catch (error) {
        console.error('Fehler bei Fotoaufnahme:', error);
    } finally {
        hideLoading();
    }
}

// --- Fotoliste speichern ---
async function savePhotos() {
    await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(photos)
    });
}

// --- Fotos laden und Galerie rendern ---
async function loadPhotos() {
    showLoading('Fotos werden geladen...');
    try {
        const storedData = await Preferences.get({ key: STORAGE_KEY });
        photos = storedData.value ? JSON.parse(storedData.value) : [];

        // Neueste Fotos zuerst anzeigen (Sortierung nach Datum)
        photos.sort((a, b) => new Date(b.date) - new Date(a.date));

        await renderGallery();
    } catch (error) {
        console.error('Fehler beim Laden der Fotos:', error);
    } finally {
        hideLoading();
    }
}

// --- Galerie-HTML aufbauen ---
async function renderGallery() {
    galleryContainer.innerHTML = '';

    if (photos.length === 0) {
        galleryContainer.innerHTML = '<p style="grid-column: span 3; text-align: center; padding: 20px;">Keine Fotos vorhanden.</p>';
        return;
    }

    for (const photo of photos) {
        try {
            const fileUri = await Filesystem.getUri({
                directory: Directory.Data,
                path: photo.fileName
            });

            // WebView-Pfad umwandeln und Cache-Parameter anhängen
            const webSrc = `${Capacitor.convertFileSrc(fileUri.uri)}?v=${photo.updatedAt || Date.now()}`;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'gallery-item';

            const imgElement = document.createElement('img');
            imgElement.src = webSrc;
            imgElement.alt = 'Foto';
            imgElement.onclick = () => openDetail(photo, webSrc);

            itemDiv.appendChild(imgElement);
            galleryContainer.appendChild(itemDiv);
        } catch (error) {
            console.error('Fehler beim Laden des Bildes:', photo.fileName, error);
        }
    }
}

// --- Detailansicht öffnen ---
async function openDetail(photo, url) {
    currentPhoto = photo;
    modalImage.src = url;

    // Bildbearbeitung ist nur auf Android-Plattform verfügbar
    if (Capacitor.getPlatform() === 'android') {
        editBtn.classList.remove('hidden');
    } else {
        editBtn.classList.add('hidden');
    }

    photoModal.classList.remove('hidden');
}

// --- Detailansicht schließen ---
function closeDetail() {
    photoModal.classList.add('hidden');
    currentPhoto = null;
}

// --- Foto bearbeiten (Android) ---
async function editPhoto() {
    if (!currentPhoto) return;

    if (Capacitor.getPlatform() !== 'android') {
        alert('Bildbearbeitung nur unter Android verfügbar.');
        return;
    }

    try {
        const fileUri = await Filesystem.getUri({
            directory: Directory.Data,
            path: currentPhoto.fileName
        });

        // Nativen Foto-Editor öffnen
        await PhotoEditor.editPhoto({
            path: fileUri.uri
        });

        showLoading('Aktualisiere Galerie...');

        // Zeitstempel für Cache-Busting aktualisieren
        currentPhoto.updatedAt = Date.now();

        await savePhotos();
        await renderGallery();

        // Anzeige in der Detailansicht aktualisieren
        const updatedUrl = `${Capacitor.convertFileSrc(fileUri.uri)}?v=${currentPhoto.updatedAt}`;
        await openDetail(currentPhoto, updatedUrl);

    } catch (error) {
        console.error('Fehler bei Bildbearbeitung:', error);
        alert('Foto konnte nicht bearbeitet werden.');
    } finally {
        hideLoading();
    }
}

// --- Foto löschen ---
async function deletePhoto() {
    if (!currentPhoto) return;

    if (!confirm('Foto wirklich löschen?')) return;

    showLoading('Foto wird gelöscht...');
    try {
        // Datei vom Dateisystem entfernen
        await Filesystem.deleteFile({
            path: currentPhoto.fileName,
            directory: Directory.Data
        });

        // Aus der Liste entfernen
        photos = photos.filter(p => p.fileName !== currentPhoto.fileName);

        await savePhotos();
        await renderGallery();
        closeDetail();

    } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Foto konnte nicht gelöscht werden.');
    } finally {
        hideLoading();
    }
}

// --- Ladeanzeige-Steuerung ---
function showLoading(message = 'Bitte warten...') {
    loadingMessage.textContent = message;
    loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

// --- Event-Listener-Zuweisung ---
cameraBtn.onclick = () => takePhoto();
closeModal.onclick = () => closeDetail();
editBtn.onclick = () => editPhoto();
deleteBtn.onclick = () => deletePhoto();

// Schließen bei Klick außerhalb des Modals
window.onclick = (event) => {
    if (event.target === photoModal) {
        closeDetail();
    }
};

// Initialer Start
initializeApp();
