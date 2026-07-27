import { ref, onMounted } from 'vue';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { PhotoEditor } from '@capawesome/capacitor-photo-editor';
import { Share } from '@capacitor/share';
import { Exif } from '@capawesome/capacitor-exif';

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
  timestamp: number;
}

export const usePhotoGallery = () => {
  const photos = ref<UserPhoto[]>([]);
  const PHOTO_STORAGE = 'photos';

  const checkAndRequestPermissions = async () => {
    if (Capacitor.isNativePlatform()) {
      const cameraPerms = await Camera.checkPermissions();
      if (cameraPerms.camera !== 'granted') {
        await Camera.requestPermissions();
      }
      // Note: Filesystem permissions are usually granted by default for private app directories
    }
  };

  const loadSaved = async () => {
    const photoList = await Preferences.get({ key: PHOTO_STORAGE });
    const photosInPreferences = photoList.value ? JSON.parse(photoList.value) : [];

    for (const photo of photosInPreferences) {
      try {
        const uri = await Filesystem.getUri({
          directory: Directory.Data,
          path: photo.filepath
        });
        photo.webviewPath = Capacitor.convertFileSrc(uri.uri);

        // If timestamp is missing or we want to double check metadata
        if (!photo.timestamp) {
            photo.timestamp = await getPhotoTimestamp(uri.uri);
        }
      } catch (e) {
        console.error('Error loading photo', photo.filepath, e);
      }
    }

    // Sort by timestamp descending (newest first)
    photos.value = photosInPreferences.sort((a: UserPhoto, b: UserPhoto) => b.timestamp - a.timestamp);
  };

  const getPhotoTimestamp = async (uri: string): Promise<number> => {
      try {
          const exifData = await Exif.readExif({ path: uri });
          if (exifData.tags?.dateTimeOriginal) {
              // Format: "YYYY:MM:DD HH:MM:SS"
              const parts = exifData.tags.dateTimeOriginal.split(/[: ]/);
              return new Date(
                  parseInt(parts[0]),
                  parseInt(parts[1]) - 1,
                  parseInt(parts[2]),
                  parseInt(parts[3]),
                  parseInt(parts[4]),
                  parseInt(parts[5])
              ).getTime();
          }
      } catch (e) {
          console.warn('Metadata read failed, using file stats', e);
      }

      // Fallback: Get file info
      try {
          // Filesystem.stat is not directly available to get creation time on all platforms easily
          // so we use current time as final fallback
      } catch (e) {}

      return new Date().getTime();
  };

  const cachePhotos = () => {
    Preferences.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(photos.value.map(p => {
        const pCopy = { ...p };
        delete pCopy.webviewPath;
        return pCopy;
      })),
    });
  };

  const takePhoto = async () => {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      quality: 100,
    });

    const tempTimestamp = new Date().getTime();
    const fileName = tempTimestamp + '.jpeg';

    await Filesystem.writeFile({
      path: fileName,
      data: photo.base64String!,
      directory: Directory.Data,
    });

    const uri = await Filesystem.getUri({
        directory: Directory.Data,
        path: fileName
    });

    // Read actual EXIF if possible (Camera plugin might have added it)
    const timestamp = await getPhotoTimestamp(uri.uri);

    const newPhoto: UserPhoto = {
      filepath: fileName,
      webviewPath: Capacitor.convertFileSrc(uri.uri),
      timestamp: timestamp
    };

    photos.value = [newPhoto, ...photos.value].sort((a, b) => b.timestamp - a.timestamp);
    cachePhotos();
  };

  const deletePhoto = async (photo: UserPhoto) => {
    photos.value = photos.value.filter((p) => p.filepath !== photo.filepath);
    cachePhotos();

    try {
      await Filesystem.deleteFile({
        path: photo.filepath,
        directory: Directory.Data,
      });
    } catch (e) {
      console.error('Error deleting file', e);
    }
  };

  const editPhoto = async (photo: UserPhoto) => {
    if (Capacitor.getPlatform() !== 'android') {
      console.warn('Photo editing is only supported on Android');
      return;
    }

    const uri = await Filesystem.getUri({
      directory: Directory.Data,
      path: photo.filepath
    });

    try {
      await PhotoEditor.editPhoto({
        path: uri.uri
      });

      // Update webviewPath and timestamp after edit
      const updatedUri = await Filesystem.getUri({
        directory: Directory.Data,
        path: photo.filepath
      });
      photo.webviewPath = Capacitor.convertFileSrc(updatedUri.uri) + '?t=' + new Date().getTime();
      photo.timestamp = await getPhotoTimestamp(updatedUri.uri);

      // Resort just in case the date changed (unlikely for edit, but good practice)
      photos.value = [...photos.value].sort((a, b) => b.timestamp - a.timestamp);
      cachePhotos();
    } catch (e) {
      console.error('Error editing photo', e);
    }
  };

  const sharePhoto = async (photo: UserPhoto) => {
      const uri = await Filesystem.getUri({
          directory: Directory.Data,
          path: photo.filepath
      });
      await Share.share({
          title: 'Foto teilen',
          url: uri.uri,
          dialogTitle: 'Teilen'
      });
  };

  return {
    photos,
    takePhoto,
    deletePhoto,
    editPhoto,
    sharePhoto,
    loadSaved,
    checkAndRequestPermissions
  };
};
