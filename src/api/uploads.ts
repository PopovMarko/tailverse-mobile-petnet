import type { UploadFile, UploadResponse } from '../types';
import { request } from './client';

/**
 * POST /uploads — stores an image and returns its absolute URL (e.g. for avatar_url).
 * 413 when the file is over 10 MB, 415 for anything but jpeg/png/webp/heic.
 */
export function uploadImage(file: UploadFile) {
  const form = new FormData();
  // React Native's FormData takes a { uri, type, name } object for files.
  form.append('file', file as unknown as Blob);
  return request<UploadResponse>('/uploads', {
    method: 'POST',
    body: form,
    auth: true,
  });
}
