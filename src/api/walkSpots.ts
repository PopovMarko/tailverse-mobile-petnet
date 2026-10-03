import type {
  CheckInRequest,
  CheckInResponse,
  GeoPoint,
  Id,
  NearbyWalkSpotsResponse,
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

/** Largest radius_m GET /walkspots/nearby accepts (and its default). */
export const NEARBY_SPOTS_RADIUS_M = 500;

/** GET /walkspots/nearby — spots within walking distance, closest first, with distance_m. */
export function listNearbyWalkSpots(
  center: GeoPoint,
  radiusM: number = NEARBY_SPOTS_RADIUS_M,
) {
  return request<NearbyWalkSpotsResponse>('/walkspots/nearby', {
    query: { lat: center.lat, lng: center.lng, radius_m: radiusM },
    auth: true,
  });
}

/** GET /walkspots/{id} — spot with the pets currently checked in. */
export function getWalkSpot(id: Id) {
  return request<WalkSpotDetails>(`/walkspots/${encodeURIComponent(id)}`);
}

/**
 * POST /walkspots/{id}/checkin — the owner's pet is at the spot now (for ~2 h).
 * A pet is at one spot at a time: checking in elsewhere moves it.
 * 403 — not the owner's pet, 404 — no such spot or pet.
 */
export function checkIn(spotId: Id, petId: Id) {
  const body: CheckInRequest = { pet_id: petId };
  return request<CheckInResponse>(
    `/walkspots/${encodeURIComponent(spotId)}/checkin`,
    { method: 'POST', body, auth: true },
  );
}

/** DELETE /walkspots/{id}/checkin — the pet has left. 404 when it was not checked in there. */
export function checkOut(spotId: Id, petId: Id) {
  const body: CheckInRequest = { pet_id: petId };
  return request<void>(`/walkspots/${encodeURIComponent(spotId)}/checkin`, {
    method: 'DELETE',
    body,
    auth: true,
  });
}
