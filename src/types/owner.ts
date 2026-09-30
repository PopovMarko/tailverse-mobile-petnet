import type { Id, Timestamp } from './common';

// The backend has no owner-profile endpoint yet; this mirrors the Owner
// domain model (minus the password hash) so screens can be built against it.
export interface Owner {
  id: Id;
  email: string;
  nickname: string;
  gender: string;
  avatar_url: string;
  is_profile_public: boolean;
  created_at: Timestamp;
}

/** POST /auth/register */
export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
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
