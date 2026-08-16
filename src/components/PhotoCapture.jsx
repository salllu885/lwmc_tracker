import { Camera as CameraIcon } from 'lucide-react';
import { capturePhoto } from '../lib/media';

export default function PhotoCapture({ label, photo, onCapture }) {
  async function handleClick() {
    try {
      const dataUrl = await capturePhoto();
      onCapture(dataUrl);
    } catch (e) {
      // user cancelled the camera
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-400 overflow-hidden bg-slate-50 hover:border-amber-400 hover:text-amber-600 transition-colors"
    >
      {photo ? (
        <img src={photo} alt={label} className="w-full h-full object-cover" />
      ) : (
        <>
          <CameraIcon size={28} />
          <span className="text-sm">{label}</span>
        </>
      )}
    </button>
  );
}
