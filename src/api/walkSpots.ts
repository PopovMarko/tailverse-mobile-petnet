import type {
  GeoPoint,
  Id,
  WalkSpotDetails,
  WalkSpotsListResponse,
} from '../types';
import { request } from './client';

/** GET /walkspots — spots within radiusM metres of center (backend max 50 000). */
export function listWalkSpots(center: GeoPoint, radiusM: number) {
  return request<WalkSpotsListResponse>('/walkspots', {
    query: { lat: center.lat, lng: center.lng, radius_m: radiusM },
  });
}

/** GET /walkspots/{id} — spot with the pets currently checked in. */
export function getWalkSpot(id: Id) {
  return request<WalkSpotDetails>(`/walkspots/${encodeURIComponent(id)}`);
}
