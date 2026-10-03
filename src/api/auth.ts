import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  TokensResponse,
} from '../types';
import { request } from './client';

/** POST /auth/register — creates the owner and signs them in. */
export function register(body: RegisterRequest) {
  return request<RegisterResponse>('/auth/register', { method: 'POST', body });
}

/** POST /auth/login — 401 for a wrong email or password. */
export function login(body: LoginRequest) {
  return request<TokensResponse>('/auth/login', { method: 'POST', body });
}

/** POST /auth/refresh — exchanges a refresh token for a new token pair. */
export function refreshTokens(refreshToken: string) {
  return request<TokensResponse>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}
