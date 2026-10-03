import { ApiError, getPet, getWalkSpot } from '../api';
import type { Id, Pet } from '../types';
import { useAuthStore } from './authStore';

/** What lists need to know about a walk spot they show by id. */
export interface SpotInfo {
  name: string;
  lat: number;
  lng: number;
}

/**
 * Store fields of the name caches: list endpoints carry only pet_id/spot_id, so
 * pet names come from GET /pets/{id} (the owner's own pets from the auth store)
 * and spots from GET /walkspots/{id} (null — the spot no longer exists).
 */
export interface NameCacheState {
  petNames: Record<Id, string>;
  spots: Record<Id, SpotInfo | null>;
}

/** An item that refers to a pet and maybe a spot (a walk, a post, …). */
export interface NamedItem {
  pet_id: Id;
  spot_id: Id | null;
}

/** Name of a pet for display: own pets first, then the loaded names. */
export function petNameOf(
  petId: Id,
  petNames: Record<Id, string>,
  myPets: Pet[],
): string | null {
  return myPets.find(pet => pet.id === petId)?.name ?? petNames[petId] ?? null;
}

export interface NameCache {
  /** GET /walkspots/{id} once per spot; resolves to the cached info. */
  loadSpot: (spotId: Id) => Promise<SpotInfo | null>;
  /** Stores a spot known from elsewhere (e.g. picked in a form) without a request. */
  rememberSpot: (spotId: Id, info: SpotInfo) => void;
  /** Loads the missing pet names and spots of these items, in the background. */
  loadNames: (items: NamedItem[]) => void;
  /** Drops pending requests; their responses are ignored (e.g. on logout). */
  clear: () => void;
}

type CacheGet = () => NameCacheState;
type CacheSet = (
  update: (state: NameCacheState) => Partial<NameCacheState>,
) => void;

/**
 * The name-loading part of a list store (its `petNames`/`spots` fields), so the
 * walks and the feed share one implementation. Call `clear()` from the store's reset.
 */
export function createNameCache(get: CacheGet, set: CacheSet): NameCache {
  const pendingPets = new Set<Id>();
  const pendingSpots = new Map<Id, Promise<SpotInfo | null>>();
  // Bumped by clear(): responses to requests started before it are dropped.
  let generation = 0;

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
        // Never overwrite what is known meanwhile (e.g. the spot of an item just created).
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
      useAuthStore.getState().pets.some(pet => pet.id === petId)
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

  return {
    loadSpot,
    rememberSpot: (spotId, info) =>
      set(state => ({ spots: { ...state.spots, [spotId]: info } })),
    loadNames: items => {
      for (const item of items) {
        loadPetName(item.pet_id);
        if (item.spot_id) {
          loadSpot(item.spot_id).catch(() => {
            // Shown as "Площадка"; the next reload tries again.
          });
        }
      }
    },
    clear: () => {
      generation++;
      pendingPets.clear();
      pendingSpots.clear();
    },
  };
}
