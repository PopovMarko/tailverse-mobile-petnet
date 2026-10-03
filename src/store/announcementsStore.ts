import { create } from 'zustand';

import {
  ApiError,
  createAnnouncement as createAnnouncementRequest,
  getPet,
  getWalkSpot,
  listAnnouncements,
} from '../api';
import type { Announcement, GeoPoint, Id, Pet } from '../types';
import {
  buildAnnouncementRequest,
  walkEnd,
  type AnnouncementInput,
} from '../utils/announcements';
import { describeError } from '../utils/errors';
import { distanceM } from '../utils/geo';
import { useAuthStore } from './authStore';
import type { LoadStatus } from './walkSpotsStore';

/** How far from the user (or the chosen place) the list looks for walks. */
export const ANNOUNCEMENTS_RADIUS_M = 5_000;

export interface AnnouncementsQuery {
  center: GeoPoint;
  radiusM: number;
}

/** What the list needs to know about a walk's spot. */
export interface SpotInfo {
  name: string;
  lat: number;
  lng: number;
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
   * The list endpoint has only ids, so names are loaded separately and cached:
   * pet names from GET /pets/{id} (the owner's own pets come from the auth store),
   * spots from GET /walkspots/{id} (null — the spot no longer exists).
   */
  petNames: Record<Id, string>;
  spots: Record<Id, SpotInfo | null>;

  /** Loads the walks within radiusM of center (GET /announcements). */
  fetchAnnouncements: (center: GeoPoint, radiusM?: number) => Promise<void>;
  /** Reloads the last area without the loading state (pull-to-refresh). */
  refresh: () => Promise<void>;
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
const pendingPets = new Set<Id>();
const pendingSpots = new Map<Id, Promise<SpotInfo | null>>();

function ownPets(): Pet[] {
  return useAuthStore.getState().pets;
}

/** Name of the walk's pet for display: own pets, then the loaded names. */
export function petNameOf(
  petId: Id,
  petNames: Record<Id, string>,
  myPets: Pet[],
): string | null {
  return myPets.find(pet => pet.id === petId)?.name ?? petNames[petId] ?? null;
}

/** Puts `announcement` first, dropping an older copy of it. */
function withFirst(list: Announcement[], announcement: Announcement) {
  return [announcement, ...list.filter(item => item.id !== announcement.id)];
}

export const useAnnouncementsStore = create<AnnouncementsState>()(
  (set, get) => {
    /** GET /walkspots/{id} once per spot; resolves to the cached info. */
    function loadSpot(spotId: Id): Promise<SpotInfo | null> {
      const cached = get().spots[spotId];
      if (cached !== undefined) {
        return Promise.resolve(cached);
      }
      const pending = pendingSpots.get(spotId);
      if (pending) {
        return pending;
      }
      const started = generation;
      const promise = getWalkSpot(spotId)
        .then(
          spot => ({ name: spot.name, lat: spot.lat, lng: spot.lng }),
          (error: unknown) => {
            if (error instanceof ApiError && error.status === 404) {
              return null;
            }
            throw error;
          },
        )
        .then(info => {
          // Never overwrite what is known meanwhile (e.g. the spot of a walk just created).
          if (started === generation && get().spots[spotId] === undefined) {
            set(state => ({ spots: { ...state.spots, [spotId]: info } }));
          }
          return get().spots[spotId] ?? info;
        })
        .finally(() => pendingSpots.delete(spotId));
      pendingSpots.set(spotId, promise);
      return promise;
    }

    function loadPetName(petId: Id) {
      if (
        get().petNames[petId] !== undefined ||
        pendingPets.has(petId) ||
        ownPets().some(pet => pet.id === petId)
      ) {
        return;
      }
      pendingPets.add(petId);
      const started = generation;
      getPet(petId)
        .then(pet => {
          if (started === generation) {
            set(state => ({
              petNames: { ...state.petNames, [petId]: pet.name },
            }));
          }
        })
        .catch(() => {
          // Shown as "Питомец"; the next reload tries again.
        })
        .finally(() => pendingPets.delete(petId));
    }

    /** Loads the names the list is missing, in the background. */
    function loadNames(announcements: Announcement[]) {
      for (const announcement of announcements) {
        loadPetName(announcement.pet_id);
        if (announcement.spot_id) {
          loadSpot(announcement.spot_id).catch(() => {
            // Shown as "Площадка"; the next reload tries again.
          });
        }
      }
    }

    async function load(query: AnnouncementsQuery, refreshing: boolean) {
      const requestId = ++latestListRequest;
      set(
        refreshing
          ? { refreshing: true, query }
          : { status: 'loading', error: null, query },
      );
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
        if (requestId === latestListRequest) {
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
        load({ center, radiusM }, false),

      refresh: async () => {
        const query = get().query;
        if (query) {
          await load(query, true);
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
        pendingPets.clear();
        pendingSpots.clear();
        set(initialState);
      },
    };
  },
);

// The list and its names belong to the signed-in session.
useAuthStore.subscribe((state, previous) => {
  if (state.status === 'signedOut' && previous.status !== 'signedOut') {
    useAnnouncementsStore.getState().reset();
  }
});
