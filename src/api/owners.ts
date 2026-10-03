import type { Id, Owner, OwnerUpdateRequest, PublicOwner } from '../types';
import { request } from './client';

/** GET /owners/me — the signed-in owner's full profile. */
export function getMe() {
  return request<Owner>('/owners/me', { auth: true });
}

/** PATCH /owners/me — partial update, returns the updated profile. */
export function updateMe(body: OwnerUpdateRequest) {
  return request<Owner>('/owners/me', { method: 'PATCH', body, auth: true });
}

/** GET /owners/{id} — public profile of any owner. */
export function getOwner(id: Id) {
  return request<PublicOwner>(`/owners/${encodeURIComponent(id)}`);
}
