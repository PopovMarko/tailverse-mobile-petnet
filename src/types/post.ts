import type { Id, Timestamp } from './common';

export interface Post {
  id: Id;
  pet_id: Id;
  spot_id: Id | null;
  text: string;
  photo_urls: string[];
  created_at: Timestamp;
}

/** POST /posts */
export interface PostCreateRequest {
  pet_id: Id;
  spot_id?: Id | null;
  text: string;
  photo_urls?: string[];
}

/** GET /posts — pass next_cursor back as ?cursor= to load the next page. */
export interface PostsPageResponse {
  posts: Post[];
  next_cursor: string | null;
}
