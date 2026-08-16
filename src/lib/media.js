import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

export async function capturePhoto() {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 70,
    width: 900,
    saveToGallery: false,
  });
  return photo.dataUrl;
}

export async function captureLocation({ enableHighAccuracy = true, timeout = 8000 } = {}) {
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy, timeout });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}
