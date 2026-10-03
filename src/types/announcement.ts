import type { GeoPoint, Id, Timestamp } from './common';

/** Lists only return "active" walks; the others can come from GET /announcements/{id}. */
export type AnnouncementStatus = 'active' | 'cancelled' | 'finished';

/** A planned walk. Its place is either a walk spot or a point on the map (never both). */
export interface Announcement {
  id: Id;
  pet_id: Id;
  spot_id: Id | null;
  custom_point: GeoPoint | null;
  starts_at: Timestamp;
  duration_min: number;
  status: AnnouncementStatus;
  created_at: Timestamp;
}

interface AnnouncementCreateFields {
  pet_id: Id;
  starts_at: Timestamp;
  /** 1…720 minutes. */
  duration_min: number;
}

/**
 * POST /announcements — exactly one of spot_id and custom_point (the backend
 * answers 400 to both or neither); the type makes the other one impossible.
 * starts_at may be at most 1 hour ago and 30 days ahead.
 */
export type AnnouncementCreateRequest = AnnouncementCreateFields &
  (
    | { spot_id: Id; custom_point?: never }
    | { custom_point: GeoPoint; spot_id?: never }
  );

/** GET /announcements?lat&lng&radius_m&from&to — active walks near a point, by start time. */
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

/** WebSocket message sent to every client when someone announces a walk. */
export interface AnnouncementCreatedMessage {
  type: 'announcement_created';
  announcement: Announcement;
}
