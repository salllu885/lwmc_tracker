import { useEffect } from 'react';
import { captureLocation } from '../media';
import { logLocationPing } from '../api/tracking';

// Foreground-only tracking: pings while the app is open and in the
// foreground, on the roles whose movement actually matters (field staff).
// This is NOT background tracking — the app has to be open on screen for a
// ping to fire, same as any web page's geolocation. True background
// tracking (screen off / app minimized) needs a native plugin like
// @capacitor-community/background-geolocation, which isn't installed yet.
const TRACKED_ROLES = ['SURVEYOR', 'RECTIFIER', 'SUPERVISOR', 'ZO'];
const PING_INTERVAL_MS = 3 * 60 * 1000;

export function useLocationTracking(userId, role) {
  useEffect(() => {
    if (!userId || !TRACKED_ROLES.includes(role)) return;

    let cancelled = false;

    async function ping() {
      try {
        const { lat, lng, accuracy } = await captureLocation({ enableHighAccuracy: false, timeout: 15000 });
        if (!cancelled) await logLocationPing({ userId, lat, lng, accuracy });
      } catch {
        // GPS/permission not available — skip this tick, try again next one.
      }
    }

    ping();
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userId, role]);
}
