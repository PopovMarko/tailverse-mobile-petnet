import { ApiError } from '../api/client';
import type {
  Gender,
  Owner,
  OwnerUpdateRequest,
  OwnerVisibility,
} from '../types';
import { formatMonthYear } from './date';
import { describeError } from './errors';

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Мужской',
  female: 'Женский',
  other: 'Другой',
};

/** Russian name of a gender; "Не указан" when it is not set. */
export function genderLabel(gender: Gender | null): string {
  return gender ? GENDER_LABELS[gender] : 'Не указан';
}

/** First letter of the nickname for an avatar without a photo. */
export function nicknameInitial(nickname: string): string {
  const first = Array.from(nickname.trim())[0];
  return first ? first.toUpperCase() : '?';
}

/** The owner's profile as the edit form ends it. */
export interface OwnerProfileValues {
  nickname: string;
  gender: Gender | null;
  /** Absolute URL of the avatar (already uploaded); null — no photo. */
  avatarUrl: string | null;
  visibility: OwnerVisibility;
}

/**
 * PATCH /owners/me body with only what changed (empty — nothing to save).
 * A removed gender or avatar is sent as "" (the backend clears it).
 */
export function buildOwnerUpdateRequest(
  owner: Owner,
  values: OwnerProfileValues,
): OwnerUpdateRequest {
  const body: OwnerUpdateRequest = {};
  const nickname = values.nickname.trim();
  if (nickname !== owner.nickname) {
    body.nickname = nickname;
  }
  if (values.gender !== owner.gender) {
    body.gender = values.gender ?? '';
  }
  if (values.avatarUrl !== owner.avatar_url) {
    body.avatar_url = values.avatarUrl ?? '';
  }
  const visibility: Partial<OwnerVisibility> = {};
  if (values.visibility.gender !== owner.visibility.gender) {
    visibility.gender = values.visibility.gender;
  }
  if (values.visibility.avatar_url !== owner.visibility.avatar_url) {
    visibility.avatar_url = values.visibility.avatar_url;
  }
  if (Object.keys(visibility).length > 0) {
    body.visibility = visibility;
  }
  return body;
}

/** Message for a failed PATCH /owners/me (or the avatar upload before it). */
export function describeProfileSaveError(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    const text = error.body?.error ?? '';
    if (text.includes('nickname')) {
      return 'Никнейм — от 1 до 50 символов';
    }
    if (text.includes('avatar_url')) {
      return 'Не удалось сохранить фото, попробуйте другое';
    }
    if (text.includes('gender')) {
      return 'Выберите пол из списка';
    }
  }
  return describeError(error);
}

/** "В Tailverse с октября 2026"; null if the timestamp is unparsable. */
export function formatMemberSince(timestamp: string): string | null {
  const time = Date.parse(timestamp);
  return Number.isNaN(time)
    ? null
    : `В Tailverse с ${formatMonthYear(new Date(time))}`;
}
