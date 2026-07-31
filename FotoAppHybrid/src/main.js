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

// Berechtigungen gezielt für die Kamera anfordern
async function checkPermissions() {
    if (Capacitor.isNativePlatform()) {
        try {
            const permissions = await Camera.checkPermissions();
            if (permissions.camera !== 'granted') {
                await Camera.requestPermissions({
                    permissions: ['camera']
                });
            }
        } catch (e) {
            console.warn("Berechtigungen konnten nicht angefordert werden", e);
        }
    }
}

// Ladeanzeige steuern
function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

// Fotoliste persistent speichern
async function saveToPreferences() {
    await Preferences.set({
        key: PHOTO_STORAGE,
        value: JSON.stringify(photos.map(p => ({
            filepath: p.filepath,
            createdAt: p.createdAt
        })))
    });
}

// Fotos aus Speicher laden und UI aufbauen
async function loadPhotos() {
    showLoading();
    try {
        const { value } = await Preferences.get({ key: PHOTO_STORAGE });
        const savedPhotos = value ? JSON.parse(value) : [];

        // Legacy-Support & Sortierung: createdAt ergänzen falls fehlt (aus Dateiname extrahieren)
        photos = savedPhotos.map(p => {
            if (!p.createdAt) {
                const timestamp = parseInt(p.filepath.split('.')[0]);
                p.createdAt = isNaN(timestamp) ? 0 : timestamp;
            }
            return p;
        });

        // Absteigend sortieren: Neueste zuerst
        photos.sort((a, b) => b.createdAt - a.createdAt);

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
    } finally {
        hideLoading(); // Sicherstellen, dass Spinner verschwindet
    }
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
        const now = Date.now();
        const fileName = now + '.jpeg';

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
            webviewPath: Capacitor.convertFileSrc(fileUri.uri),
            createdAt: now
        };

        photos.unshift(newPhoto);
        await saveToPreferences();
        renderThumbnail(newPhoto, true);

    } catch (error) {
        console.error("Kamera-Vorgang abgebrochen oder fehlgeschlagen", error);
    } finally {
        hideLoading();
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
    metaText.innerText = "Lade Daten...";

    try {
        const file = await Filesystem.getUri({ directory: Directory.Data, path: photo.filepath });
        const metadata = await Exif.readExif({ path: file.uri });

        let info = "";
        if (metadata.tags?.dateTimeOriginal) info += `Aufnahme: ${metadata.tags.dateTimeOriginal}\n`;
        if (metadata.tags?.pixelXDimension && metadata.tags?.pixelYDimension) {
            info += `Maße: ${metadata.tags.pixelXDimension} x ${metadata.tags.pixelYDimension} Pixel`;
        }

        metaText.innerText = info || "Keine Metadaten verfügbar";
    } catch (e) {
        metaText.innerText = "Metadaten konnten nicht gelesen werden.";
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

    showLoading();
    try {
        const file = await Filesystem.getUri({ directory: Directory.Data, path: currentSelectedPhoto.filepath });
        await PhotoEditor.editPhoto({ path: file.uri });

        // Pfad aktualisieren, um Neuladen des Bildes zu erzwingen
        const updatedPath = Capacitor.convertFileSrc(file.uri) + '?t=' + Date.now();
        currentSelectedPhoto.webviewPath = updatedPath;
        modalImg.src = updatedPath;
        await loadPhotos();
    } catch (e) {
        console.error("Fehler beim Bearbeiten", e);
    } finally {
        hideLoading();
    }
}

// Foto über System-Dialog teilen
async function sharePhoto() {
    if (!currentSelectedPhoto) return;
    try {
        const file = await Filesystem.getUri({ directory: Directory.Data, path: currentSelectedPhoto.filepath });
        await Share.share({
            title: 'Foto teilen',
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
        await saveToPreferences();
        await Filesystem.deleteFile({ path: photoToDelete.filepath, directory: Directory.Data });
        closeDetail();
        await loadPhotos();
    } catch (e) {
        console.error("Fehler beim Löschen", e);
    } finally {
        hideLoading();
    }
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
