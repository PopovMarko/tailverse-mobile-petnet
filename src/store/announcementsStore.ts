import { create } from 'zustand';

import {
  createAnnouncement as createAnnouncementRequest,
  listAnnouncements,
} from '../api';
import type { Announcement, GeoPoint, Id } from '../types';
import {
  buildAnnouncementRequest,
  walkEnd,
  type AnnouncementInput,
} from '../utils/announcements';
import { describeError } from '../utils/errors';
import { distanceM } from '../utils/geo';
import { removedPetIds, useAuthStore } from './authStore';
import { createNameCache, type SpotInfo } from './nameCache';
import type { LoadStatus } from './walkSpotsStore';

export { petNameOf, type SpotInfo } from './nameCache';

/** How far from the user (or the chosen place) the list looks for walks. */
export const ANNOUNCEMENTS_RADIUS_M = 5_000;

export interface AnnouncementsQuery {
  center: GeoPoint;
  radiusM: number;
}

interface AnnouncementsState {
  /** Active walks around `query`, newest additions (created here or live) first. */
  announcements: Announcement[];
  /** State of the last fetch; the list is kept while reloading. */
  status: LoadStatus;
  error: string | null;
  /** Pull-to-refresh in progress. */
  refreshing: boolean;
  /** The area of the last fetch, reused by refresh and the live-update area check. */
  query: AnnouncementsQuery | null;

  /**
   * The list endpoint has only ids, so names are loaded separately and cached
   * (see createNameCache): pet names, and spots (null — the spot no longer exists).
   */
  petNames: Record<Id, string>;
  spots: Record<Id, SpotInfo | null>;

  /** Loads the walks within radiusM of center (GET /announcements). */
  fetchAnnouncements: (center: GeoPoint, radiusM?: number) => Promise<void>;
  /** Reloads the last area without the loading state (pull-to-refresh). */
  refresh: () => Promise<void>;
  /**
   * Reloads the last area quietly — no loading or refreshing state, and a failure
   * keeps the list as it is. Used after the live connection comes back, since
   * `announcement_created` messages sent meanwhile were missed.
   */
  resync: () => Promise<void>;
  /**
   * POST /announcements for the owner's pet; the new walk goes to the top of the
   * list. Rejects with the ApiError/network error (see describeCreateError).
   */
  createAnnouncement: (input: AnnouncementInput) => Promise<Announcement>;
  /**
   * A walk was announced somewhere (realtime `announcement_created` message, as is).
   * Added to the top when it is active, not over and inside the list's area;
   * a walk already in the list is replaced in place. Names load in the background.
   */
  applyAnnouncementCreated: (announcement: Announcement) => void;
  /** Loads the missing pet names and spots of these walks into the caches, in the background. */
  ensureNames: (announcements: Announcement[]) => void;

  /** Forgets everything, e.g. on logout. */
  reset: () => void;
}

const initialState = {
  announcements: [],
  status: 'idle',
  error: null,
  refreshing: false,
  query: null,
  petNames: {},
  spots: {},
} satisfies Partial<AnnouncementsState>;

// Only the latest list request may write (the centre can change while one is in flight).
let latestListRequest = 0;
// Bumped by reset(): responses to requests started before a logout are dropped.
let generation = 0;

/** Puts `announcement` first, dropping an older copy of it. */
function withFirst(list: Announcement[], announcement: Announcement) {
  return [announcement, ...list.filter(item => item.id !== announcement.id)];
}

export const useAnnouncementsStore = create<AnnouncementsState>()(
  (set, get) => {
    const {
      loadSpot,
      loadNames,
      clear: clearNames,
    } = createNameCache(get, set);

    async function load(
      query: AnnouncementsQuery,
      mode: 'loading' | 'refreshing' | 'silent',
    ) {
      const requestId = ++latestListRequest;
      if (mode === 'loading') {
        set({ status: 'loading', error: null, query });
      } else if (mode === 'refreshing') {
        set({ refreshing: true, query });
      }
      try {
        const { announcements } = await listAnnouncements(
          query.center,
          query.radiusM,
        );
        if (requestId === latestListRequest) {
          set({
            announcements,
            status: 'success',
            error: null,
            refreshing: false,
          });
          loadNames(announcements);
        }
      } catch (error) {
        if (requestId !== latestListRequest) {
          return;
        }
        if (mode === 'silent' && get().status !== 'loading') {
          // Keep the list; just end a pull-to-refresh this request replaced.
          set({ refreshing: false });
        } else {
          set({
            status: 'error',
            error: describeError(error),
            refreshing: false,
          });
        }
      }
    }

    /** Where the walk is, or null when its spot is unknown. */
    async function placeOf(announcement: Announcement) {
      if (announcement.custom_point) {
        return announcement.custom_point;
      }
      if (announcement.spot_id) {
        return loadSpot(announcement.spot_id).catch(() => null);
      }
      return null;
    }

    return {
      ...initialState,

      fetchAnnouncements: (center, radiusM = ANNOUNCEMENTS_RADIUS_M) =>
        load({ center, radiusM }, 'loading'),

      refresh: async () => {
        const query = get().query;
        if (query) {
          await load(query, 'refreshing');
        }
      },

      resync: async () => {
        const query = get().query;
        if (query) {
          await load(query, 'silent');
        }
      },

      createAnnouncement: async input => {
        const started = generation;
        const created = await createAnnouncementRequest(
          buildAnnouncementRequest(input),
        );
        if (started === generation) {
          const { place } = input;
          set(state => ({
            announcements: withFirst(state.announcements, created),
            spots:
              place.kind === 'spot'
                ? {
                    ...state.spots,
                    [place.spot.id]: {
                      name: place.spot.name,
                      lat: place.spot.lat,
                      lng: place.spot.lng,
                    },
                  }
                : state.spots,
          }));
          loadNames([created]);
        }
        return created;
      },

      applyAnnouncementCreated: announcement => {
        if (
          announcement.status !== 'active' ||
          walkEnd(announcement).getTime() <= Date.now()
        ) {
          return;
        }
        if (get().announcements.some(item => item.id === announcement.id)) {
          set(state => ({
            announcements: state.announcements.map(item =>
              item.id === announcement.id ? announcement : item,
            ),
          }));
          return;
        }
        const query = get().query;
        if (!query) {
          // No list yet: the first fetch will include it if it is nearby.
          return;
        }
        const started = generation;
        placeOf(announcement).then(place => {
          if (
            started !== generation ||
            get().query !== query ||
            !place ||
            distanceM(place, query.center) > query.radiusM
          ) {
            return;
          }
          set(state => ({
            announcements: withFirst(state.announcements, announcement),
          }));
          loadNames([announcement]);
        });
      },

      ensureNames: loadNames,

      reset: () => {
        generation++;
        latestListRequest++;
        clearNames();
        set(initialState);
      },
    };
  },
);

// The list and its names belong to the signed-in session; a deleted pet's walks
// are deleted with it.
useAuthStore.subscribe((state, previous) => {
  if (state.status === 'signedOut' && previous.status !== 'signedOut') {
    useAnnouncementsStore.getState().reset();
    return;
  }
  const removed = removedPetIds(previous.pets, state.pets);
  if (removed.size > 0) {
    useAnnouncementsStore.setState(list => ({
      announcements: list.announcements.filter(
        announcement => !removed.has(announcement.pet_id),
      ),
    }));
  }
});
