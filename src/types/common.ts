// Shared primitives used across API types.
// Field names mirror the backend JSON (snake_case) exactly.

/** UUID string. */
export type Id = string;

/** RFC 3339 timestamp, e.g. "2026-09-30T10:15:00Z". */
export type Timestamp = string;

/** Calendar date in "YYYY-MM-DD" format. */
export type DateString = string;

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Error body returned by the backend for any non-2xx response. */
export interface ApiErrorBody {
  msg: string;
  error: string;
}
