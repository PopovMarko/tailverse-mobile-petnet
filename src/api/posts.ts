import type { Id, Post, PostCreateRequest, PostsPageResponse } from '../types';
import { request } from './client';

export interface PostsPageQuery {
  /** Only posts tagged with this walk spot; the whole feed when absent. */
  spotId?: Id | null;
  /** next_cursor of the previous page. */
  cursor?: string | null;
  /** Page size, 1..50 (backend default 20). */
  limit?: number;
}

/** GET /posts — the shared feed, newest first, one page at a time. */
export function listPosts({ spotId, cursor, limit }: PostsPageQuery = {}) {
  return request<PostsPageResponse>('/posts', {
    query: {
      spot_id: spotId ?? undefined,
      cursor: cursor ?? undefined,
      limit,
    },
  });
}

/** GET /posts/{id} */
export function getPost(id: Id) {
  return request<Post>(`/posts/${encodeURIComponent(id)}`);
}

/**
 * POST /posts on behalf of the owner's pet. 400 — no text and no photos, text
 * over 5 000 characters, over 10 photos or a non-http(s) photo URL;
 * 403/404 — not the owner's pet.
 */
export function createPost(body: PostCreateRequest) {
  return request<Post>('/posts', { method: 'POST', body, auth: true });
}

/** DELETE /posts/{id} — only the owner of the post's pet; 404 when it is gone. */
export function deletePost(id: Id) {
  return request<void>(`/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}
