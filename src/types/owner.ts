import type { Id, Timestamp } from './common';

/** Values accepted by the backend for the owner's gender; "" clears it in PATCH. */
export type Gender = 'male' | 'female' | 'other';

/** Which optional profile fields other users can see (GET /owners/{id}). */
export interface OwnerVisibility {
  gender: boolean;
  avatar_url: boolean;
}

/** GET/PATCH /owners/me — the signed-in owner's full profile. Unset fields are null. */
export interface Owner {
  id: Id;
  email: string;
  nickname: string;
  gender: Gender | null;
  avatar_url: string | null;
  visibility: OwnerVisibility;
  created_at: Timestamp;
}

/** GET /owners/{id} — public view: hidden or unset fields are null, never the email. */
export interface PublicOwner {
  id: Id;
  nickname: string;
  gender: Gender | null;
  avatar_url: string | null;
  created_at: Timestamp;
}

/** PATCH /owners/me — absent fields are left unchanged, "" clears gender/avatar_url. */
export interface OwnerUpdateRequest {
  nickname?: string;
  gender?: Gender | '';
  avatar_url?: string;
  visibility?: Partial<OwnerVisibility>;
}

/**
 * POST /auth/register. Backend visibility defaults: gender hidden, avatar shown.
 * avatar_url must be an absolute http(s) URL (upload the photo via POST /uploads first).
 */
export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
  gender?: Gender | '';
  avatar_url?: string;
  visibility?: Partial<OwnerVisibility>;
}

export interface RegisterResponse {
  owner_id: Id;
  email: string;
  nickname: string;
  access_token: string;
  refresh_token: string;
}

/** POST /auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /auth/refresh */
export interface RefreshRequest {
  refresh_token: string;
}

/** Response of /auth/login and /auth/refresh. */
export interface TokensResponse {
  access_token: string;
  refresh_token: string;
}
