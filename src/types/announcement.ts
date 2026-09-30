import type { GeoPoint, Id, Timestamp } from './common';

export interface Announcement {
  id: Id;
  pet_id: Id;
  spot_id: Id | null;
  custom_point: GeoPoint | null;
  starts_at: Timestamp;
  duration_min: number;
  status: string;
  created_at: Timestamp;
}

/** POST /announcements — set either spot_id or custom_point. */
export interface AnnouncementCreateRequest {
  pet_id: Id;
  spot_id?: Id | null;
  custom_point?: GeoPoint | null;
  starts_at: Timestamp;
  duration_min: number;
}

/** GET /announcements */
export interface AnnouncementsListResponse {
  announcements: Announcement[];
}

export interface Participant {
  pet_id: Id;
  pet_name: string;
  owner_nickname: string;
  joined_at: Timestamp;
}

/** GET /announcements/{id} */
export interface AnnouncementDetails extends Announcement {
  participants: Participant[];
}

/** POST /announcements/{id}/join */
export interface JoinRequest {
  pet_id: Id;
}

export interface JoinResponse {
  announcement_id: Id;
  pet_id: Id;
  joined_at: Timestamp;
}
