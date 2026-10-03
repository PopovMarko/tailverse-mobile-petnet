import { useCallback, useRef, useState } from 'react';

import { uploadImage } from '../api';
import type { UploadFile } from '../types';
import { describeError } from '../utils/errors';

export type PhotoUploadStatus = 'uploading' | 'done' | 'error';

/** A photo picked for a post: the local file and its POST /uploads state. */
export interface PhotoUpload {
  key: string;
  file: UploadFile;
  status: PhotoUploadStatus;
  /** Absolute URL from POST /uploads once uploaded. */
  url: string | null;
  error: string | null;
}

export interface PhotoUploads {
  photos: PhotoUpload[];
  /** Adds the files and starts uploading each of them right away. */
  add: (files: UploadFile[]) => void;
  /** Drops a photo (an upload still in flight is ignored when it finishes). */
  remove: (key: string) => void;
  /** Uploads a failed photo again. */
  retry: (key: string) => void;
  /** Some photo is still uploading. */
  uploading: boolean;
  /** Some photo failed to upload. */
  failed: boolean;
  /** URLs of the uploaded photos, in the order they were picked. */
  urls: string[];
}

const UPLOAD_ERRORS = {
  413: 'Слишком большое',
  415: 'Формат не подходит',
};

/**
 * Photos of a form, each uploaded via POST /uploads as soon as it is picked, so
 * the form can show per-photo progress and errors and send just the URLs.
 */
export function usePhotoUploads(): PhotoUploads {
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const nextKey = useRef(0);

  const update = useCallback((key: string, patch: Partial<PhotoUpload>) => {
    setPhotos(list =>
      list.map(photo => (photo.key === key ? { ...photo, ...patch } : photo)),
    );
  }, []);

  const upload = useCallback(
    (key: string, file: UploadFile) => {
      uploadImage(file).then(
        ({ url }) => update(key, { status: 'done', url, error: null }),
        (error: unknown) =>
          update(key, {
            status: 'error',
            error: describeError(error, UPLOAD_ERRORS),
          }),
      );
    },
    [update],
  );

  const add = useCallback(
    (files: UploadFile[]) => {
      const added = files.map(file => ({
        key: `photo-${++nextKey.current}`,
        file,
        status: 'uploading' as const,
        url: null,
        error: null,
      }));
      setPhotos(list => [...list, ...added]);
      added.forEach(photo => upload(photo.key, photo.file));
    },
    [upload],
  );

  const remove = useCallback((key: string) => {
    setPhotos(list => list.filter(photo => photo.key !== key));
  }, []);

  const retry = useCallback(
    (key: string) => {
      const photo = photos.find(item => item.key === key);
      if (photo?.status === 'error') {
        update(key, { status: 'uploading', error: null });
        upload(key, photo.file);
      }
    },
    [photos, update, upload],
  );

  return {
    photos,
    add,
    remove,
    retry,
    uploading: photos.some(photo => photo.status === 'uploading'),
    failed: photos.some(photo => photo.status === 'error'),
    urls: photos.flatMap(photo => (photo.url ? [photo.url] : [])),
  };
}
