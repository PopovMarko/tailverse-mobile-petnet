import { create } from 'zustand';

import { getWalkSpot, listWalkSpots } from '../api';
import type { GeoPoint, Id, WalkSpot, WalkSpotDetails } from '../types';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface WalkSpotsState {
  spots: WalkSpot[];
  spotsStatus: LoadStatus;
  spotsError: string | null;

  selectedSpotId: Id | null;
  selectedSpot: WalkSpotDetails | null;
  selectedStatus: LoadStatus;
  selectedError: string | null;

  fetchSpots: (center: GeoPoint, radiusM: number) => Promise<void>;
  selectSpot: (id: Id) => Promise<void>;
  clearSelection: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Panning the map fires requests faster than they complete; only the latest one may write.
let latestSpotsRequest = 0;

export const useWalkSpotsStore = create<WalkSpotsState>()((set, get) => ({
  spots: [],
  spotsStatus: 'idle',
  spotsError: null,

  selectedSpotId: null,
  selectedSpot: null,
  selectedStatus: 'idle',
  selectedError: null,

  fetchSpots: async (center, radiusM) => {
    const requestId = ++latestSpotsRequest;
    set({ spotsStatus: 'loading', spotsError: null });
    try {
      const { spots } = await listWalkSpots(center, radiusM);
      if (requestId === latestSpotsRequest) {
        set({ spots, spotsStatus: 'success' });
      }
    } catch (error) {
      if (requestId === latestSpotsRequest) {
        set({ spotsStatus: 'error', spotsError: errorMessage(error) });
      }
    }
  },

  selectSpot: async id => {
    set({
      selectedSpotId: id,
      selectedSpot: null,
      selectedStatus: 'loading',
      selectedError: null,
    });
    try {
      const spot = await getWalkSpot(id);
      if (get().selectedSpotId === id) {
        set({ selectedSpot: spot, selectedStatus: 'success' });
      }
    } catch (error) {
      if (get().selectedSpotId === id) {
        set({ selectedStatus: 'error', selectedError: errorMessage(error) });
      }
    }
  },

  clearSelection: () =>
    set({
      selectedSpotId: null,
      selectedSpot: null,
      selectedStatus: 'idle',
      selectedError: null,
    }),
}));
