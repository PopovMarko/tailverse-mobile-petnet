/** POST /uploads — absolute URL of the stored file, e.g. for avatar_url. */
export interface UploadResponse {
  url: string;
}

/** A local file to send as multipart/form-data (React Native's FormData file shape). */
export interface UploadFile {
  uri: string;
  /** MIME type, e.g. "image/jpeg". The backend accepts jpeg/png/webp/heic up to 10 MB. */
  type: string;
  name: string;
}
