import Geolocation from '@react-native-community/geolocation';
import { Linking, Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check,
  checkMultiple,
  request,
  requestMultiple,
  type PermissionStatus,
} from 'react-native-permissions';

import type { GeoPoint } from '../types';

// The app asks for access itself (see requestLocationPermission) after explaining why,
// so the geolocation module must never show the system prompt on its own.
Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

/**
 * Location access as the app sees it:
 * granted — the user can be located;
 * requestable — not decided yet (or declined once on Android): the system prompt can be shown;
 * blocked — declined for good: only the system Settings can change it;
 * unavailable — the device has no location services.
 */
export type LocationPermission =
  | 'granted'
  | 'requestable'
  | 'blocked'
  | 'unavailable';

function fromStatus(status: PermissionStatus): LocationPermission {
  switch (status) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      return 'requestable';
    case RESULTS.BLOCKED:
      return 'blocked';
    default:
      return 'unavailable';
  }
}

// Android 12+ ignores a request for FINE alone: ask for both and accept either,
// so "approximate" location also counts as granted.
const ANDROID_LOCATION = [
  PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
];

const PRIORITY: LocationPermission[] = ['granted', 'requestable', 'blocked'];

function fromAndroidStatuses(
  statuses: Partial<Record<string, PermissionStatus>>,
): LocationPermission {
  const results = ANDROID_LOCATION.map(permission =>
    fromStatus(statuses[permission] ?? RESULTS.UNAVAILABLE),
  );
  return PRIORITY.find(result => results.includes(result)) ?? 'unavailable';
}

/** Current location permission. Never shows a system prompt. */
export async function checkLocationPermission(): Promise<LocationPermission> {
  if (Platform.OS === 'android') {
    return fromAndroidStatuses(await checkMultiple(ANDROID_LOCATION));
  }
  return fromStatus(await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE));
}

/**
 * Shows the system "allow location while using the app" prompt (when it still can
 * be shown) and resolves to the outcome. Call it only after the user asked for it.
 */
export async function requestLocationPermission(): Promise<LocationPermission> {
  if (Platform.OS === 'android') {
    return fromAndroidStatuses(await requestMultiple(ANDROID_LOCATION));
  }
  return fromStatus(await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE));
}

/** Opens this app's page in the system Settings, where location access can be turned on. */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

/**
 * Current device position. Needs granted permission (see above): it never asks
 * for access itself. Rejects when access is missing or the position can't be
 * determined within 10 s.
 *
 * Don't use Geolocation.requestAuthorization for asking: on iOS its callbacks only
 * fire when the status changes, so with access already granted it never resolves.
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
