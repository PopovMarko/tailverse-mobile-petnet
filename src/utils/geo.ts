import type { Region } from 'react-native-maps';

import type { GeoPoint } from '../types';

const METRES_PER_DEGREE_LAT = 111_320;

/** Backend limits for GET /walkspots radius_m. */
export const MIN_RADIUS_M = 100;
export const MAX_RADIUS_M = 50_000;

/**
 * Starting map position, kept when the user's location is unknown:
 * the centre of Kryvyi Rih, Ukraine, about 15 km across.
 */
export const DEFAULT_REGION: Region = {
  latitude: 47.9106,
  longitude: 33.3436,
  latitudeDelta: 0.15,
  longitudeDelta: 0.2,
};

/** Zoom used when centring on the user: roughly 3 km across. */
export function regionAround(point: GeoPoint): Region {
  return {
    latitude: point.lat,
    longitude: point.lng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };
}

export function regionCenter(region: Region): GeoPoint {
  return { lat: region.latitude, lng: region.longitude };
}

/**
 * Radius from the region centre to its corners, so every visible spot is
 * inside the search circle. Clamped to what the backend accepts.
 */
export function regionRadiusM(region: Region): number {
  const halfHeightM = (region.latitudeDelta / 2) * METRES_PER_DEGREE_LAT;
  const halfWidthM =
    (region.longitudeDelta / 2) *
    METRES_PER_DEGREE_LAT *
    Math.cos((region.latitude * Math.PI) / 180);
  const radius = Math.round(Math.hypot(halfHeightM, halfWidthM));
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, radius));
}
