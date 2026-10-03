import type {
  Asset,
  CameraOptions,
  ImagePickerResponse,
} from 'react-native-image-picker';

import type { UploadFile } from '../types';

/** POST /uploads rejects files over 10 MB (413). */
export const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Downscaled JPEG: small enough to upload fast and always within the backend's
 * 10 MB / type limits.
 */
export function pickerOptions(maxSide: number): CameraOptions {
  return {
    mediaType: 'photo',
    maxWidth: maxSide,
    maxHeight: maxSide,
    quality: 0.8,
  };
}

/** Message for a picker response that failed; null when it did not. */
export function pickerErrorMessage(
  response: ImagePickerResponse,
): string | null {
  if (!response.errorCode) {
    return null;
  }
  return response.errorCode === 'camera_unavailable'
    ? 'Камера недоступна'
    : response.errorCode === 'permission'
    ? 'Нет доступа к фото. Разрешите его в настройках'
    : 'Не удалось выбрать фото';
}

/** The asset as a file for POST /uploads; null without a local URI. */
export function assetToUploadFile(
  asset: Asset,
  fallbackName: string,
): UploadFile | null {
  if (!asset.uri) {
    return null;
  }
  return {
    uri: asset.uri,
    type: asset.type ?? 'image/jpeg',
    name: asset.fileName ?? fallbackName,
  };
}

/** The asset is known to be larger than POST /uploads accepts. */
export function isTooLarge(asset: Asset): boolean {
  return asset.fileSize !== undefined && asset.fileSize > MAX_UPLOAD_FILE_SIZE;
}
