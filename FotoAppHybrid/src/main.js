import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { PhotoEditor } from '@capawesome/capacitor-photo-editor';

// HTML Elemente
const gallery = document.getElementById('gallery');
const cameraBtn = document.getElementById('camera-btn');
const loadingOverlay = document.getElementById('loading-overlay');

// Modal Elemente
const modal = document.getElementById('photo-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.querySelector('.close-modal');
const editBtn = document.getElementById('edit-btn');
const deleteModalBtn = document.getElementById('delete-modal-btn');

const PHOTO_STORAGE = 'saved_photos';
let photos = [];
let currentSelectedPhoto = null;

// --- Lade-Animation Funktionen ---
function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// --- Foto Funktionen ---

// 1. Fotos beim Start laden
async function loadPhotos() {
    showLoading();
    try {
        const { value } = await Preferences.get({ key: PHOTO_STORAGE });
        photos = value ? JSON.parse(value) : [];

        gallery.innerHTML = ''; // Liste leeren
        for (let photo of photos) {
            const file = await Filesystem.getUri({
                directory: Directory.Data,
                path: photo.filepath
            });
            photo.webviewPath = Capacitor.convertFileSrc(file.uri);
            addPhotoToUI(photo);
        }
    } catch (e) {
        console.error("Fehler beim Laden:", e);
    }
    hideLoading();
}

// 2. Foto aufnehmen
async function takePhoto() {
    try {
        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera
        });

        showLoading();
        const fileName = Date.now() + '.jpeg';

        await Filesystem.writeFile({
            path: fileName,
            data: image.base64String,
            directory: Directory.Data
        });

        const fileUri = await Filesystem.getUri({
            directory: Directory.Data,
            path: fileName
        });

        const newPhoto = {
            filepath: fileName,
            webviewPath: Capacitor.convertFileSrc(fileUri.uri)
        };

        photos.unshift(newPhoto);
        saveToPreferences();
        addPhotoToUI(newPhoto, true);
        hideLoading();

    } catch (error) {
        hideLoading();
        console.error("Fehler beim Fotografieren:", error);
    }
}

// 3. Foto in der UI anzeigen
function addPhotoToUI(photo, atStart = false) {
    const div = document.createElement('div');
    div.className = 'photo-container';
    div.innerHTML = `<img src="${photo.webviewPath}">`;

    // Klick auf Foto -> Modal öffnen (Detailansicht)
    div.onclick = () => openDetail(photo);

    if (atStart) {
        gallery.prepend(div);
    } else {
        gallery.appendChild(div);
    }
}

// 4. Detailansicht öffnen
function openDetail(photo) {
    currentSelectedPhoto = photo;
    modalImg.src = photo.webviewPath;
    modal.style.display = "block";
}

// 5. Detailansicht schließen
function closeDetail() {
    modal.style.display = "none";
    currentSelectedPhoto = null;
}

// 6. Foto bearbeiten (Nur Android)
async function editPhoto() {
    if (Capacitor.getPlatform() !== 'android') {
        alert("Bearbeiten ist nur unter Android verfügbar.");
        return;
    }

    if (!currentSelectedPhoto) return;

    try {
        const file = await Filesystem.getUri({
            directory: Directory.Data,
            path: currentSelectedPhoto.filepath
        });

        await PhotoEditor.editPhoto({
            path: file.uri
        });

        // Bildpfad aktualisieren (Cache-Busting mit Zeitstempel)
        const updatedPath = Capacitor.convertFileSrc(file.uri) + '?t=' + Date.now();
        currentSelectedPhoto.webviewPath = updatedPath;
        modalImg.src = updatedPath;

        // Liste neu laden, um Thumbnail zu aktualisieren
        loadPhotos();
    } catch (e) {
        console.error("Fehler beim Bearbeiten:", e);
    }
}

// 7. Foto löschen
async function deletePhoto() {
    if (!currentSelectedPhoto) return;

    showLoading();
    try {
        const photoToDelete = currentSelectedPhoto;

        // Aus Liste entfernen
        photos = photos.filter(p => p.filepath !== photoToDelete.filepath);
        saveToPreferences();

        // Datei löschen
        await Filesystem.deleteFile({
            path: photoToDelete.filepath,
            directory: Directory.Data
        });

        closeDetail();
        loadPhotos(); // Liste in der UI aktualisieren
    } catch (e) {
        console.error("Fehler beim Löschen:", e);
    }
    hideLoading();
}

function saveToPreferences() {
    Preferences.set({
        key: PHOTO_STORAGE,
        value: JSON.stringify(photos.map(p => ({ filepath: p.filepath })))
    });
}

// --- Event Listener ---
cameraBtn.onclick = takePhoto;
closeModal.onclick = closeDetail;
editBtn.onclick = editPhoto;
deleteModalBtn.onclick = deletePhoto;

// Schließen wenn man außerhalb des Bildes klickt
window.onclick = (event) => {
    if (event.target == modal) {
        closeDetail();
    }
}

// Initialisierung
loadPhotos();
