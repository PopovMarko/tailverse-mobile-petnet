import Geolocation from '@react-native-community/geolocation';

import type { GeoPoint } from '../types';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

/**
 * Current device position. Asks for "when in use" access first if it hasn't been
 * decided yet (both platforms do this inside getCurrentPosition). Rejects if the
 * user declines or the position can't be determined within 10 s.
 *
 * Don't call Geolocation.requestAuthorization before this: on iOS its callbacks
 * only fire when the status changes, so with access already granted it never resolves.
 */
export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      error => reject(new Error(error.message)),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
