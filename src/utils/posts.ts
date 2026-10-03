import { ApiError } from '../api/client';
import type { Id, PostCreateRequest } from '../types';
import type { PlaceSpot } from './announcements';
import { describeError } from './errors';

/** Backend limits of POST /posts (it allows 10 photos; the app keeps posts lighter). */
export const MAX_POST_TEXT_LENGTH = 5000;
export const MAX_POST_PHOTOS = 6;

/** Feed page size (backend default 20, max 50). */
export const FEED_PAGE_SIZE = 20;

export interface PostInput {
  petId: Id;
  text: string;
  /** Uploaded photo URLs (POST /uploads), in display order. */
  photoUrls: string[];
  /** The walk spot the post is tagged with, if any. */
  spot: PlaceSpot | null;
}

/** POST /posts body: trimmed text; spot_id and photo_urls only when present. */
export function buildPostRequest({
  petId,
  text,
  photoUrls,
  spot,
}: PostInput): PostCreateRequest {
  return {
    pet_id: petId,
    text: text.trim(),
    ...(spot ? { spot_id: spot.id } : {}),
    ...(photoUrls.length > 0 ? { photo_urls: photoUrls } : {}),
  };
}

export interface PostFormValues {
  petId: Id | null;
  text: string;
  photoCount: number;
}

export interface PostFormErrors {
  pet?: string;
  text?: string;
}

/** Client-side checks matching the backend rules; empty object when the post can be sent. */
export function validatePostForm({
  petId,
  text,
  photoCount,
}: PostFormValues): PostFormErrors {
  const errors: PostFormErrors = {};
  if (!petId) {
    errors.pet = 'Выберите питомца';
  }
  const trimmed = text.trim();
  if (!trimmed && photoCount === 0) {
    errors.text = 'Напишите пару слов или добавьте фото';
  } else if ([...trimmed].length > MAX_POST_TEXT_LENGTH) {
    errors.text = `Не длиннее ${MAX_POST_TEXT_LENGTH} символов`;
  }
  return errors;
}

/** Message for a failed POST /posts. */
export function describeCreatePostError(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    // posts.spot_id references a walk spot that no longer exists.
    if (error.body?.error?.includes('spot_id')) {
      return 'Место не найдено — уберите отметку места';
    }
    return 'Пост не принят: проверьте текст и фото';
  }
  return describeError(error, {
    403: 'Можно писать только от имени своих питомцев',
    404: 'Питомец не найден',
  });
}

/** Message for a failed DELETE /posts/{id}. */
export function describeDeletePostError(error: unknown): string {
  return describeError(error, {
    403: 'Удалять можно только посты своих питомцев',
  });
}
