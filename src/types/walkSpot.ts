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
