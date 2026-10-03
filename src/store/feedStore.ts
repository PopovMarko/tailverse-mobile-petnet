import { create } from 'zustand';

import {
  ApiError,
  createPost as createPostRequest,
  deletePost as deletePostRequest,
  listPosts,
} from '../api';
import type { Id, Post } from '../types';
import { describeError } from '../utils/errors';
import {
  buildPostRequest,
  FEED_PAGE_SIZE,
  type PostInput,
} from '../utils/posts';
import { removedPetIds, useAuthStore } from './authStore';
import { createNameCache, type SpotInfo } from './nameCache';
import type { LoadStatus } from './walkSpotsStore';

interface FeedState {
  /** Loaded pages of the feed, newest first (a post created here goes on top). */
  posts: Post[];
  /** Cursor of the next page; null when the last page is loaded (or nothing is). */
  nextCursor: string | null;
  /** State of the first page; the list is kept while reloading. */
  status: LoadStatus;
  error: string | null;
  /** Pull-to-refresh in progress. */
  refreshing: boolean;
  /** The next page is loading (infinite scroll). */
  loadingMore: boolean;
  /** Why the last next-page request failed; it is not retried until asked. */
  loadMoreError: string | null;
  /** Only posts tagged with this walk spot; null — the whole (global) feed. */
  spotId: Id | null;

  /** Name caches for the posts' pets and spots (see createNameCache). */
  petNames: Record<Id, string>;
  spots: Record<Id, SpotInfo | null>;

  /** (Re)loads the first page of the current filter (GET /posts). */
  loadFirstPage: () => Promise<void>;
  /**
   * Appends the next page. Does nothing on the last page or while the first page
   * is loading/refreshing; concurrent calls share one request, and a page that
   * arrives after the filter changed or the feed was refreshed is dropped.
   */
  loadMore: () => Promise<void>;
  /** Reloads the first page without the loading state (pull-to-refresh). */
  refresh: () => Promise<void>;
  /**
   * Shows only the posts of `spotId` (null — the whole feed) and loads its first
   * page. `spot` puts the place's name into the cache when the caller knows it.
   */
  setSpotFilter: (spotId: Id | null, spot?: SpotInfo) => Promise<void>;
  /**
   * POST /posts (photos already uploaded); the new post goes on top. When the feed
   * is filtered by another place, the filter is dropped so the post is visible.
   * Rejects with the ApiError/network error (see describeCreatePostError).
   */
  createPost: (input: PostInput) => Promise<Post>;
  /**
   * DELETE /posts/{id} and drops the post from the list (a post that is already
   * gone counts as deleted). Rejects with the error (see describeDeletePostError).
   */
  deletePost: (id: Id) => Promise<void>;

  /** Loads the missing pet names and spots of these posts, in the background. */
  ensureNames: (posts: Post[]) => void;
  /** The spot's name and position from the cache, else GET /walkspots/{id} (null — no such spot). */
  resolveSpot: (spotId: Id) => Promise<SpotInfo | null>;

  /** Forgets everything, e.g. on logout. */
  reset: () => void;
}

const initialState = {
  posts: [],
  nextCursor: null,
  status: 'idle',
  error: null,
  refreshing: false,
  loadingMore: false,
  loadMoreError: null,
  spotId: null,
  petNames: {},
  spots: {},
} satisfies Partial<FeedState>;

// Bumped whenever the list starts over (first page, refresh, filter change, reset):
// pages requested for an older list are dropped.
let listVersion = 0;
// Bumped by reset(): responses to requests started before a logout are dropped.
let generation = 0;
let loadMoreInFlight: Promise<void> | null = null;

/** Adds the posts that are not in the list yet, keeping the order. */
function appendNew(list: Post[], page: Post[]): Post[] {
  const known = new Set(list.map(post => post.id));
  return [...list, ...page.filter(post => !known.has(post.id))];
}

export const useFeedStore = create<FeedState>()((set, get) => {
  const names = createNameCache(get, set);

  async function loadFirst(refreshing: boolean) {
    const version = ++listVersion;
    loadMoreInFlight = null;
    const { spotId } = get();
    set({
      ...(refreshing
        ? { refreshing: true }
        : { status: 'loading', error: null }),
      loadingMore: false,
      loadMoreError: null,
    });
    try {
      const page = await listPosts({ spotId, limit: FEED_PAGE_SIZE });
      if (version !== listVersion) {
        return;
      }
      set({
        posts: page.posts,
        nextCursor: page.next_cursor,
        status: 'success',
        error: null,
        refreshing: false,
      });
      names.loadNames(page.posts);
    } catch (error) {
      if (version === listVersion) {
        set({
          status: 'error',
          error: describeError(error),
          refreshing: false,
        });
      }
    }
  }

  return {
    ...initialState,

    loadFirstPage: () => loadFirst(false),

    refresh: () => loadFirst(true),

    loadMore: () => {
      if (loadMoreInFlight) {
        return loadMoreInFlight;
      }
      const { nextCursor, refreshing, status, spotId } = get();
      if (!nextCursor || refreshing || status === 'loading') {
        return Promise.resolve();
      }
      const version = listVersion;
      set({ loadingMore: true, loadMoreError: null });
      const promise = listPosts({
        spotId,
        cursor: nextCursor,
        limit: FEED_PAGE_SIZE,
      })
        .then(
          page => {
            if (version !== listVersion) {
              return;
            }
            set(state => ({
              posts: appendNew(state.posts, page.posts),
              nextCursor: page.next_cursor,
              loadingMore: false,
            }));
            names.loadNames(page.posts);
          },
          (error: unknown) => {
            if (version === listVersion) {
              set({ loadingMore: false, loadMoreError: describeError(error) });
            }
          },
        )
        .finally(() => {
          if (loadMoreInFlight === promise) {
            loadMoreInFlight = null;
          }
        });
      loadMoreInFlight = promise;
      return promise;
    },

    setSpotFilter: (spotId, spot) => {
      if (spotId && spot) {
        names.rememberSpot(spotId, spot);
      } else if (spotId) {
        names.loadSpot(spotId).catch(() => {
          // Shown as "Площадка" until a reload.
        });
      }
      if (spotId === get().spotId && get().status !== 'idle') {
        return Promise.resolve();
      }
      set({ spotId, posts: [], nextCursor: null });
      return loadFirst(false);
    },

    createPost: async input => {
      const started = generation;
      const created = await createPostRequest(buildPostRequest(input));
      if (started !== generation) {
        return created;
      }
      if (input.spot) {
        const { id, name, lat, lng } = input.spot;
        names.rememberSpot(id, { name, lat, lng });
      }
      const { spotId } = get();
      if (spotId === null || created.spot_id === spotId) {
        set(state => ({
          posts: [
            created,
            ...state.posts.filter(post => post.id !== created.id),
          ],
        }));
      } else {
        // The feed shows another place: the whole feed starts with the new post.
        get().setSpotFilter(null);
      }
      names.loadNames([created]);
      return created;
    },

    deletePost: async id => {
      const started = generation;
      try {
        await deletePostRequest(id);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) {
          throw error;
        }
      }
      if (started === generation) {
        set(state => ({ posts: state.posts.filter(post => post.id !== id) }));
      }
    },

    ensureNames: names.loadNames,
    resolveSpot: names.loadSpot,

    reset: () => {
      generation++;
      listVersion++;
      loadMoreInFlight = null;
      names.clear();
      set(initialState);
    },
  };
});

// The feed's filter and caches belong to the signed-in session; a deleted pet's
// posts are deleted with it.
useAuthStore.subscribe((state, previous) => {
  if (state.status === 'signedOut' && previous.status !== 'signedOut') {
    useFeedStore.getState().reset();
    return;
  }
  const removed = removedPetIds(previous.pets, state.pets);
  if (removed.size > 0) {
    useFeedStore.setState(feed => ({
      posts: feed.posts.filter(post => !removed.has(post.pet_id)),
    }));
  }
});
