// --- Imports ---
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { PhotoEditor } from '@capawesome/capacitor-photo-editor';

// --- DOM-Elemente ---
const galleryElement = document.getElementById('gallery');
const cameraBtn = document.getElementById('cameraBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingMessage = document.getElementById('loadingMessage');

// Modal Elemente
const photoModal = document.getElementById('photoModal');
const closeModal = document.getElementById('closeModal');
const modalImage = document.getElementById('modalImage');

// Modal Buttons
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');

// --- Zustandsvariablen ---
const STORAGE_KEY = 'photos';
let photos = [];
let currentPhoto = null;

// --- Initialisierung ---
async function initializeApp() {
    console.log('App wird initialisiert...');
    await loadPhotos();
}

// --- Berechtigungen ---
async function requestCameraPermission() {
    try {
        const permissions = await Camera.checkPermissions();

        if (permissions.camera !== 'granted') {
            const requested = await Camera.requestPermissions({
                permissions: ['camera']
            });

            if (requested.camera !== 'granted') {
                alert('Die Kamera-Berechtigung wird benötigt, um Fotos aufzunehmen.');
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Fehler bei Berechtigungsprüfung:', error);
        return false;
    }
}

// --- Kamera und Speicherung ---
async function takePhoto() {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
        const photo = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera
        });

        showLoading('Foto wird gespeichert...');

        const now = Date.now();
        const fileName = `photo_${now}.jpg`;
        const date = new Date().toISOString();

        // Datei im Dateisystem speichern
        await Filesystem.writeFile({
            path: fileName,
            data: photo.base64String,
            directory: Directory.Data
        });

        // Metadaten zum Array hinzufügen
        const newPhoto = {
            fileName: fileName,
            date: date,
            updatedAt: now // Zeitstempel für Cache-Busting
        };

        photos.unshift(newPhoto); // Neuestes Foto an den Anfang
        await savePhotosToPreferences();
        await renderGallery();

    } catch (error) {
        console.error('Fehler bei der Fotoaufnahme:', error);
    } finally {
        hideLoading();
    }
}

async function savePhotosToPreferences() {
    await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(photos)
    });
}

// --- Galerie laden und darstellen ---
async function loadPhotos() {
    showLoading('Fotos werden geladen...');
    try {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        photos = value ? JSON.parse(value) : [];

        // Sortieren: Neueste zuerst
        photos.sort((a, b) => new Date(b.date) - new Date(a.date));

        await renderGallery();
    } catch (error) {
        console.error('Fehler beim Laden der Fotos:', error);
    } finally {
        hideLoading();
    }
}

async function renderGallery() {
    galleryElement.innerHTML = '';

    if (photos.length === 0) {
        galleryElement.innerHTML = '<p style="grid-column: span 3; text-align: center; padding: 20px;">Noch keine Fotos aufgenommen.</p>';
        return;
    }

    for (const photo of photos) {
        try {
            const fileUri = await Filesystem.getUri({
                directory: Directory.Data,
                path: photo.fileName
            });

            // Cache-Busting URL erstellen
            const webSrc = `${Capacitor.convertFileSrc(fileUri.uri)}?v=${photo.updatedAt || Date.now()}`;

            // Container für Bild und Lösch-Button
            const item = document.createElement('div');
            item.className = 'gallery-item';

            const img = document.createElement('img');
            img.src = webSrc;
            img.alt = 'Galeriefoto';
            img.onclick = () => openPhotoDetails(photo, webSrc);

            item.appendChild(img);
            galleryElement.appendChild(item);
        } catch (e) {
            console.error(`Fehler beim Laden von ${photo.fileName}:`, e);
        }
    }
}

// --- Detailansicht ---
async function openPhotoDetails(photo, webSrc) {
    currentPhoto = photo;
    modalImage.src = webSrc;

    // Bildbearbeitung nur unter Android verfügbar
    if (Capacitor.getPlatform() === 'android') {
        editBtn.classList.remove('hidden');
    } else {
        editBtn.classList.add('hidden');
    }

    photoModal.classList.remove('hidden');
}

function closePhotoDetails() {
    photoModal.classList.add('hidden');
    currentPhoto = null;
}

// --- Bearbeiten ---
async function editPhoto() {
    if (!currentPhoto) return;

    if (Capacitor.getPlatform() !== 'android') {
        alert('Die Bildbearbeitung ist nur unter Android verfügbar.');
        return;
    }

    try {
        const fileUri = await Filesystem.getUri({
            directory: Directory.Data,
            path: currentPhoto.fileName
        });

        // Nativen Editor öffnen
        await PhotoEditor.editPhoto({
            path: fileUri.uri
        });

        showLoading('Galerie wird aktualisiert...');

        // Cache umgehen durch Zeitstempel-Aktualisierung
        currentPhoto.updatedAt = Date.now();

        await savePhotosToPreferences();
        await renderGallery();

        // Detailansicht mit neuem Zeitstempel aktualisieren
        const updatedWebSrc = `${Capacitor.convertFileSrc(fileUri.uri)}?v=${currentPhoto.updatedAt}`;
        await openPhotoDetails(currentPhoto, updatedWebSrc);

    } catch (error) {
        console.error('Fehler beim Bearbeiten:', error);
        alert('Das Foto konnte nicht bearbeitet werden.');
    } finally {
        hideLoading();
    }
}

// --- Löschen ---
async function deletePhoto(photoToDelete = null) {
    const photo = photoToDelete || currentPhoto;
    if (!photo) return;

    if (!confirm('Möchtest du dieses Foto wirklich löschen?')) return;

    showLoading('Foto wird gelöscht...');
    try {
        // Datei aus dem Dateisystem löschen
        await Filesystem.deleteFile({
            path: photo.fileName,
            directory: Directory.Data
        });

        // Aus dem State entfernen
        photos = photos.filter(p => p.fileName !== photo.fileName);

        await savePhotosToPreferences();
        await renderGallery();

        if (!photoToDelete) {
            closePhotoDetails();
        }

    } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Das Foto konnte nicht gelöscht werden.');
    } finally {
        hideLoading();
    }
}

// --- Ladeanzeige ---
function showLoading(message = 'Bitte warten...') {
    loadingMessage.textContent = message;
    loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

// --- Event-Listener ---
cameraBtn.onclick = () => takePhoto();
closeModal.onclick = () => closePhotoDetails();
editBtn.onclick = () => editPhoto();
deleteBtn.onclick = () => deletePhoto();

window.onclick = (event) => {
    if (event.target === photoModal) {
        closePhotoDetails();
    }
};

// App-Start
initializeApp();
