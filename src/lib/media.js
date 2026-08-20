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

function toLocation(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

// A cold GPS fix (first request after the chip's been idle) routinely takes
// longer than a few seconds, especially indoors — 8s was timing out on real
// devices before a lock ever formed. Retry once with relaxed accuracy/longer
// timeout before giving up, since a coarse (network-assisted) fix beats none.
export async function captureLocation({ enableHighAccuracy = true, timeout = 15000, maximumAge = 10000 } = {}) {
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy, timeout, maximumAge });
    return toLocation(pos);
  } catch (e) {
    if (!enableHighAccuracy) throw e;
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 20000, maximumAge });
    return toLocation(pos);
  }
}
