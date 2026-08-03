// --- Imports ---
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
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
const metaDate = document.getElementById('metaDate');
const metaWidth = document.getElementById('metaWidth');
const metaHeight = document.getElementById('metaHeight');

// Modal Buttons
const editBtn = document.getElementById('editBtn');
const shareBtn = document.getElementById('shareBtn');
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
            allowEditing: false, // Wir nutzen das separate Plugin zum Bearbeiten
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera
        });

        showLoading('Foto wird gespeichert...');

        const fileName = `photo_${Date.now()}.jpg`;
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
            date: date
        };

        photos.unshift(newPhoto); // Neues Foto an den Anfang
        await savePhotosToPreferences();
        await renderGallery();

    } catch (error) {
        console.error('Fehler bei der Fotoaufnahme:', error);
        // "User cancelled" ist ein häufiger "Fehler", den wir hier ignorieren können
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

            const webSrc = Capacitor.convertFileSrc(fileUri.uri);

            // Container für Bild und Lösch-Button
            const item = document.createElement('div');
            item.className = 'gallery-item';

            const img = document.createElement('img');
            img.src = webSrc;
            img.alt = 'Galeriefoto';
            img.onclick = () => openPhotoDetails(photo, webSrc);

            // Direkt-Lösch-Button
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-gallery-btn';
            delBtn.innerHTML = '🗑️';
            delBtn.title = 'Löschen';
            delBtn.onclick = (e) => {
                e.stopPropagation(); // Verhindert das Öffnen der Details
                deletePhoto(photo);
            };

            item.appendChild(img);
            item.appendChild(delBtn);
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

    // Metadaten setzen
    const date = new Date(photo.date);
    metaDate.textContent = date.toLocaleString('de-DE');

    // Maße ermitteln (über ein temporäres Image-Objekt)
    metaWidth.textContent = 'Lädt...';
    metaHeight.textContent = 'Lädt...';

    const tempImg = new Image();
    tempImg.onload = () => {
        metaWidth.textContent = tempImg.width;
        metaHeight.textContent = tempImg.height;
    };
    tempImg.onerror = () => {
        metaWidth.textContent = 'Nicht verfügbar';
        metaHeight.textContent = 'Nicht verfügbar';
    };
    tempImg.src = webSrc;

    // Buttons anzeigen/ausblenden je nach Plattform
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
    if (!currentPhoto || Capacitor.getPlatform() !== 'android') return;

    try {
        const fileUri = await Filesystem.getUri({
            directory: Directory.Data,
            path: currentPhoto.fileName
        });

        await PhotoEditor.editPhoto({
            path: fileUri.uri
        });

        // Nach dem Bearbeiten Galerie neu laden
        // Zeitstempel an URL hängen, um Cache zu umgehen
        await renderGallery();
        closePhotoDetails();
        alert('Foto wurde bearbeitet und gespeichert.');
    } catch (error) {
        console.error('Fehler beim Bearbeiten:', error);
        alert('Das Foto konnte nicht bearbeitet werden.');
    }
}

// --- Löschen ---
async function deletePhoto(photoToDelete = null) {
    const photo = photoToDelete || currentPhoto;
    if (!photo) return;

    if (!confirm('Möchtest du dieses Foto wirklich löschen?')) return;

    showLoading('Foto wird gelöscht...');
    try {
        // Datei aus Filesystem löschen
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

// --- Teilen ---
async function sharePhoto() {
    if (!currentPhoto) return;

    try {
        const fileUri = await Filesystem.getUri({
            directory: Directory.Data,
            path: currentPhoto.fileName
        });

        await Share.share({
            title: 'Mein Foto',
            text: 'Schau dir dieses Foto an!',
            url: fileUri.uri,
            dialogTitle: 'Foto teilen'
        });
    } catch (error) {
        console.error('Fehler beim Teilen:', error);
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
cameraBtn.onclick = takePhoto;
closeModal.onclick = closePhotoDetails;
editBtn.onclick = editPhoto;
shareBtn.onclick = sharePhoto;
deleteBtn.onclick = deletePhoto;

// Schließen des Modals bei Klick außerhalb
window.onclick = (event) => {
    if (event.target === photoModal) {
        closePhotoDetails();
    }
};

// Start der App
initializeApp();
