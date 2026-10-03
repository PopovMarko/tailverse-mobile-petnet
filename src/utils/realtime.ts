import type {
  Announcement,
  AnnouncementStatus,
  GeoPoint,
  ServerMessage,
} from '../types';

/** The presence socket's address: API_BASE_URL with ws(s):// and /ws/presence. */
export function presenceSocketUrl(apiBaseUrl: string): string {
  const base = apiBaseUrl
    .replace(/\/+$/, '')
    .replace(/^http(s?):\/\//i, 'ws$1://');
  return `${base}/ws/presence`;
}

/** First reconnect waits about this long; every failed attempt doubles it… */
export const RECONNECT_BASE_MS = 1_000;
/** …up to this cap. */
export const RECONNECT_MAX_MS = 30_000;

/**
 * Wait before reconnect attempt number `attempt` (0-based): exponential backoff
 * with "equal jitter" — half of the step is fixed, half random — so the delay is
 * never zero and clients that lost the server together don't come back together.
 * attempt 0 → 0.5–1 s, 1 → 1–2 s, 2 → 2–4 s, … capped at 15–30 s.
 */
export function reconnectDelayMs(
  attempt: number,
  random: () => number = Math.random,
): number {
  const step = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
  return Math.round(step / 2 + (step / 2) * random());
}

/**
 * The handshake was refused because of the access token. React Native has no
 * HTTP status for a failed upgrade: it reports a close with code 1006 whose
 * reason is the native error text, which carries the status on both platforms
 * ("Received bad response code from server: 401." on iOS,
 * "Expected HTTP 101 response but was '401 Unauthorized'" on Android).
 */
export function isAuthRejection(event: {
  code?: number;
  reason?: string;
}): boolean {
  return event.code === 1006 && /\b401\b/.test(event.reason ?? '');
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isPoint(value: unknown): value is GeoPoint {
  return (
    isObject(value) && Number.isFinite(value.lat) && Number.isFinite(value.lng)
  );
}

const STATUSES: readonly AnnouncementStatus[] = [
  'active',
  'cancelled',
  'finished',
];

function isAnnouncement(value: unknown): value is Announcement {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.pet_id) &&
    (value.spot_id === null || isString(value.spot_id)) &&
    (value.custom_point === null || isPoint(value.custom_point)) &&
    isTimestamp(value.starts_at) &&
    Number.isInteger(value.duration_min) &&
    STATUSES.includes(value.status as AnnouncementStatus) &&
    isTimestamp(value.created_at)
  );
}

/**
 * A server message from a socket frame, or null for anything else (not JSON,
 * an unknown type, a malformed body) — those are ignored.
 */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') {
    return null;
  }
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isObject(message)) {
    return null;
  }
  switch (message.type) {
    case 'spot_update':
      return isString(message.spot_id) &&
        Number.isInteger(message.present_count) &&
        (message.present_count as number) >= 0
        ? {
            type: 'spot_update',
            spot_id: message.spot_id,
            present_count: message.present_count as number,
          }
        : null;
    case 'announcement_created':
      return isAnnouncement(message.announcement)
        ? { type: 'announcement_created', announcement: message.announcement }
        : null;
    default:
      return null;
  }
}
