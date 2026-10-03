import type {
  Announcement,
  AnnouncementCreateRequest,
  AnnouncementDetails,
  AnnouncementsListResponse,
  GeoPoint,
  Id,
  JoinRequest,
  JoinResponse,
} from '../types';
import { request } from './client';

export interface AnnouncementsPeriod {
  /** Walks that have not ended by then (backend default: now). */
  from?: Date;
  /** Walks that start by then. */
  to?: Date;
}

/**
 * GET /announcements — active walks whose place (spot or custom point) is within
 * radiusM metres of center (backend default 2 000, max 50 000), by start time.
 */
export function listAnnouncements(
  center: GeoPoint,
  radiusM: number,
  period: AnnouncementsPeriod = {},
) {
  return request<AnnouncementsListResponse>('/announcements', {
    query: {
      lat: center.lat,
      lng: center.lng,
      radius_m: radiusM,
      from: period.from?.toISOString(),
      to: period.to?.toISOString(),
    },
  });
}

/** GET /announcements/{id} — the walk with the pets that joined it. */
export function getAnnouncement(id: Id) {
  return request<AnnouncementDetails>(
    `/announcements/${encodeURIComponent(id)}`,
  );
}

/**
 * POST /announcements — "I'm going for a walk" with the owner's pet.
 * 400 — invalid data (time, duration, place), 403 — not the owner's pet.
 */
export function createAnnouncement(body: AnnouncementCreateRequest) {
  return request<Announcement>('/announcements', {
    method: 'POST',
    body,
    auth: true,
  });
}

/**
 * POST /announcements/{id}/join — the owner's pet joins the walk.
 * 400 — the walk is over/cancelled or led by this pet, 409 — already joined.
 */
export function joinAnnouncement(id: Id, petId: Id) {
  const body: JoinRequest = { pet_id: petId };
  return request<JoinResponse>(
    `/announcements/${encodeURIComponent(id)}/join`,
    { method: 'POST', body, auth: true },
  );
}

/** DELETE /announcements/{id}/join — 404 when the pet has not joined. */
export function leaveAnnouncement(id: Id, petId: Id) {
  const body: JoinRequest = { pet_id: petId };
  return request<void>(`/announcements/${encodeURIComponent(id)}/join`, {
    method: 'DELETE',
    body,
    auth: true,
  });
}
