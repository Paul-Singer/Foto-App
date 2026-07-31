import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { PhotoEditor } from '@capawesome/capacitor-photo-editor';
import { Share } from '@capacitor/share';
import { Exif } from '@capawesome/capacitor-exif';

// DOM-Elemente
const gallery = document.getElementById('gallery');
const cameraBtn = document.getElementById('camera-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const modal = document.getElementById('photo-modal');
const modalImg = document.getElementById('modal-img');
const metaText = document.getElementById('photo-meta');
const closeModal = document.querySelector('.close-modal');
const editBtn = document.getElementById('edit-btn');
const shareBtn = document.getElementById('share-btn');
const deleteModalBtn = document.getElementById('delete-modal-btn');

// Konfiguration und State
const PHOTO_STORAGE = 'saved_photos';
let photos = [];
let currentSelectedPhoto = null;

// Berechtigungen initial anfordern
async function checkPermissions() {
    if (Capacitor.isNativePlatform()) {
        try {
            const permissions = await Camera.checkPermissions();
            if (permissions.camera !== 'granted') {
                await Camera.requestPermissions();
            }
        } catch (e) {
            console.warn("Berechtigungen konnten nicht angefordert werden", e);
        }
    }
}

// Ladeanzeige steuern
function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

// Fotos aus Speicher laden und UI aufbauen
async function loadPhotos() {
    showLoading();
    try {
        const { value } = await Preferences.get({ key: PHOTO_STORAGE });
        photos = value ? JSON.parse(value) : [];

        gallery.innerHTML = '';
        for (let photo of photos) {
            const file = await Filesystem.getUri({
                directory: Directory.Data,
                path: photo.filepath
            });
            photo.webviewPath = Capacitor.convertFileSrc(file.uri);
            renderThumbnail(photo);
        }
    } catch (e) {
        console.error("Fehler beim Laden der Galerie", e);
    }
    hideLoading();
}

// Foto aufnehmen und dauerhaft speichern
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
        renderThumbnail(newPhoto, true);
        hideLoading();

    } catch (error) {
        hideLoading();
        console.error("Kamera-Vorgang abgebrochen", error);
    }
}

// Miniaturansicht in der Galerie erstellen
function renderThumbnail(photo, atStart = false) {
    const div = document.createElement('div');
    div.className = 'photo-container';
    div.innerHTML = `<img src="${photo.webviewPath}" alt="Vorschau">`;
    div.onclick = () => openDetail(photo);

    if (atStart) gallery.prepend(div);
    else gallery.appendChild(div);
}

// Detailansicht öffnen und Metadaten auslesen
async function openDetail(photo) {
    currentSelectedPhoto = photo;
    modalImg.src = photo.webviewPath;
    modal.style.display = "block";

    try {
        const file = await Filesystem.getUri({ directory: Directory.Data, path: photo.filepath });
        const metadata = await Exif.readExif({ path: file.uri });
        metaText.innerText = metadata.tags?.dateTimeOriginal ? `Aufnahmezeit: ${metadata.tags.dateTimeOriginal}` : "";
    } catch (e) {
        metaText.innerText = "";
    }
}

function closeDetail() {
    modal.style.display = "none";
    currentSelectedPhoto = null;
}

// Foto-Editor Plugin aufrufen (Android)
async function editPhoto() {
    if (Capacitor.getPlatform() !== 'android') return;
    if (!currentSelectedPhoto) return;

    try {
        const file = await Filesystem.getUri({ directory: Directory.Data, path: currentSelectedPhoto.filepath });
        await PhotoEditor.editPhoto({ path: file.uri });

        // Pfad aktualisieren, um Neuladen des Bildes zu erzwingen
        const updatedPath = Capacitor.convertFileSrc(file.uri) + '?t=' + Date.now();
        currentSelectedPhoto.webviewPath = updatedPath;
        modalImg.src = updatedPath;
        loadPhotos();
    } catch (e) {
        console.error("Fehler beim Bearbeiten", e);
    }
}

// Foto über System-Dialog teilen
async function sharePhoto() {
    if (!currentSelectedPhoto) return;
    try {
        const file = await Filesystem.getUri({ directory: Directory.Data, path: currentSelectedPhoto.filepath });
        await Share.share({
            title: 'Foto',
            url: file.uri
        });
    } catch (e) {
        console.error("Teilen fehlgeschlagen", e);
    }
}

// Foto aus Speicher und UI entfernen
async function deletePhoto() {
    if (!currentSelectedPhoto || !confirm("Foto unwiderruflich löschen?")) return;

    showLoading();
    try {
        const photoToDelete = currentSelectedPhoto;
        photos = photos.filter(p => p.filepath !== photoToDelete.filepath);
        saveToPreferences();
        await Filesystem.deleteFile({ path: photoToDelete.filepath, directory: Directory.Data });
        closeDetail();
        loadPhotos();
    } catch (e) {
        console.error("Fehler beim Löschen", e);
    }
    hideLoading();
}

// Fotoliste persistent speichern
function saveToPreferences() {
    Preferences.set({
        key: PHOTO_STORAGE,
        value: JSON.stringify(photos.map(p => ({ filepath: p.filepath })))
    });
}

// Event-Binding
cameraBtn.onclick = takePhoto;
closeModal.onclick = closeDetail;
editBtn.onclick = editPhoto;
shareBtn.onclick = sharePhoto;
deleteModalBtn.onclick = deletePhoto;
window.onclick = (e) => { if (e.target == modal) closeDetail(); };

// App initialisieren
checkPermissions();
loadPhotos();
