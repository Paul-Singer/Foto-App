<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Foto Galerie</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Galerie</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Galerie Grid -->
      <ion-grid>
        <ion-row>
          <ion-col size="4" v-for="photo in photos" :key="photo.filepath">
            <ion-img :src="photo.webviewPath" class="thumbnail" @click="openPhoto(photo)"></ion-img>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- Kamera FAB -->
      <ion-fab vertical="bottom" horizontal="center" slot="fixed">
        <ion-fab-button @click="handleTakePhoto">
          <ion-icon :icon="camera"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <!-- Vollbild Modal -->
      <ion-modal :is-open="isModalOpen" @didDismiss="isModalOpen = false">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="isModalOpen = false">Schließen</ion-button>
            </ion-buttons>
            <ion-title>Foto Details</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showActionSheet(selectedPhoto!)">
                <ion-icon :icon="ellipsisVertical"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding ion-text-center">
          <div v-if="selectedPhoto" class="full-image-container">
            <ion-img :src="selectedPhoto.webviewPath" class="full-image"></ion-img>
            <p class="timestamp-text">{{ formatTime(selectedPhoto.timestamp) }}</p>
          </div>
        </ion-content>
      </ion-modal>

      <ion-loading :is-open="isLoading" message="Bitte warten..."></ion-loading>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonFab,
  IonFabButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonImg,
  actionSheetController,
  IonLoading,
  IonModal,
  IonButton,
  IonButtons
} from '@ionic/vue';
import { camera, trash, share, create, close, ellipsisVertical } from 'ionicons/icons';
import { usePhotoGallery, UserPhoto } from '@/composables/usePhotoGallery';
import { ref, onMounted } from 'vue';

const { photos, takePhoto, deletePhoto, editPhoto, sharePhoto, loadSaved, checkAndRequestPermissions } = usePhotoGallery();
const isLoading = ref(false);
const isModalOpen = ref(false);
const selectedPhoto = ref<UserPhoto | null>(null);

onMounted(async () => {
  isLoading.value = true;
  await checkAndRequestPermissions();
  await loadSaved();
  isLoading.value = false;
});

const openPhoto = (photo: UserPhoto) => {
  selectedPhoto.value = photo;
  isModalOpen.value = true;
};

const handleTakePhoto = async () => {
  isLoading.value = true;
  try {
    await takePhoto();
  } catch (e) {
    console.error('Error taking photo', e);
  }
  isLoading.value = false;
};

const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('de-DE');
};

const showActionSheet = async (photo: UserPhoto) => {
  const actionSheet = await actionSheetController.create({
    header: 'Aktionen',
    buttons: [
      {
        text: 'Bearbeiten',
        icon: create,
        handler: async () => {
          isLoading.value = true;
          await editPhoto(photo);
          // If modal is open, update the displayed photo
          if (selectedPhoto.value?.filepath === photo.filepath) {
              selectedPhoto.value = { ...photo };
          }
          isLoading.value = false;
        }
      },
      {
        text: 'Teilen',
        icon: share,
        handler: () => {
          sharePhoto(photo);
        }
      },
      {
        text: 'Löschen',
        role: 'destructive',
        icon: trash,
        handler: async () => {
          await deletePhoto(photo);
          isModalOpen.value = false;
        }
      },
      {
        text: 'Abbrechen',
        icon: close,
        role: 'cancel'
      }
    ]
  });
  await actionSheet.present();
};
</script>

<style scoped>
.thumbnail {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 4px;
}

ion-col {
  padding: 2px;
}

.full-image-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
}

.full-image {
    max-width: 100%;
    max-height: 80vh;
}

.timestamp-text {
    color: #8c8c8c;
    margin-top: 10px;
}
</style>
