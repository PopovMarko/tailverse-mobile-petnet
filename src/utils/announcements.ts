import { ApiError } from '../api/client';
import type {
  Announcement,
  AnnouncementCreateRequest,
  GeoPoint,
  Id,
} from '../types';
import { formatDuration } from './date';
import { describeError } from './errors';

/** Backend limits of POST /announcements. */
export const MAX_DURATION_MIN = 12 * 60;
export const MAX_START_AHEAD_DAYS = 30;
/** A start this far in the past still counts as "now" (the form was open a while). */
export const START_GRACE_MIN = 5;

/** Durations offered as chips; any other value is typed in. */
export const DURATION_PRESETS = [30, 60, 90, 120] as const;

/** A walk spot chosen for the walk (from the nearby list or passed in by another screen). */
export interface PlaceSpot {
  id: Id;
  name: string;
  lat: number;
  lng: number;
  /** Metres from where the user is, when known. */
  distance_m?: number;
}

/** Where the walk is: a walk spot or a point on the map — always exactly one. */
export type WalkPlace =
  | { kind: 'spot'; spot: PlaceSpot }
  | { kind: 'point'; point: GeoPoint };

export interface AnnouncementInput {
  petId: Id;
  startsAt: Date;
  durationMin: number;
  place: WalkPlace;
}

/** POST /announcements body: spot_id or custom_point, never both and never neither. */
export function buildAnnouncementRequest({
  petId,
  startsAt,
  durationMin,
  place,
}: AnnouncementInput): AnnouncementCreateRequest {
  const fields = {
    pet_id: petId,
    starts_at: startsAt.toISOString(),
    duration_min: durationMin,
  };
  switch (place.kind) {
    case 'spot':
      return { ...fields, spot_id: place.spot.id };
    case 'point':
      return {
        ...fields,
        custom_point: { lat: place.point.lat, lng: place.point.lng },
      };
  }
}

export interface AnnouncementFormValues {
  petId: Id | null;
  startsAt: Date;
  /** Null when the custom duration is empty or not a whole number. */
  durationMin: number | null;
  place: WalkPlace | null;
}

export interface AnnouncementFormErrors {
  pet?: string;
  startsAt?: string;
  duration?: string;
  place?: string;
}

/** Client-side checks matching the backend rules; empty object when the form can be sent. */
export function validateAnnouncementForm(
  values: AnnouncementFormValues,
  now: Date = new Date(),
): AnnouncementFormErrors {
  const errors: AnnouncementFormErrors = {};
  if (!values.petId) {
    errors.pet = 'Выберите питомца';
  }
  const start = values.startsAt.getTime();
  if (start < now.getTime() - START_GRACE_MIN * 60_000) {
    errors.startsAt = 'Это время уже прошло — выберите другое';
  } else if (start > now.getTime() + MAX_START_AHEAD_DAYS * 24 * 3600_000) {
    errors.startsAt = `Не позже чем через ${MAX_START_AHEAD_DAYS} дней`;
  }
  if (
    values.durationMin === null ||
    !Number.isInteger(values.durationMin) ||
    values.durationMin <= 0 ||
    values.durationMin > MAX_DURATION_MIN
  ) {
    errors.duration = `Укажите длительность от 1 минуты до ${formatDuration(
      MAX_DURATION_MIN,
    )}`;
  }
  if (!values.place) {
    errors.place = 'Выберите место прогулки';
  }
  return errors;
}

/** Whole minutes from a text field ("45" → 45); null for anything else. */
export function parseDurationInput(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,4}$/.test(trimmed) ? Number(trimmed) : null;
}

/** Where a walk stands at `now`, by its status and time. */
export type WalkPhase = 'upcoming' | 'ongoing' | 'ended' | 'cancelled';

export function walkPhase(
  announcement: Pick<Announcement, 'status' | 'starts_at' | 'duration_min'>,
  now: Date = new Date(),
): WalkPhase {
  if (announcement.status === 'cancelled') {
    return 'cancelled';
  }
  if (announcement.status === 'finished') {
    return 'ended';
  }
  const start = Date.parse(announcement.starts_at);
  const end = start + announcement.duration_min * 60_000;
  if (now.getTime() < start) {
    return 'upcoming';
  }
  return now.getTime() < end ? 'ongoing' : 'ended';
}

export const WALK_PHASE_LABELS: Record<WalkPhase, string> = {
  upcoming: 'Запланирована',
  ongoing: 'Идёт сейчас',
  ended: 'Завершилась',
  cancelled: 'Отменена',
};

/** The walk's end time (start + duration). */
export function walkEnd(
  announcement: Pick<Announcement, 'starts_at' | 'duration_min'>,
): Date {
  return new Date(
    Date.parse(announcement.starts_at) + announcement.duration_min * 60_000,
  );
}

function backendError(error: unknown): string {
  return error instanceof ApiError ? error.body?.error ?? '' : '';
}

/** Russian message for a failed POST /announcements. */
export function describeCreateError(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    const text = backendError(error);
    if (text.includes('starts_at')) {
      return `Время начала — не раньше чем час назад и не позже чем через ${MAX_START_AHEAD_DAYS} дней`;
    }
    if (text.includes('duration_min') || text.includes('DurationMin')) {
      return `Длительность — от 1 минуты до ${formatDuration(
        MAX_DURATION_MIN,
      )}`;
    }
    if (text.includes('spot_id') || text.includes('custom_point')) {
      return 'Выберите одно место: площадку или точку на карте';
    }
    if (text.includes('coordinates')) {
      return 'Точка на карте выбрана неверно';
    }
    if (text.includes('referenced entity')) {
      return 'Площадка не найдена — выберите другое место';
    }
  }
  return describeError(error, {
    403: 'Объявить прогулку можно только со своим питомцем',
    404: 'Питомец не найден',
  });
}

/** Russian message for a failed join (POST /announcements/{id}/join). */
export function describeJoinError(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    const text = backendError(error);
    if (text.includes('already ended')) {
      return 'Прогулка уже закончилась';
    }
    if (text.includes('leads this walk')) {
      return 'Этот питомец и так ведёт прогулку';
    }
    if (text.includes('announcement is')) {
      return 'Прогулка отменена';
    }
  }
  return describeError(error, {
    403: 'Можно добавлять только своих питомцев',
    404: 'Прогулка не найдена',
    409: 'Этот питомец уже идёт на прогулку',
  });
}
