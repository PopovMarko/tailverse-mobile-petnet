import type { Id, Timestamp } from './common';

/** Item of GET /walkspots. */
export interface WalkSpot {
  id: Id;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  present_count: number;
}

export interface WalkSpotsListResponse {
  spots: WalkSpot[];
}

/** Item of GET /walkspots/nearby (the spot picker of a walk announcement). */
export interface NearbyWalkSpot extends WalkSpot {
  /** Metres from the requested point, rounded. */
  distance_m: number;
}

/** GET /walkspots/nearby — closest first. */
export interface NearbyWalkSpotsResponse {
  spots: NearbyWalkSpot[];
}

export interface PresentPet {
  pet_id: Id;
  pet_name: string;
  owner_nickname: string;
  checked_in_at: Timestamp;
}

/** GET /walkspots/{id} */
export interface WalkSpotDetails {
  id: Id;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  present: PresentPet[];
}

/** POST /walkspots/{id}/checkin */
export interface CheckInRequest {
  pet_id: Id;
}

export interface CheckInResponse {
  spot_id: Id;
  pet_id: Id;
  checked_in_at: Timestamp;
  expires_at: Timestamp;
}
