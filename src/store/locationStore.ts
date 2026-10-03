import { create } from 'zustand';

import {
  checkLocationPermission,
  getCurrentPosition,
  requestLocationPermission,
  type LocationPermission,
} from '../services/location';
import { loadPreferences, savePreferences } from '../services/preferences';
import type { GeoPoint } from '../types';
import { useAuthStore } from './authStore';

export type { LocationPermission } from '../services/location';

interface LocationState {
  /** 'unknown' until the first check on the map screen. */
  permission: LocationPermission | 'unknown';
  /** The user declined the system prompt in this app session. */
  declined: boolean;
  /** The user closed the location card; only the 📍 button stays (saved across launches). */
  promptDismissed: boolean;

  /** Last known device position; null without access or before the first fix. */
  userPosition: GeoPoint | null;
  locating: boolean;
  positionError: string | null;

  /**
   * A place the user picked by hand (long press on the map) — used instead of the
   * device position when there is no access, or to look somewhere else.
   * Other screens (e.g. choosing a place for a walk) can read and set it too.
   */
  manualPoint: GeoPoint | null;

  /**
   * Reads the permission (never prompts) and the saved card preference; locates
   * the user when access is already granted. Safe to call again, e.g. when the
   * app returns from Settings.
   */
  checkPermission: () => Promise<void>;
  /** Shows the system prompt. Call only from an explicit user action. */
  requestPermission: () => Promise<LocationPermission>;
  /** Gets a fresh position (needs granted access). */
  locate: () => Promise<GeoPoint | null>;
  dismissPrompt: () => void;
  /** Brings the location card back (from the 📍 button). */
  showPrompt: () => void;
  setManualPoint: (point: GeoPoint) => void;
  clearManualPoint: () => void;
  /** Forgets per-user state (the manual point); called on logout. */
  reset: () => void;
}

let preferencesLoaded = false;

export const useLocationStore = create<LocationState>()((set, get) => ({
  permission: 'unknown',
  declined: false,
  promptDismissed: false,

  userPosition: null,
  locating: false,
  positionError: null,

  manualPoint: null,

  checkPermission: async () => {
    if (!preferencesLoaded) {
      preferencesLoaded = true;
      const preferences = await loadPreferences();
      set({ promptDismissed: preferences.locationPromptDismissed === true });
    }

    let permission: LocationPermission;
    try {
      permission = await checkLocationPermission();
    } catch {
      permission = 'unavailable';
    }
    const wasGranted = get().permission === 'granted';
    set({ permission });
    if (permission === 'granted' && (!wasGranted || !get().userPosition)) {
      await get().locate();
    }
  },

  requestPermission: async () => {
    let permission: LocationPermission;
    try {
      permission = await requestLocationPermission();
    } catch {
      permission = 'unavailable';
    }
    set({ permission, declined: permission !== 'granted' });
    if (permission === 'granted') {
      await get().locate();
    }
    return permission;
  },

  locate: async () => {
    set({ locating: true, positionError: null });
    try {
      const userPosition = await getCurrentPosition();
      set({ userPosition, locating: false });
      return userPosition;
    } catch (error) {
      set({
        locating: false,
        positionError:
          error instanceof Error ? error.message : 'Не удалось определить',
      });
      return null;
    }
  },

  dismissPrompt: () => {
    set({ promptDismissed: true });
    savePreferences({ locationPromptDismissed: true });
  },

  showPrompt: () => {
    set({ promptDismissed: false });
    savePreferences({ locationPromptDismissed: false });
  },

  setManualPoint: point => set({ manualPoint: point }),
  clearManualPoint: () => set({ manualPoint: null }),

  reset: () => set({ manualPoint: null }),
}));

/**
 * Where to look for things "near me": the hand-picked place if there is one,
 * otherwise the device position (null when neither is known).
 */
export function selectSearchCenter(state: LocationState): GeoPoint | null {
  return state.manualPoint ?? state.userPosition;
}

useAuthStore.subscribe((state, previous) => {
  if (state.status === 'signedOut' && previous.status !== 'signedOut') {
    useLocationStore.getState().reset();
  }
});
